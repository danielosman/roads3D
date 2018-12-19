import * as THREE from "three"
import { quadtree } from 'd3-quadtree'
import { geoDelaunay } from 'd3-geo-voronoi'
import { Delaunay } from "d3-delaunay"

const planetR = 100
const nSamples = 30
const nPoints = 600
const maxContinentHeight = planetR / 50
const maxContinentDir = 2
const continentForceFactor = 0.5

const q0 = quadtree()
const q1 = quadtree()
const planetPoints = []
const planetNodes = []

function shiftedLonLat(point0) {
  let lon = point0[0] + 180
  let lat = point0[1] + 90
  if (lon >= 180) lon -= 360
  if (lat >= 90) lat -= 180
  return [lon, lat]
}

export default function createPlanet (scene) {
  for (let i = 0; i < nPoints; i++) {
    let chosenSample0 = null
    let chosenSample1 = null
    let maxDistance = 2
    for (let j = 0; j < nSamples; j++) {
      const point0 = [(2 * Math.random() - 1) * 180, (2 * Math.random() - 1) * 85]
      const point1 = shiftedLonLat(point0)
      const foundPoint0 = q0.find(point0[0], point0[1])
      if (!foundPoint0) {
        q0.add(point0)
        q1.add(point1)
        break
      }
      const foundPoint1 = q1.find(point1[0], point1[1])
      const dx0 = foundPoint0[0] - point0[0]
      const dy0 = foundPoint0[1] - point0[1]
      const dx1 = foundPoint1[0] - point1[0]
      const dy1 = foundPoint1[1] - point1[1]
      const dist = Math.min(dx0 * dx0 + dy0 * dy0, dx1 * dx1 + dy1 * dy1);
      if (dist > maxDistance) {
        maxDistance = dist
        chosenSample0 = point0
        chosenSample1 = point1
      }
    }
    if (chosenSample0) {
      q0.add(chosenSample0)
      q1.add(chosenSample1)
      planetPoints.push(chosenSample0)
    }
  }

  // Lights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
  directionalLight.position.set(100, 100, 150)
  scene.add(directionalLight)
  const ambientLight = new THREE.AmbientLight(0x404040)
  scene.add(ambientLight)

  // Initialize planet nodes
  const planetLandGeometry = new THREE.Geometry()
  const delaunay = geoDelaunay(planetPoints)
  for (let i = 0; i < planetPoints.length; i++) {
    planetNodes.push({ continent: -1, h: planetR })
  }

  // Continents
  const continentColors = [
    new THREE.Color(0xd4c5ad),
    new THREE.Color(0x78430d),
    new THREE.Color(0xc19e18),
    new THREE.Color(0xa25017),
    new THREE.Color(0x58230d),
    new THREE.Color(0xc27037),
    new THREE.Color(0xa17e08),
  ]
  const continents = continentColors.map(function (color, i) {
    const dirX = (2 * Math.random() - 1) * maxContinentDir
    const dirY = (2 * Math.random() - 1) * maxContinentDir
    const dir = new THREE.Vector2(dirX, dirY)
    const len = dir.length()
    let nodeIndex = -1
    while ((nodeIndex < 0) || (planetNodes[nodeIndex].continent !== -1)) {
      nodeIndex = Math.floor(Math.random() * planetNodes.length)
    }
    planetNodes[nodeIndex].continent = i
    return { nodes: [nodeIndex], color, h: (2 * Math.random() - 1) * maxContinentHeight, dir, len }
  })

  // Expand continents
  planetNodes.forEach(function (node, i) {
    continents.forEach(function (continent, continentIndex) {
      if (i < continent.nodes.length) {
        const neighbors = Array.from(delaunay.neighbors[continent.nodes[i]])
        neighbors.forEach(function (neighbor) {
          if (planetNodes[neighbor].continent === -1) {
            planetNodes[neighbor].continent = continentIndex
            continent.nodes.push(neighbor)
          }
        })
        planetNodes[continent.nodes[i]].h += continent.h
      }
    })
  })

  // Faces
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const p0Index = delaunay.triangles[i][0]
    const p1Index = delaunay.triangles[i][1]
    const p2Index = delaunay.triangles[i][2]
    const c0Index = planetNodes[p0Index].continent
    const c1Index = planetNodes[p1Index].continent
    const c2Index = planetNodes[p2Index].continent
    const continentIndex = Math.min(c0Index, c1Index, c2Index)
    let force, dh
    const dirVector = new THREE.Vector2()
    if (c0Index !== continentIndex || c1Index !== continentIndex || c2Index !== continentIndex) {
      // Not all triangle vertices are on the same continent.
      // 0 -> 1
      dirVector.set(planetPoints[p1Index][0] - planetPoints[p0Index][0], planetPoints[p1Index][1] - planetPoints[p0Index][1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c1Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      planetNodes[p0Index].h += dh
      planetNodes[p1Index].h += dh
      // 1 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p1Index][0], planetPoints[p2Index][1] - planetPoints[p1Index][1]).normalize()
      force = dirVector.dot(continents[c1Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      planetNodes[p1Index].h += dh
      planetNodes[p2Index].h += dh
      // 0 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p2Index][0], planetPoints[p1Index][1] - planetPoints[p0Index][1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      planetNodes[p0Index].h += dh
      planetNodes[p2Index].h += dh
    }
    const face = new THREE.Face3(p0Index, p1Index, p2Index)
    const color = new THREE.Color(continents[continentIndex].color)
    const r = 1 - 0.1 * Math.random()
    const c = new THREE.Color(r, r, r)
    color.lerp(c, 0.05 * Math.random())
    face.color = color
    planetLandGeometry.faces.push(face)
  }

  // Vertices
  planetNodes.forEach(function(planetNode, i) {
    const planetPoint = planetPoints[i]
    const planetNodeCoords = new THREE.Vector3(0, 0, 0)
    const spherical = new THREE.Spherical(planetNode.h, Math.PI * (planetPoint[1] + 90) / 180, 2 * Math.PI * (planetPoint[0] + 180) / 360)
    planetNodeCoords.setFromSpherical(spherical)
    planetLandGeometry.vertices.push(planetNodeCoords)
  })

  // Land Object
  planetLandGeometry.computeFaceNormals()
  //planetLandGeometry.computeVertexNormals()
  const planetLandMaterial = new THREE.MeshLambertMaterial({
    color: 0xd4c5ad,
    wireframe: false,
    vertexColors: THREE.FaceColors,
    flatShading: true
  })
  const planetLandObject = new THREE.Mesh(planetLandGeometry, planetLandMaterial)
  scene.add(planetLandObject)

  // Ocean Object
  const oceanGeometry = new THREE.SphereGeometry(planetR, 32, 32)
  const oceanMaterial = new THREE.MeshLambertMaterial({ color: 0x2244dd })
  const oceanObject = new THREE.Mesh(oceanGeometry, oceanMaterial);
  scene.add(oceanObject);
}
