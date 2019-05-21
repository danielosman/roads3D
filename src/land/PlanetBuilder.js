import * as THREE from "three"
import { geoDelaunay } from 'd3-geo-voronoi'

const textureWidth = 2048
const textureHeight = 1024

const multiuseSpherical = new THREE.Spherical()
const multiuseVector3 = new THREE.Vector3()

const createLandObject = (planet, scene, canvasTexture) => {
  const planetLandGeometry = new THREE.Geometry()
  planet.planetNodes.forEach(planetNode => {
    const v = new THREE.Vector3(planetNode.coords.x, planetNode.coords.y, planetNode.coords.z)
    planetLandGeometry.vertices.push(v)
  })
  planet.planetTriangles.forEach(triangle => {
    const face = new THREE.Face3(triangle.indexes[0], triangle.indexes[1], triangle.indexes[2])
    face.vertexColors = triangle.vertexColors.map(c => new THREE.Color(c))
    planetLandGeometry.faces.push(face)
  })
  planetLandGeometry.faceVertexUvs[0] = planet.planetLandUVs.map(uvs => uvs.map(uv => new THREE.Vector2(uv.x, uv.y)))
  planetLandGeometry.computeFaceNormals()
  planetLandGeometry.computeFlatVertexNormals()
  const planetLandMaterial = new THREE.MeshLambertMaterial({
    color: 0xd4c5ad,
    wireframe: false,
    vertexColors: THREE.VertexColors,
    flatShading: true,
    map: canvasTexture
  })
  const planetLandObject = new THREE.Mesh(planetLandGeometry, planetLandMaterial)
  scene.add(planetLandObject)
}

const createOceanObject = (planet, scene, canvasTexture) => {
  const oceanGeometry = new THREE.Geometry()
  planet.oceanNodes.forEach(oceanNode => {
    const v = new THREE.Vector3(oceanNode.coords.x, oceanNode.coords.y, oceanNode.coords.z)
    oceanGeometry.vertices.push(v)
  })
  planet.oceanTriangles.forEach(triangle => {
    const face = new THREE.Face3(triangle.indexes[0], triangle.indexes[1], triangle.indexes[2])
    oceanGeometry.faces.push(face)
  })
  oceanGeometry.faceVertexUvs[0] = planet.planetLandUVs.map(uvs => uvs.map(uv => new THREE.Vector2(uv.x, uv.y)))
  oceanGeometry.computeFaceNormals()
  oceanGeometry.computeFlatVertexNormals()
  const oceanMaterial = new THREE.MeshLambertMaterial({
    color: 0x3355ee,
    flatShading: true,
    map: canvasTexture,
    //transparent: true,
    //opacity: 0.66
  })
  const oceanObject = new THREE.Mesh(oceanGeometry, oceanMaterial)
  //oceanObject.visible = false
  scene.add(oceanObject)
}

const createRiverObjects = (planet, scene) => {
  const riverMaterial = new THREE.MeshLambertMaterial({ color: 0x3356f0 })
  planet.riverNodes.forEach(riverNode => {
    if (riverNode.nodes.length < 2) return
    const riverPathGeometry = new THREE.Geometry()
    riverNode.coords.forEach(c => {
      const v = new THREE.Vector3(c.x, c.y, c.z)
      riverPathGeometry.vertices.push(v)
    })
    riverPathGeometry.faces.push(new THREE.Face3(0, 1, 2))
    riverPathGeometry.computeFaceNormals()
    const riverPathObject = new THREE.Mesh(riverPathGeometry, riverMaterial)
    scene.add(riverPathObject)
  })
}

const createPolarCurve = (planet, scene) => {
  const polarCurve = new THREE.LineCurve3(new THREE.Vector3(0, 1.1 * planet.planetR, 0), new THREE.Vector3(0, -planet.planetR * 1.1, 0))
  const polarCurveGeometry = new THREE.BufferGeometry().setFromPoints(polarCurve.getPoints(2))
  const polarCurveMaterial = new THREE.LineBasicMaterial({ color : 0xffffff })
  const polarCurveObject = new THREE.Line(polarCurveGeometry, polarCurveMaterial)
  scene.add(polarCurveObject)
}

