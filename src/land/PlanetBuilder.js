import * as THREE from "three"
import { geoDelaunay } from 'd3-geo-voronoi'
import { scaleThreshold, scaleLinear, scaleQuantize } from 'd3-scale'
import { geoDistance } from 'd3-geo'

const planetR = 100
const maxTemperature = 40
const nSamples = 25
const nPoints = 614
const maxContinentHeight = planetR / 100
const maxContinentDir = 2
const continentForceFactor = 0.5
const nContinents = 8

const temperatureDropAtLatitude = scaleLinear().domain([-90, -60, -30, 0, 30, 60, 90]).range([50, 24, 6, 0, 6, 24, 50])
const temperatureDropAtAltitude = scaleLinear().domain([-maxContinentHeight, 0, maxContinentHeight]).range([0, 0, 15])
const moistureAddAtTemperature = scaleLinear().domain([0, 30]).range([0.5, 1])
const moistureDropAtAltitude = scaleLinear().domain([0, maxContinentHeight * 3]).range([0.1, 1])
const moistureDropAtTemperature = scaleLinear().domain([0, 10, 20, 30, 40]).range([0.18, 0.25, 0.38, 0.61, 0.95])
const windDirAtLatitude = scaleThreshold().domain([-60, -30, 0, 30, 60]).range([
  (new THREE.Vector2(-1, 1)).normalize(),
  (new THREE.Vector2(1, -1)).normalize(),
  (new THREE.Vector2(-1, 1)).normalize(),
  (new THREE.Vector2(-1, -1)).normalize(),
  (new THREE.Vector2(1, 1)).normalize(),
  (new THREE.Vector2(-1, -1)).normalize()
])
const temperatureBiomeIndexScale = scaleQuantize()
  .domain([-5, 30])
  .range([0, 1, 2, 3])
const moistureBiomeIndexScale = scaleQuantize()
  .domain([0, 1])
  .range([0, 1, 2, 3, 4, 5])
const biomeIndex = [
  ['scorched',        'bare',           'tundra',         'snow',             'snow',               'snow'],
  ['temperateDesert', 'shrubLand',      'shrubLand',      'shrubLand',        'taiga',              'taiga'],
  ['temperateDesert', 'grassland',      'grassland',      'deciduousForest',  'deciduousForest',    'rainForest'],
  ['tropicalDesert',  'grassland',      'seasonalForest', 'seasonalForest',   'tropicalRainForest', 'tropicalRainForest']]
const biomeColors = {
  scorched: 0x999999, bare: 0xbbbbbb, tundra: 0xddddbb, snow: 0xf8f8f8,
  temperateDesert: 0xe4e8ca, shrubLand: 0xc4ccbb, taiga: 0xccd4bb,
  grassland: 0xc4d4aa, deciduousForest: 0xb4c9a9, rainForest: 0xa4c4a8,
  tropicalDesert: 0xe9ddc7, seasonalForest: 0xa9cca4, tropicalRainForest: 0x9cbba9
}
const biomesUsed = {
  scorched: 0, bare: 0, tundra: 0, snow: 0, temperateDesert: 0, shrubLand: 0, taiga: 0,
  grassland: 0, deciduousForest: 0, rainForest: 0, tropicalDesert: 0, seasonalForest: 0, tropicalRainForest: 0
}
const erosionHeigh2WetMoistureScale = scaleLinear().domain([0, 1]).range([0, 0.75]).clamp(true)
const erosionWet2WaterMoistureScale = scaleLinear().domain([0, 1]).range([0, 0.75]).clamp(true)
const erosionHeighWet2WhateverMoistureScale = scaleLinear().domain([0, 1]).range([0, 0.75]).clamp(true)

