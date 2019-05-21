const express = require('express')
const seedrandom = require('seedrandom')
const THREE = require('three')
const { geoDelaunay } = require('d3-geo-voronoi')
const { scaleThreshold, scaleLinear, scaleQuantize } = require('d3-scale')
const { extent } = require('d3-array')
const { geoDistance } = require('d3-geo')

const router = express.Router()

router.get('/', (req, res) => {
  const rng = seedrandom.xor4096('hello.')
  const planetR = 100
  const maxTemperature = 40
  const nSamples = 25
  const nPoints = 400
  const maxContinentHeight = planetR / 100
  const maxContinentDir = 2
  const continentForceFactor = 0.5
  const nContinents = 8
  const nSmallContinents = 8

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

  const multiuseSpherical = new THREE.Spherical()
  const multiuseVector3 = new THREE.Vector3()

  const planetPoints = [[-180, 0], [0, 90], [0, -90]]
  for (let i = 0; i < nPoints; i++) {
    let chosenSample0 = null
    let maxDistance = 0
    const nPlanetPoints = planetPoints.length
    for (let j = 0; j < nSamples; j++) {
      const point0 = [(2 * rng() - 1) * 180, (2 * rng() - 1) * 90]
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
  const lonExtent = extent(planetPoints, point => point[0])
  const latExtent = extent(planetPoints, point => point[1])
  //console.log("lon, lat extents: ", lonExtent, latExtent)

  // Initialize planet nodes
  const delaunay = geoDelaunay(planetPoints)
  const planetNodes = planetPoints.map((point, i) => ({
    continent: -1,
    h: 0, t: 0, point, i,
    moistureFromNeighbors: 0,
    moistureDrop: 0,
    moisture: 0,
    waterFlowIn: 0,
    triangles: []
  }))

  // Continents
  const continents = []
  const createContinent = i => {
    const dirX = (2 * rng() - 1) * maxContinentDir
    const dirY = (2 * rng() - 1) * maxContinentDir
    const dir = new THREE.Vector2(dirX, dirY)
    const len = dir.length()
    let nodeIndex = -1
    let ii = 0
    while ((nodeIndex < 0) || (planetNodes[nodeIndex].continent !== -1)) {
      nodeIndex = Math.floor(rng() * planetNodes.length)
      ii++
      if (ii > nSamples) return
    }
    planetNodes[nodeIndex].continent = i
    let h = 0
    if (rng() < 0.7) {
      h = -maxContinentHeight * (rng() * 0.9 + 0.1)
    } else {
      h = maxContinentHeight * (rng() * 0.9 + 0.1)
    }
    return { nodes: [nodeIndex], h, dir, len, isExpanding: true, nodeIndexToExpand: 0, size: 1 }
  }
  for (let i = 0; i < nContinents; i++) {
    const continent = createContinent(i)
    if (continent) continents.push(continent)
  }

  // Expand continents
  let nNotExpandingContinents = 0
  const addSmallContinentsProbabilityDelta = (nContinents / nPoints) * nSmallContinents / 2
  let addSmallContinentsProbability = -addSmallContinentsProbabilityDelta
  let nSmallContinentsAdded = 0
  while (nNotExpandingContinents < continents.length) {
    continents.forEach(function (continent, continentIndex) {
      if (continent.isExpanding) {
        const nodeIndex = continent.nodes[continent.nodeIndexToExpand]
        planetNodes[nodeIndex].h += continent.h + (rng() - 0.5) * maxContinentHeight / 10
        const neighbors = Array.from(delaunay.neighbors[nodeIndex])
        neighbors.forEach(function (neighbor) {
          if (planetNodes[neighbor].continent === -1) {
            planetNodes[neighbor].continent = continentIndex
            continent.nodes.push(neighbor)
            continent.size++
          }
        })
        continent.nodeIndexToExpand++
        if (continent.nodeIndexToExpand >= continent.nodes.length) {
          nNotExpandingContinents++
          delete continent.isExpanding
          delete continent.nodeIndexToExpand
        }
      }
    })
    if (nSmallContinentsAdded < nSmallContinents) {
      addSmallContinentsProbability += addSmallContinentsProbabilityDelta
      if (rng() < addSmallContinentsProbability) {
        addSmallContinentsProbability = -addSmallContinentsProbabilityDelta
        const continent = createContinent(continents.length)
        if (continent) {
          continents.push(continent)
          nSmallContinentsAdded++
        }
      }
    }
  }

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
      dh = forceFactor * force
      planetNodes[p0Index].h += dh
      planetNodes[p1Index].h += dh
      // 1 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p1Index][0], planetPoints[p2Index][1] - planetPoints[p1Index][1]).normalize()
      force = dirVector.dot(continents[c1Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = forceFactor * force
      planetNodes[p1Index].h += dh
      planetNodes[p2Index].h += dh
      // 0 -> 2
      dirVector.set(planetPoints[p2Index][0] - planetPoints[p2Index][0], planetPoints[p1Index][1] - planetPoints[p0Index][1]).normalize()
      force = dirVector.dot(continents[c0Index].dir)
      force -= dirVector.dot(continents[c2Index].dir)
      dh = forceFactor * force
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
  const oceanNodes = []
  planetNodes.forEach(planetNode => {
    // Planet Vertices
    const planetNodeCoords = new THREE.Vector3(0, 0, 0)
    multiuseSpherical.set(planetNode.h + planetR, Math.PI * (planetNode.point[1] + 90) / 180, Math.PI * planetNode.point[0] / 180)
    planetNodeCoords.setFromSpherical(multiuseSpherical)
    planetNode.coords = planetNodeCoords
    // Ocean Vertices
    const oceanNodeCoords = new THREE.Vector3(0, 0, 0)
    multiuseSpherical.set(planetR, Math.PI * (planetNode.point[1] + 90) / 180, Math.PI * planetNode.point[0] / 180)
    oceanNodeCoords.setFromSpherical(multiuseSpherical)
    oceanNodes.push({ coords: oceanNodeCoords })
    // River nodes
    if (planetNode.waterFlowIn > 3) {
      planetNode.isRiverNode = true
      riverNodes.push({ nodes: [planetNode.i] })
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

  // Rivers
  const riverFromNodes = (nodes) => {
    const r = ((nodes[0].waterFlowIn + nodes[1].moistureDrop) / (3 + moistureDropRange[1])) + 1
    const cross = (new THREE.Vector3()).crossVectors(nodes[0].coords, nodes[1].coords).normalize()
    multiuseSpherical.set(nodes[0].h + planetR + 0.1, Math.PI * (nodes[0].point[1] + 90) / 180, Math.PI * nodes[0].point[0] / 180)
    const v0 = (new THREE.Vector3()).setFromSpherical(multiuseSpherical)
    return [v0, nodes[1].coords.clone().sub(cross.clone().multiplyScalar(r)), nodes[1].coords.clone().add(cross.clone().multiplyScalar(r))]
  }
  riverNodes.forEach(riverNode => {
    const planetNode = planetNodes[riverNode.nodes[0]]
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
      riverNode.nodes.push(chosenNeighbor.i)
      riverNode.coords = riverFromNodes([planetNode, chosenNeighbor])
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
      const r = 1 - 0.1 * rng()
      const c = new THREE.Color(r, r, r)
      color.lerp(c, 0.05 * rng())
      return color
    })
  }
  const planetLandUVs = []
  const planetTriangles = []
  const oceanTriangles = []
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const indexes = [delaunay.triangles[i][0], delaunay.triangles[i][1], delaunay.triangles[i][2]]
    planetNodes[indexes[0]].triangles.push(i)
    planetNodes[indexes[1]].triangles.push(i)
    planetNodes[indexes[2]].triangles.push(i)
    planetTriangles.push({ indexes, vertexColors: vertexColorsForIndexes(indexes) })
    const uvs = indexes.map(index => new THREE.Vector2((planetNodes[index].point[0] + 180) / 360, (planetNodes[index].point[1] + 90) / 180))
    if (uvs[0].x - uvs[1].x > 0.5) uvs[1].x += uvs[0].x
    if (uvs[1].x - uvs[0].x > 0.5) uvs[0].x += uvs[1].x
    if (uvs[0].x - uvs[2].x > 0.5) uvs[2].x += uvs[0].x
    if (uvs[2].x - uvs[0].x > 0.5) uvs[0].x += uvs[2].x
    if (uvs[1].x - uvs[2].x > 0.5) uvs[2].x += uvs[1].x
    if (uvs[2].x - uvs[1].x > 0.5) uvs[1].x += uvs[2].x
    planetLandUVs.push(uvs)
    oceanTriangles.push({ indexes })
  }

  Object.keys(biomesUsed).forEach(key => biomesUsed[key] = Math.round(100 * biomesUsed[key] / biomesUsedSum))

  const planet = { planetR, planetNodes, oceanNodes, planetTriangles, oceanTriangles, continents, riverNodes, planetLandUVs }
  res.json(planet)
})

module.exports = router