const fetchPlanetDataPromise = fetch('/planet').then(res => res.json())

const planetTexturePromise = new Promise(resolve => {
  setTimeout(() => {
    const canvas = document.createElement('canvas')
    canvas.width = textureWidth
    canvas.height = textureHeight
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#999999'
    ctx.fillRect(0, canvas.height / 2, canvas.width, 1)
    const canvasTexture = new THREE.CanvasTexture(canvas)
    canvasTexture.wrapS = THREE.RepeatWrapping
    resolve(canvasTexture)
  }, 0)
})

const textureDataPromise = new Promise(resolve => {
  setTimeout(() => {
    const size = textureWidth * textureHeight
    const data = new Uint8Array(4 * size)
    for (let i = 0; i < size; i++) {
      let s = i * 4
      data[s] = 255
      data[s + 1] = 255
      data[s + 2] = 255
      data[s + 3] = 255
    }
    resolve(data)
  }, 0)
})

export default function createPlanet (scene) {
  return new Promise(ready => {
    Promise.all([fetchPlanetDataPromise, textureDataPromise]).then(([planet, textureData]) => {
      const texture = new THREE.DataTexture(textureData, textureWidth, textureHeight, THREE.RGBAFormat)
      texture.wrapS = THREE.RepeatWrapping
      texture.needsUpdate = true
      createLandObject(planet, scene, texture)
      createOceanObject(planet, scene, texture)
      createRiverObjects(planet, scene)
      createPolarCurve(planet, scene)

      const delaunay = geoDelaunay(planet.planetNodes.map(n => n.point))
      const planetTriangles = planet.planetTriangles.map(t => new THREE.Triangle(...t.indexes.map(i => planet.planetNodes[i].coords)))
      const elevationAt = (lon, lat, point) => {
        const foundIndex = delaunay.find(lon, lat)
        let p = point
        if (!point) {
          multiuseSpherical.set(planet.planetR, Math.PI * (lat + 90) / 180, Math.PI * lon / 180)
          multiuseVector3.setFromSpherical(multiuseSpherical)
          p = multiuseVector3
        }
        const foundTriangleIndex = planet.planetNodes[foundIndex].triangles.find(triangleIndex => planetTriangles[triangleIndex].containsPoint(p))
        if (foundTriangleIndex === undefined) return null
        const triangle = planetTriangles[foundTriangleIndex]
        const dt = delaunay.triangles[foundTriangleIndex]
        triangle.getBarycoord(p, multiuseVector3)
        return dt.reduce((acc, ni, i) => acc + planet.planetNodes[ni].h * multiuseVector3.getComponent(i), 0)
      }
      const proxy = {
        sphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), planet.planetR),
        markerAt: point => {
          multiuseSpherical.setFromVector3(point)
          const lon = 180 * multiuseSpherical.theta / Math.PI
          const lat = (180 * multiuseSpherical.phi / Math.PI) - 90
          const markerNodes = []
          markerNodes.push({ h: elevationAt(lon, lat, point), lon: lon, lat: lat })
          markerNodes.forEach(markerNode => {
            multiuseSpherical.set(planet.planetR + markerNode.h, Math.PI * (markerNode.lat + 90) / 180, Math.PI * markerNode.lon / 180)
            multiuseVector3.setFromSpherical(multiuseSpherical)
            markerNode.p = multiuseVector3.clone()
          })
          return markerNodes
        }
      }
      ready(proxy)
    })
  })

  // Lights
  /*
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
  directionalLight.position.set(100, 100, 150)
  scene.add(directionalLight)
  const ambientLight = new THREE.AmbientLight(0x404040)
  scene.add(ambientLight)
  */
}
