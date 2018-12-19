import * as THREE from "three"
import { quadtree } from 'd3-quadtree'
import { Delaunay } from 'd3-delaunay'

const nSamples = 30
const nPoints = 300
const maxContinentHeight = 20
const maxContinentDir = 2
const continentForceFactor = 0.5

const q = quadtree()
const groundPoints = []

export default function createLand (scene) {
  for (let i = 0; i < nPoints; i++) {
    let chosenSample = null
    let maxDistance = 2
    for (let j = 0; j < nSamples; j++) {
      const rPoint = [(2 * Math.random() - 1) * 300, (2 * Math.random() - 1) * 300]
      const foundPoint = q.find(rPoint[0], rPoint[1])
      if (!foundPoint) {
        q.add(rPoint)
        break
      }
      const dx = foundPoint[0] - rPoint[0]
      const dy = foundPoint[1] - rPoint[1]
      const dist = dx * dx + dy * dy;
      if (dist > maxDistance) {
        maxDistance = dist
        chosenSample = rPoint
      }
    }
    if (chosenSample) {
      q.add(chosenSample)
      groundPoints.push(chosenSample)
    }
  }

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
  directionalLight.position.set(100, 100, 150)
  scene.add(directionalLight)

  const light = new THREE.AmbientLight(0x404040)
  scene.add(light)

  const hillGroundGeometry = new THREE.Geometry()
  const delaunay = Delaunay.from(groundPoints)
  const nHillGroundPointIndexes = delaunay.points.length
  const nHillGroundFaceIndexes = delaunay.triangles.length
  const hillGroundNodes = []
  //console.log("triangles: ", delaunay.triangles)
  //console.log("halfedges: ", delaunay.halfedges)
  //console.log("points: ", delaunay.points)
  for (let i = 0; i < nHillGroundPointIndexes; i += 2) {
    hillGroundGeometry.vertices.push(new THREE.Vector3(delaunay.points[i], delaunay.points[i + 1], Math.random() + 1))
    hillGroundNodes.push({ continent: -1 })
  }
  const continentColors = [new THREE.Color(0xd4c5ad), new THREE.Color(0x78430d), new THREE.Color(0xc19e18), new THREE.Color(0xa25017)]
  const continents = continentColors.map(function (color, i) {
    const dirX = (2 * Math.random() - 1) * maxContinentDir
    const dirY = (2 * Math.random() - 1) * maxContinentDir
    const dir = new THREE.Vector2(dirX, dirY)
    const len = dir.length()
    if (i === 0) {
      const continent0 = { nodes: [], color, h: -maxContinentHeight, dir, len }
      for (let j = 0; j < delaunay.halfedges.length; j += 3) {
        if ((delaunay.halfedges[j] < 0) || (delaunay.halfedges[j + 1] < 0) || (delaunay.halfedges[j + 2] < 0)) {
          const p0Index = delaunay.triangles[j]
          const p1Index = delaunay.triangles[j + 1]
          const p2Index = delaunay.triangles[j + 2]
          hillGroundNodes[p0Index].continent = 0
          hillGroundNodes[p1Index].continent = 0
          hillGroundNodes[p2Index].continent = 0
          continent0.nodes.push(p0Index, p1Index, p2Index)
        }
      }
      return continent0
    }
    let nodeIndex = -1
    while ((nodeIndex < 0) || (hillGroundNodes[nodeIndex].continent !== -1)) {
      nodeIndex = Math.floor(Math.random() * hillGroundNodes.length)
    }
    hillGroundNodes[nodeIndex].continent = i
    return { nodes: [nodeIndex], color, h: maxContinentHeight * Math.random(), dir, len }
  })
  hillGroundNodes.forEach(function (node, i) {
    continents.forEach(function (continent, continentIndex) {
      if (i < continent.nodes.length) {
        const neighbors = Array.from(delaunay.neighbors(continent.nodes[i]))
        neighbors.forEach(function (neighbor) {
          if (hillGroundNodes[neighbor].continent === -1) {
            hillGroundNodes[neighbor].continent = continentIndex
            continent.nodes.push(neighbor)
          }
        })
        hillGroundGeometry.vertices[continent.nodes[i]].z += continent.h
      }
    })
  })
  for (let i = 0; i < nHillGroundFaceIndexes; i += 3) {
    const p0Index = delaunay.triangles[i]
    const p1Index = delaunay.triangles[i + 1]
    const p2Index = delaunay.triangles[i + 2]
    const c0Index = hillGroundNodes[p0Index].continent
    const c1Index = hillGroundNodes[p1Index].continent
    const c2Index = hillGroundNodes[p2Index].continent
    let continentIndex = c0Index
    let force, dh
    const dirVector = new THREE.Vector2()
    if (c1Index !== c0Index || c2Index !== c0Index) {
      // Not all triangle vertices are on the same continent.
      // 0 -> 1
      dirVector.set(delaunay.points[2 * p1Index] - delaunay.points[2 * p0Index], delaunay.points[2 * p1Index + 1] - delaunay.points[2 * p0Index + 1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c1Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      hillGroundGeometry.vertices[p0Index].z += dh
      hillGroundGeometry.vertices[p1Index].z += dh
      // 1 -> 2
      dirVector.set(delaunay.points[2 * p2Index] - delaunay.points[2 * p1Index], delaunay.points[2 * p2Index + 1] - delaunay.points[2 * p1Index + 1]).normalize()
      force = dirVector.dot(continents[c1Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      hillGroundGeometry.vertices[p1Index].z += dh
      hillGroundGeometry.vertices[p2Index].z += dh
      // 0 -> 2
      dirVector.set(delaunay.points[2 * p2Index] - delaunay.points[2 * p2Index], delaunay.points[2 * p1Index + 1] - delaunay.points[2 * p0Index + 1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = continentForceFactor * force * (maxContinentHeight / maxContinentDir)
      hillGroundGeometry.vertices[p0Index].z += dh
      hillGroundGeometry.vertices[p2Index].z += dh
      //
      continentIndex = Math.min(c0Index, c1Index, c2Index)
    }
    const color = new THREE.Color(continents[continentIndex].color)
    const face = new THREE.Face3(delaunay.triangles[i + 2], delaunay.triangles[i + 1], delaunay.triangles[i])
    const r = 1 - 0.1 * Math.random()
    const c = new THREE.Color(r, r, r)
    color.lerp(c, 0.05 * Math.random())
    face.color = color
    hillGroundGeometry.faces.push(face)
  }
  hillGroundGeometry.computeFaceNormals()
  //hillGroundGeometry.computeVertexNormals()
  const hillGroundMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    wireframe: false,
    vertexColors: THREE.FaceColors,
    flatShading: true
  })
  const hillGroundObject = new THREE.Mesh(hillGroundGeometry, hillGroundMaterial)
  scene.add(hillGroundObject)
}
