import * as THREE from "three"
import masses from './masses'

const dt = 0.8
const dSOrbit = 0.02
const g = 0.0002959122082855900
const au = 149597870.700
const viewMassScale = 0.01
const viewDistanceScale = 1000
const orbitMaterial = new THREE.LineBasicMaterial({ color : 0xab480d })

export default function createPlanetSystem (scene) {
  masses.forEach((m, i) => {
    const slices = 8 * Math.ceil(m.r / 8000) * Math.ceil(Math.log(1000 * viewMassScale))
    const color = (i === 0) ? 0xffff00 : 0xdb780d
    const geometry = new THREE.SphereGeometry(m.r * viewMassScale, slices, slices)
    const material = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(m.x * viewDistanceScale, m.z * viewDistanceScale, m.y * viewDistanceScale)
    m.mesh = mesh
    m.points = []
    m.dS = dSOrbit
    m.v = 0
    scene.add(mesh)
  })

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

        if (m.points.length < 4) {
          if (m.dS > dSOrbit) {
            m.points.push(new THREE.Vector3(m.x * viewDistanceScale, m.z * viewDistanceScale, m.y * viewDistanceScale))
            m.dS = 0
          }
        } else {
          const orbitGeometry = new THREE.BufferGeometry().setFromPoints(m.points)
          const orbitObject = new THREE.Line(orbitGeometry, orbitMaterial)
          scene.add(orbitObject)
          m.points = []
        }

        updateAccelerationVectors(m, masses[0])

        m.vx += m.ax * dt2
        m.vy += m.ay * dt2
        m.vz += m.az * dt2
      }
      m.mesh.position.set(m.x * viewDistanceScale, m.z * viewDistanceScale, m.y * viewDistanceScale)
    })

    requestAnimationFrame(animate)
  }

  animate()
}

function updateAccelerationVectors(m, m0) {
  const dx = m.x - m0.x;
  const dy = m.y - m0.y;
  const dz = m.z - m0.z;
  const distSq = dx * dx + dy * dy + dz * dz
  const dist = Math.sqrt(distSq)
  const f = - g / (distSq * dist)
  m.ax = dx * f
  m.ay = dy * f
  m.az = dz * f
}
