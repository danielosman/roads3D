import * as THREE from "three"

const multiuseSpherical = new THREE.Spherical()
const multiuseVector3 = new THREE.Vector3()

export default function createPlanet (scene) {
  // Lights
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.75)
  directionalLight.position.set(100, 100, 150)
  scene.add(directionalLight)
  const ambientLight = new THREE.AmbientLight(0x404040)
  scene.add(ambientLight)

  const perfT2 = performance.now()
  console.log("Lights time: ", perfT2 - perfT1)

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

  const perfT3 = performance.now()
  console.log("Delaunay time: ", perfT3 - perfT2)

  // Continents
  const continents = []
  const createContinent = i => {
    const dirX = (2 * Math.random() - 1) * maxContinentDir
    const dirY = (2 * Math.random() - 1) * maxContinentDir
    const dir = new THREE.Vector2(dirX, dirY)
    const len = dir.length()
    let nodeIndex = -1
    let ii = 0
    while ((nodeIndex < 0) || (planetNodes[nodeIndex].continent !== -1)) {
      nodeIndex = Math.floor(Math.random() * planetNodes.length)
      ii++
      if (ii > nSamples) return
    }
    planetNodes[nodeIndex].continent = i
    let h = 0
    if (Math.random() < 0.7) {
      h = -maxContinentHeight * (Math.random() * 0.9 + 0.1)
    } else {
      h = maxContinentHeight * (Math.random() * 0.9 + 0.1)
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
        planetNodes[nodeIndex].h += continent.h + (Math.random() - 0.5) * maxContinentHeight / 10
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
      if (Math.random() < addSmallContinentsProbability) {
        addSmallContinentsProbability = -addSmallContinentsProbabilityDelta
        const continent = createContinent(continents.length)
        if (continent) {
          continents.push(continent)
          nSmallContinentsAdded++
          //console.log("Added small continent: ", nSmallContinentsAdded)
        }
      }
    }
  }
  //console.log("Continents: ", continents)
  const perfT4 = performance.now()
  console.log("Continents time: ", perfT4 - perfT3)

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

  const perfT5 = performance.now()
  console.log("Tectonics time: ", perfT5 - perfT4)

  // Temperature
  planetNodes.forEach(planetNode => planetNode.t = maxTemperature - temperatureDropAtAltitude(planetNode.h) - temperatureDropAtLatitude(planetNode.point[1]))

  const perfT51 = performance.now()
  console.log("Temperature time: ", perfT51 - perfT5)

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

  const perfT52 = performance.now()
  console.log("Moisture time: ", perfT52 - perfT51)

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

  const perfT53 = performance.now()
  console.log("Erosion time: ", perfT53 - perfT52)

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

  const perfT6 = performance.now()
  console.log("Rivers time: ", perfT6 - perfT53)

  // Vertices
  const riverNodes = []
  planetNodes.forEach(planetNode => {
    // Planet Vertices
    const planetNodeCoords = new THREE.Vector3(0, 0, 0)
    multiuseSpherical.set(planetNode.h + planetR, Math.PI * (planetNode.point[1] + 90) / 180, Math.PI * planetNode.point[0] / 180)
    planetNodeCoords.setFromSpherical(multiuseSpherical)
    planetNode.coords = planetNodeCoords
    planetLandGeometry.vertices.push(planetNodeCoords)
    // Ocean Vertices
    const oceanNodeCoords = new THREE.Vector3(0, 0, 0)
    multiuseSpherical.set(planetR, Math.PI * (planetNode.point[1] + 90) / 180, Math.PI * planetNode.point[0] / 180)
    oceanNodeCoords.setFromSpherical(multiuseSpherical)
    oceanGeometry.vertices.push(oceanNodeCoords)
    // River nodes
    if (planetNode.waterFlowIn > 3) {
      planetNode.isRiverNode = true
      riverNodes.push(planetNode)
    }
  })

  const perfT7 = performance.now()
  console.log("Vertices time: ", perfT7 - perfT6)

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
  //console.log("moistureDropRange: ", moistureDropRange)

  // Rivers
  //const riverMaterial = new THREE.MeshLambertMaterial({ color: 0x3356f0 })
  const riverMaterial = new THREE.MeshBasicMaterial({ color: 0x3356f0 })
  //const riverLineMaterial = new THREE.LineBasicMaterial({ color: 0x3355ee })
  //const axis = new THREE.Vector3(0, 1, 0)
  const riverFromNodes = (nodes) => {
    //const r = ((nodes[0].waterFlowInFull + nodes[1].moistureDrop) / moistureDropRange[1]) + 1
    const r = ((nodes[0].waterFlowIn + nodes[1].moistureDrop) / (3 + moistureDropRange[1])) + 1
    const dir = (new THREE.Vector3()).subVectors(nodes[1].coords, nodes[0].coords)
    const cross = (new THREE.Vector3()).crossVectors(nodes[0].coords, nodes[1].coords).normalize()
    const riverPathGeometry = new THREE.Geometry()
    multiuseSpherical.set(nodes[0].h + planetR + 0.1, Math.PI * (nodes[0].point[1] + 90) / 180, Math.PI * nodes[0].point[0] / 180)
    const v0 = (new THREE.Vector3()).setFromSpherical(multiuseSpherical)
    riverPathGeometry.vertices.push(v0)
    riverPathGeometry.vertices.push(nodes[1].coords.clone().sub(cross.clone().multiplyScalar(r)))
    riverPathGeometry.vertices.push(nodes[1].coords.clone().add(cross.clone().multiplyScalar(r)))
    riverPathGeometry.faces.push(new THREE.Face3(0, 1, 2))
    riverPathGeometry.computeFaceNormals()
    const riverPathObject = new THREE.Mesh(riverPathGeometry, riverMaterial)
    scene.add(riverPathObject)
    //console.log("River added")
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

  const perfT8 = performance.now()
  console.log("River objects time: ", perfT8 - perfT7)

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
  const planetLandUVs = []
  const nodeTriangles = planetNodes.map(() => [])
  const planetTriangles = []
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const indexes = [delaunay.triangles[i][0], delaunay.triangles[i][1], delaunay.triangles[i][2]]
    nodeTriangles[indexes[0]].push(i)
    nodeTriangles[indexes[1]].push(i)
    nodeTriangles[indexes[2]].push(i)
    planetTriangles.push(new THREE.Triangle(planetNodes[indexes[0]].coords, planetNodes[indexes[1]].coords, planetNodes[indexes[2]].coords))
    const face = new THREE.Face3(indexes[0], indexes[1], indexes[2])
    face.vertexColors = vertexColorsForIndexes(indexes)
    planetLandGeometry.faces.push(face)
    const uvs = indexes.map(index => new THREE.Vector2((planetNodes[index].point[0] + 180) / 360, (planetNodes[index].point[1] + 90) / 180))
    if (uvs[0].x - uvs[1].x > 0.5) uvs[1].x += uvs[0].x
    if (uvs[1].x - uvs[0].x > 0.5) uvs[0].x += uvs[1].x
    if (uvs[0].x - uvs[2].x > 0.5) uvs[2].x += uvs[0].x
    if (uvs[2].x - uvs[0].x > 0.5) uvs[0].x += uvs[2].x
    if (uvs[1].x - uvs[2].x > 0.5) uvs[2].x += uvs[1].x
    if (uvs[2].x - uvs[1].x > 0.5) uvs[1].x += uvs[2].x
    planetLandUVs.push(uvs)
    const oceanFace = new THREE.Face3(indexes[0], indexes[1], indexes[2])
    oceanGeometry.faces.push(oceanFace)
  }
  planetLandGeometry.faceVertexUvs[0] = planetLandUVs
  oceanGeometry.faceVertexUvs[0] = planetLandUVs

  const perfT9 = performance.now()
  console.log("Faces and UVs time: ", perfT9 - perfT8)

  Object.keys(biomesUsed).forEach(key => biomesUsed[key] = Math.round(100 * biomesUsed[key] / biomesUsedSum))
  //console.log("biomesUsed: ", biomesUsed)

  // Land texture
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#999999'
  ctx.fillRect(0, canvas.height / 2, canvas.width, 1)
  //ctx.strokeStyle = '#ff4444'
  //ctx.strokeRect(100, 100, canvas.width / 2, canvas.height / 2)
  const canvasTexture = new THREE.CanvasTexture(canvas)
  //canvasTexture.magFilter = THREE.NearestFilter
  //canvasTexture.minFilter = THREE.NearestFilter
  canvasTexture.wrapS = THREE.RepeatWrapping

  // Land Object
  planetLandGeometry.vertices.push(planetNodeCoords)
  planetLandGeometry.faces.push(face)
  planetLandGeometry.faceVertexUvs[0] = planetLandUVs
  planetLandGeometry.computeFaceNormals()
  //planetLandGeometry.computeVertexNormals()
  planetLandGeometry.computeFlatVertexNormals()
  //const planetLandMaterial = new THREE.MeshLambertMaterial({
  const planetLandMaterial = new THREE.MeshBasicMaterial({
    color: 0xd4c5ad,
    wireframe: false,
    vertexColors: THREE.VertexColors,
    flatShading: true,
    map: canvasTexture
  })
  const planetLandObject = new THREE.Mesh(planetLandGeometry, planetLandMaterial)
  scene.add(planetLandObject)

  // Ocean Object
  oceanGeometry.computeFaceNormals()
  oceanGeometry.computeFlatVertexNormals()
  //const oceanMaterial = new THREE.MeshLambertMaterial({
  const oceanMaterial = new THREE.MeshBasicMaterial({
    color: 0x3355ee,
    flatShading: true,
    map: canvasTexture,
    //transparent: true,
    //opacity: 0.66
  })
  const oceanObject = new THREE.Mesh(oceanGeometry, oceanMaterial)
  scene.add(oceanObject)

  // River nodes
  const polarCurve = new THREE.LineCurve3(new THREE.Vector3(0, 1.1 * planetR, 0), new THREE.Vector3(0, -planetR * 1.1, 0))
  const polarCurveGeometry = new THREE.BufferGeometry().setFromPoints(polarCurve.getPoints(2))
  const polarCurveMaterial = new THREE.LineBasicMaterial({ color : 0xffffff })
  const polarCurveObject = new THREE.Line(polarCurveGeometry, polarCurveMaterial)
  scene.add(polarCurveObject)

  // Return
  const elevationAt = (lon, lat, point) => {
    const foundIndex = delaunay.find(lon, lat)
    let p = point
    if (!point) {
      multiuseSpherical.set(planetR, Math.PI * (lat + 90) / 180, Math.PI * lon / 180)
      multiuseVector3.setFromSpherical(multiuseSpherical)
      p = multiuseVector3
    }
    const foundTriangleIndex = nodeTriangles[foundIndex].find(triangleIndex => planetTriangles[triangleIndex].containsPoint(p))
    if (foundTriangleIndex === undefined) return null
    const triangle = planetTriangles[foundTriangleIndex]
    const delaunayTriangle = delaunay.triangles[foundTriangleIndex]
    triangle.getBarycoord(p, multiuseVector3)
    return planetNodes[delaunayTriangle[0]].h * multiuseVector3.x + planetNodes[delaunayTriangle[1]].h * multiuseVector3.y + planetNodes[delaunayTriangle[2]].h * multiuseVector3.z
  }

  const planet = {
    sphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), planetR),
    markerAt: point => {
      multiuseSpherical.setFromVector3(point)
      const lon = 180 * multiuseSpherical.theta / Math.PI
      const lat = (180 * multiuseSpherical.phi / Math.PI) - 90
      const markerNodes = []
      markerNodes.push({ h: elevationAt(lon, lat, point), lon: lon, lat: lat })
      markerNodes.push({ h: elevationAt(lon + 1, lat + 1), lon: lon + 1, lat: lat + 1})
      markerNodes.push({ h: elevationAt(lon + 1, lat - 1), lon: lon + 1, lat: lat - 1})
      markerNodes.push({ h: elevationAt(lon - 1, lat - 1), lon: lon - 1, lat: lat - 1})
      markerNodes.push({ h: elevationAt(lon - 1, lat + 1), lon: lon - 1, lat: lat + 1})
      markerNodes.forEach(markerNode => {
        multiuseSpherical.set(planetR + markerNode.h + 0.1, Math.PI * (markerNode.lat + 90) / 180, Math.PI * markerNode.lon / 180)
        multiuseVector3.setFromSpherical(multiuseSpherical)
        markerNode.p = multiuseVector3.clone()
      })
      return markerNodes
    }
  }

  const perfT11 = performance.now()
  console.log("Objects time: ", perfT11 - perfT10)
  console.log("All time: ", perfT11 - perfT0)

  return planet
}