export default function createPlanet (scene) {
  const planetPoints = [[(2 * Math.random() - 1) * 180, (2 * Math.random() - 1) * 90]]
  for (let i = 0; i < nPoints; i++) {
    let chosenSample0 = null
    let maxDistance = 0
    const nPlanetPoints = planetPoints.length
    for (let j = 0; j < nSamples; j++) {
      const point0 = [(2 * Math.random() - 1) * 180, (2 * Math.random() - 1) * 90]
      let minDistance = 100
      for (let k = 0; k < nPlanetPoints; k++) {
        const dist = geoDistance(point0, planetPoints[k])
        if (dist < minDistance) {
          minDistance = dist
        }
      }
      if (minDistance > maxDistance) {
        maxDistance = minDistance
        chosenSample0 = point0
      }
    }
    planetPoints.push(chosenSample0)
  }

  // Lights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
  directionalLight.position.set(100, 100, 150)
  scene.add(directionalLight)
  const ambientLight = new THREE.AmbientLight(0x404040)
  scene.add(ambientLight)

  // Initialize planet nodes
  const planetLandGeometry = new THREE.Geometry()
  const oceanGeometry = new THREE.Geometry()
  const delaunay = geoDelaunay(planetPoints)
  const planetNodes = planetPoints.map((point, i) => ({
    continent: -1,
    h: 0, t: 0, point, i,
    moistureFromNeighbors: 0,
    moistureDrop: 0,
    moisture: 0,
    waterFlowIn: 0
  }))

  // Continents
  const continents = []
  for (let i = 0; i < nContinents; i++) {
    const dirX = (2 * Math.random() - 1) * maxContinentDir
    const dirY = (2 * Math.random() - 1) * maxContinentDir
    const dir = new THREE.Vector2(dirX, dirY)
    const len = dir.length()
    let nodeIndex = -1
    while ((nodeIndex < 0) || (planetNodes[nodeIndex].continent !== -1)) {
      nodeIndex = Math.floor(Math.random() * planetNodes.length)
    }
    planetNodes[nodeIndex].continent = i
    let h = 0
    if (Math.random() < 0.7) {
      h = -maxContinentHeight * (Math.random() * 0.9 + 0.1)
    } else {
      h = maxContinentHeight * (Math.random() * 0.9 + 0.1)
    }
    const continent = { nodes: [nodeIndex], h, dir, len }
    continents.push(continent)
  }

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

  // Heights based on tectonics
  const forceFactor = continentForceFactor * maxContinentHeight / maxContinentDir
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const p0Index = delaunay.triangles[i][0]
    const p1Index = delaunay.triangles[i][1]
    const p2Index = delaunay.triangles[i][2]
    const c0Index = planetNodes[p0Index].continent
    const c1Index = planetNodes[p1Index].continent
    const c2Index = planetNodes[p2Index].continent
    const continentIndex = Math.min(c0Index, c1Index, c2Index)
    if (c0Index !== continentIndex || c1Index !== continentIndex || c2Index !== continentIndex) {
      let force, dh
      const dirVector = new THREE.Vector2()
      // Not all triangle vertices are on the same continent.
      // 0 -> 1
      dirVector.set(planetPoints[p1Index][0] - planetPoints[p0Index][0], planetPoints[p1Index][1] - planetPoints[p0Index][1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c1Index].dir)
      dh = forceFactor * force + (Math.random() - 0.5) * maxContinentHeight / 10
      planetNodes[p0Index].h += dh
      planetNodes[p1Index].h += dh
      // 1 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p1Index][0], planetPoints[p2Index][1] - planetPoints[p1Index][1]).normalize()
      force = dirVector.dot(continents[c1Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = forceFactor * force + (Math.random() - 0.5) * maxContinentHeight / 10
      planetNodes[p1Index].h += dh
      planetNodes[p2Index].h += dh
      // 0 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p2Index][0], planetPoints[p1Index][1] - planetPoints[p0Index][1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = forceFactor * force + (Math.random() - 0.5) * maxContinentHeight / 10
      planetNodes[p0Index].h += dh
      planetNodes[p2Index].h += dh
    }
  }

  // Temperature
  planetNodes.forEach(planetNode => planetNode.t = maxTemperature - temperatureDropAtAltitude(planetNode.h) - temperatureDropAtLatitude(planetNode.point[1]))

  // Moisture
  const moistureTravel = (moisture, planetNode, hops) => {
    if (hops > 10) {
      return
    }
    if (!planetNode.windNeighbors) {
      const windNeighbors = []
      let dotSum = 0
      delaunay.neighbors[planetNode.i].forEach(neighborIndex => {
        const neighborNode = planetNodes[neighborIndex]
        const dir = (new THREE.Vector2(neighborNode.point[0] - planetNode.point[0], neighborNode.point[1] - planetNode.point[1])).normalize()
        const windDir = windDirAtLatitude(planetNode.point[1])
        const dot = windDir.dot(dir)
        if (dot > 0) {
          dotSum += dot
          windNeighbors.push({ dot, i: neighborIndex, moistureBlocked: 0 })
        }
      })
      windNeighbors.forEach(windNeighbor => windNeighbor.frac = windNeighbor.dot / dotSum)
      planetNode.windNeighbors = windNeighbors
    }
    const h = Math.max(planetNode.h, 0)
    const m = Math.max(0, Math.min(moisture, moistureDropAtAltitude(h) + moistureDropAtTemperature(planetNode.t)) - planetNode.moistureDrop)
    planetNode.moistureDrop += m
    planetNode.moisture += moisture
    const waterNode = (h <= 0) ? 1 : 0
    const moistureLeft = 0.9 * (moisture - m)
    if (moistureLeft <= 0.01) return
    planetNode.windNeighbors.forEach(windNeighbor => {
      const neighborNode = planetNodes[windNeighbor.i]
      const neighborH = Math.max(neighborNode.h, 0)
      const moistureBlocked = Math.max(0, moistureDropAtAltitude(neighborH - h) * moistureLeft)
      const mBlocked = Math.max(0, moistureDropAtAltitude(neighborH - h) * m)
      let moisturePassed = moistureLeft - moistureBlocked
      windNeighbor.moistureBlocked += moistureBlocked
      if (neighborH > 0) {
        if (waterNode) {
          neighborNode.moistureDrop += mBlocked
        } else {
          planetNode.moistureDrop += 0.5 * mBlocked
          neighborNode.moistureDrop += 0.5 * mBlocked
        }
      }
      if (moisturePassed > 0) {
        if (!neighborNode.windNeighbors) {
          neighborNode.moistureFromNeighbors += moisturePassed
        } else {
          moistureTravel(moisturePassed, neighborNode, hops + 1)
        }
      }
    })
  }
  planetNodes.forEach(planetNode => {
    const h = Math.max(planetNode.h, 0)
    const waterNode = (h <= 0) ? 1 : 0
    let moistureAdd = waterNode * moistureAddAtTemperature(planetNode.t)
    if (!planetNode.windNeighbors && planetNode.moistureFromNeighbors) {
      moistureAdd += planetNode.moistureFromNeighbors
    }
    if (moistureAdd > 0) {
      moistureTravel(moistureAdd, planetNode, 0)
    }
  })

  // Erosion
  planetNodes.forEach(planetNode => {
    if (planetNode.h <= 0) return
    const neighbors = delaunay.neighbors[planetNode.i]
    const n = neighbors.length
    neighbors.forEach(neighborIndex => {
      const neighborNode = planetNodes[neighborIndex]
      const heightDiff = planetNode.h - neighborNode.h
      let factor = 0
      // Heigh -> Wet
      if (heightDiff > 0) {
        factor = erosionHeigh2WetMoistureScale(neighborNode.moistureDrop)
        planetNode.h -= heightDiff * factor / (4 * n)
        neighborNode.h += heightDiff * factor / (2 * n)
      }
      // Wet -> Water
      if (neighborNode.h <= 0) {
        factor = erosionWet2WaterMoistureScale(planetNode.moistureDrop)
        planetNode.h -= heightDiff * factor / (4 * n)
        neighborNode.h += heightDiff * factor / (2 * n)
      } else if (heightDiff > 0) {
        factor = erosionHeighWet2WhateverMoistureScale(planetNode.moistureDrop)
        planetNode.h -= heightDiff * factor / (4 * n)
        neighborNode.h += heightDiff * factor / (2 * n)
      }
    })
  })

  // River flows
  planetNodes.forEach(planetNode => {
    if (planetNode.h <= 0) return
    planetNode.waterFlowInFull = planetNode.moistureDrop
    planetNode.waterFlowIn = Math.min(planetNode.moistureDrop, 1)
    delaunay.neighbors[planetNode.i].forEach(neighborIndex => {
      const neighborNode = planetNodes[neighborIndex]
      if (neighborNode.h > planetNode.h) {
        const windNeighbor = planetNode.windNeighbors ? planetNode.windNeighbors.find(wn => wn.i === neighborIndex) : null
        const moistureBlocked = (windNeighbor ? windNeighbor.moistureBlocked : 0)
        planetNode.waterFlowInFull = neighborNode.moistureDrop + moistureBlocked
        planetNode.waterFlowIn += Math.min(neighborNode.moistureDrop, 1) + Math.min(moistureBlocked, 1)
      }
    })
  })

  // Vertices
  const riverNodes = []
  planetNodes.forEach(planetNode => {
    // Planet Vertices
    const planetNodeCoords = new THREE.Vector3(0, 0, 0)
    let spherical = new THREE.Spherical(planetNode.h + planetR, Math.PI * (planetNode.point[1] + 90) / 180, 2 * Math.PI * (planetNode.point[0] + 180) / 360)
    planetNodeCoords.setFromSpherical(spherical)
    planetNode.coords = planetNodeCoords
    planetLandGeometry.vertices.push(planetNodeCoords)
    // Ocean Vertices
    const oceanNodeCoords = new THREE.Vector3(0, 0, 0)
    spherical = new THREE.Spherical(planetR, Math.PI * (planetNode.point[1] + 90) / 180, 2 * Math.PI * (planetNode.point[0] + 180) / 360)
    oceanNodeCoords.setFromSpherical(spherical)
    oceanGeometry.vertices.push(oceanNodeCoords)
    // River nodes
    if (planetNode.waterFlowIn > 3) {
      planetNode.isRiverNode = true
      riverNodes.push(planetNode)
    }
  })

  // Moisture Drop Range
  const moistureDropRange = [1, 0]
  planetNodes.forEach(planetNode => {
    if (planetNode.moistureDrop < moistureDropRange[0]) {
      moistureDropRange[0] = planetNode.moistureDrop
    }
    if (planetNode.moistureDrop > moistureDropRange[1]) {
      moistureDropRange[1] = planetNode.moistureDrop
    }
  })
  console.log("moistureDropRange: ", moistureDropRange)

  // Rivers
  const riverMaterial = new THREE.MeshLambertMaterial({ color: 0x3356f0 })
  const riverLineMaterial = new THREE.LineBasicMaterial({ color: 0x3355ee })
  const axis = new THREE.Vector3(0, 1, 0)
  const riverFromNodes = (nodes) => {
    //const r = ((nodes[0].waterFlowInFull + nodes[1].moistureDrop) / moistureDropRange[1]) + 1
    const r = ((nodes[0].waterFlowIn + nodes[1].moistureDrop) / (3 + moistureDropRange[1])) + 1
    const dir = (new THREE.Vector3()).subVectors(nodes[1].coords, nodes[0].coords)
    const cross = (new THREE.Vector3()).crossVectors(nodes[0].coords, nodes[1].coords).normalize()
    const riverPathGeometry = new THREE.Geometry()
    const spherical0 = new THREE.Spherical(nodes[0].h + planetR + 0.1, Math.PI * (nodes[0].point[1] + 90) / 180, 2 * Math.PI * (nodes[0].point[0] + 180) / 360)
    const v0 = (new THREE.Vector3()).setFromSpherical(spherical0)
    riverPathGeometry.vertices.push(v0)
    riverPathGeometry.vertices.push(nodes[1].coords.clone().sub(cross.clone().multiplyScalar(r)))
    riverPathGeometry.vertices.push(nodes[1].coords.clone().add(cross.clone().multiplyScalar(r)))
    riverPathGeometry.faces.push(new THREE.Face3(0, 1, 2))
    riverPathGeometry.computeFaceNormals()
    const riverPathObject = new THREE.Mesh(riverPathGeometry, riverMaterial)
    scene.add(riverPathObject)
    console.log("River added")
  }
  riverNodes.forEach(planetNode => {
    let chosenNeighbor = null
    let chosenNeighborH = planetNode.h
    delaunay.neighbors[planetNode.i].forEach(neighborIndex => {
      const neighborNode = planetNodes[neighborIndex]
      if (neighborNode.h < 0 && neighborNode.h < chosenNeighborH) {
        chosenNeighborH = neighborNode.h
        chosenNeighbor = neighborNode
      }
    })
    if (chosenNeighbor) {
      /*
      const radiusTop = (planetNode.waterFlowInFull + chosenNeighbor.moistureDrop) / moistureDropRange[1]
      const radiusBottom = planetNode.waterFlowInFull / moistureDropRange[1]
      const dirVector = (new THREE.Vector3()).subVectors(chosenNeighbor.coords, planetNode.coords)
      const riverGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, dirVector.length(), 8)
      const riverObject = new THREE.Mesh(riverGeometry, riverMaterial)
      riverObject.quaternion.setFromUnitVectors(axis, dirVector.clone().normalize())
      riverObject.position.copy(dirVector.clone().multiplyScalar(0.5).add(planetNode.coords))
      console.log("Added river")
      scene.add(riverObject)
      */
      /*
      const riverLineGeometry = new THREE.Geometry()
      const spherical0 = new THREE.Spherical(planetNode.h + planetR + 0.1, Math.PI * (planetNode.point[1] + 90) / 180, 2 * Math.PI * (planetNode.point[0] + 180) / 360)
      const v0 = (new THREE.Vector3()).setFromSpherical(spherical0)
      riverLineGeometry.vertices.push(v0)
      riverLineGeometry.vertices.push(chosenNeighbor.coords.clone())
      const riverLineObject = new THREE.Line(riverLineGeometry, riverLineMaterial)
      scene.add(riverLineObject)
      */
      riverFromNodes([planetNode, chosenNeighbor])
    }
  })

  // Faces
  let biomesUsedSum = 0
  const vertexColorsForIndexes = indexes => {
    return indexes.map(index => {
      const planetNode = planetNodes[index]
      const temperatureBiomeIndex = temperatureBiomeIndexScale(planetNode.t)
      const moistureBiomeIndex = moistureBiomeIndexScale(planetNode.moistureDrop)
      const biome = biomeIndex[temperatureBiomeIndex][moistureBiomeIndex]
      if (planetNode.h > 0) {
        biomesUsedSum++
        biomesUsed[biome]++
      }
      const color = new THREE.Color(biomeColors[biome])
      const r = 1 - 0.1 * Math.random()
      const c = new THREE.Color(r, r, r)
      color.lerp(c, 0.05 * Math.random())
      return color
    })
  }
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const indexes = [delaunay.triangles[i][0], delaunay.triangles[i][1], delaunay.triangles[i][2]]
    const face = new THREE.Face3(indexes[0], indexes[1], indexes[2])
    face.vertexColors = vertexColorsForIndexes(indexes)
    planetLandGeometry.faces.push(face)
    const oceanFace = new THREE.Face3(indexes[0], indexes[1], indexes[2])
    oceanGeometry.faces.push(oceanFace)
  }

  Object.keys(biomesUsed).forEach(key => biomesUsed[key] = Math.round(100 * biomesUsed[key] / biomesUsedSum))
  console.log("biomesUsed: ", biomesUsed)

  // Land Object
  planetLandGeometry.computeFaceNormals()
  //planetLandGeometry.computeVertexNormals()
  const planetLandMaterial = new THREE.MeshLambertMaterial({
    color: 0xd4c5ad,
    wireframe: false,
    vertexColors: THREE.VertexColors,
    flatShading: true
  })
  const planetLandObject = new THREE.Mesh(planetLandGeometry, planetLandMaterial)
  scene.add(planetLandObject)

  // Ocean Object
  //const oceanGeometry = new THREE.SphereGeometry(planetR, 32, 32)
  oceanGeometry.computeFaceNormals()
  const oceanMaterial = new THREE.MeshLambertMaterial({ color: 0x3355ee, flatShading: true })
  const oceanObject = new THREE.Mesh(oceanGeometry, oceanMaterial)
  scene.add(oceanObject)

  // River nodes
  /*
  const riverNodeMaterial = new THREE.MeshLambertMaterial({ color: 0x4488ff })
  riverNodes.forEach(planetNode => {
    const riverNodeGeometry = new THREE.SphereGeometry((planetNode.waterFlowInFull / moistureDropRange[1]) + 1, 8, 8)
    const riverNodeObject = new THREE.Mesh(riverNodeGeometry, riverNodeMaterial)
    riverNodeObject.position.set(planetNode.coords.x, planetNode.coords.y, planetNode.coords.z)
    scene.add(riverNodeObject)
  })
  */
}
