import * as THREE from "three"
import { SVGObject } from 'three/examples/jsm/renderers/SVGRenderer'
import masses from './masses'

const dt = 0.08
const dSOrbit = 0.02
const g = 0.0002959122082855900
const au = 149597870.700
const viewMassScale = 0.01
const viewDistanceScale = 1000
const orbitMaterial = new THREE.LineBasicMaterial({ color : 0xab480d })

export default function createPlanetSystem (scene, camera) {
  const sunLight = new THREE.PointLight(0xffffff)
  sunLight.position.set(masses[0].x * viewDistanceScale, masses[0].z * viewDistanceScale, masses[0].y * viewDistanceScale)
  scene.add(sunLight)

  /*
  const node = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
  node.setAttribute('stroke', '#ffffff');
  node.setAttribute('fill', 'none');
  node.setAttribute('r', '15');
  */
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")
  ctx.clearRect(0, 0, 16, 16)
  ctx.strokeStyle = 'white'
  ctx.strokeRect(1, 1, 14, 14)
  const map = new THREE.CanvasTexture(canvas)
  //map.minFilter = THREE.LinearFilter
  map.minFilter = THREE.NearestFilter
  map.magFilter = THREE.NearestFilter
  const spriteMaterial = new THREE.SpriteMaterial({ map, color: 0xffffff, depthTest: false, depthWrite: false })
  //spriteMaterial.sizeAttenuation = false

  masses.forEach((m, i) => {
    m.points = []
    m.dS = dSOrbit
    m.v = 0
    m.T = 2 * Math.PI * Math.sqrt(m.md * m.md * m.md / g)
    m.t = 0
    m.orbitObjects = []
    if (m.md > 0) {
      const oa = (m.aphelion + m.perihelion) / 2
      const oc = m.e * oa
      const ob = oa * Math.sqrt(1 - (m.e * m.e))
      const ellipseCurve = new THREE.EllipseCurve(
        oc * viewDistanceScale,
        0,
        oa * viewDistanceScale,
        ob * viewDistanceScale,
        0, 2 * Math.PI, false, 0)
      const ellipseGeometry = new THREE.BufferGeometry().setFromPoints(ellipseCurve.getPoints(Math.max(Math.ceil(2 * Math.PI * m.md), 64)))
      const ellipseMaterial = new THREE.LineBasicMaterial({ color: 0xff2222 })
      const ellipse = new THREE.Line(ellipseGeometry, ellipseMaterial)
      //const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 4)
      //const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
      //q1.multiply(q2)
      //ellipse.quaternion.copy(q1)
      scene.add(ellipse)
      m.x = -m.perihelion
      m.y = 0
      m.z = 0
      m.vx = 0
      m.vy = -Math.sqrt(g * (1 + m.e) / m.perihelion)
      m.vz = 0
    }

    const slices = 16
    const color = (i === 0) ? 0xffff00 : 0xdb780d
    const geometry = new THREE.SphereGeometry(m.r * viewMassScale, slices, slices)
    const material = new THREE.MeshLambertMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(m.x * viewDistanceScale, m.y * viewDistanceScale, m.z * viewDistanceScale)

    /*
    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.center = new THREE.Vector2(0.5, 0.5)
    sprite.position.set(mesh.position.x, mesh.position.y, mesh.position.z)
    sprite.scale.set(160, 160, 1)
    scene.add(sprite)
    */
    m.mesh = mesh
    scene.add(mesh)
    console.log("m: ", m)
  })

  let show = false
  const dt2 = dt / 2
  const animate = () => {
    masses.forEach((m, i) => {
      if (i > 0) {
        updateAccelerationVectors(m, masses[0])

        m.vx += m.ax * dt2
        m.vy += m.ay * dt2
        m.vz += m.az * dt2

        m.v = Math.sqrt(m.vx * m.vx + m.vy * m.vy + m.vz * m.vz)
        m.dS += m.v * dt

        m.x += m.vx * dt
        m.y += m.vy * dt
        m.z += m.vz * dt

        m.t += dt

        if (m.points.length < 4) {
          if (m.dS > dSOrbit) {
            m.points.push(new THREE.Vector3(m.x * viewDistanceScale, m.y * viewDistanceScale, m.z * viewDistanceScale))
            m.dS = 0
          }
        } else {
          const orbitGeometry = new THREE.BufferGeometry().setFromPoints(m.points)
          const orbitObject = new THREE.LineSegments(orbitGeometry, orbitMaterial)
          orbitObject.renderOrder = -20
          scene.add(orbitObject)
          m.orbitObjects.push({ t: m.t, orbitObject })
          if (m.t - m.orbitObjects[0].t > (m.T - 20)) {
            m.orbitObjects[0].orbitObject.geometry.dispose()
            scene.remove(m.orbitObjects[0].orbitObject)
            m.orbitObjects.shift()
          }
          m.points = []
        }

        updateAccelerationVectors(m, masses[0])

        m.vx += m.ax * dt2
        m.vy += m.ay * dt2
        m.vz += m.az * dt2
      }
      m.mesh.position.set(m.x * viewDistanceScale, m.y * viewDistanceScale, m.z * viewDistanceScale)

      if (!show) {
        const pos = m.mesh.position.clone()
        m.mesh.updateMatrixWorld()
        pos.setFromMatrixPosition(m.mesh.matrixWorld)
        pos.project(camera)
        console.log(m.name + ': ', pos)
        show = true
      }
    })

    requestAnimationFrame(animate)
  }

  animate()
}

function updateAccelerationVectors(m, m0) {
  const dx = m.x// - m0.x;
  const dy = m.y// - m0.y;
  const dz = m.z// - m0.z;
  const distSq = dx * dx + dy * dy + dz * dz
  const dist = Math.sqrt(distSq)
  const f = - g / (distSq * dist)
  m.ax = dx * f
  m.ay = dy * f
  m.az = dz * f
}
