import * as THREE from "three"
import { quadtree } from 'd3-quadtree'
import { geoDelaunay } from 'd3-geo-voronoi'
import { scaleThreshold, scaleLinear } from 'd3-scale'

const planetR = 100
const maxTemperature = 40
const nSamples = 30
const nPoints = 600
const maxContinentHeight = planetR / 50
const maxContinentDir = 2
const continentForceFactor = 0.5

const q0 = quadtree()
const q1 = quadtree()
const planetPoints = []

function shiftedLonLat(point0) {
  let lon = point0[0] + 180
  let lat = point0[1] + 90
  if (lon >= 180) lon -= 360
  if (lat >= 90) lat -= 180
  return [lon, lat]
}

const temperatureDropAtLatitude = scaleLinear().domain([-90, -60, -30, 0, 30, 60, 90]).range([50, 24, 6, 0, 6, 24, 50])
const temperatureDropAtAltitude = scaleLinear().domain([-maxContinentHeight, 0, maxContinentHeight]).range([0, 0, 25])
const moistureAddAtTemperature = scaleLinear().domain([-10, maxTemperature + 10]).range([0, 1])
const moistureDropAtAltitude = scaleLinear().domain([0, maxContinentHeight * 3]).range([0.05, 1])
const windDirAtLatitude = scaleThreshold().domain([-60, -30, 0, 30, 60]).range([
  (new THREE.Vector2(-1, 1)).normalize(),
  (new THREE.Vector2(1, -1)).normalize(),
  (new THREE.Vector2(-1, 1)).normalize(),
  (new THREE.Vector2(-1, -1)).normalize(),
  (new THREE.Vector2(1, 1)).normalize(),
  (new THREE.Vector2(-1, -1)).normalize()
])

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
  const planetNodes = planetPoints.map((point, i) => ({ continent: -1, h: planetR, t: 0, point, i, moistureFromNeighbors: 0, moistureDrop: 0 }))

  // Continents
  const continentColors = [
    new THREE.Color(0xd4c5ad), // almost frozen
    new THREE.Color(0x78430d), // mountain
    new THREE.Color(0xc19e18), // desert
    new THREE.Color(0xa25017),
    new THREE.Color(0x58230d),
    new THREE.Color(0xc27037),
    new THREE.Color(0xa17e08),
  ]
  const continents = continentColors.map((color, i) => {
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

  // Heights based on tectonics
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
  }

  // Temperature
  planetNodes.forEach(planetNode => planetNode.t = maxTemperature - temperatureDropAtAltitude(planetNode.h - planetR) - temperatureDropAtLatitude(planetNode.point[1]))

  // Moisture
  const moistureTravel = (moisture, planetNode) => {
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
          windNeighbors.push({ dot, i: neighborIndex })
        }
      })
      windNeighbors.forEach(windNeighbor => windNeighbor.frac = windNeighbor.dot / dotSum)
      planetNode.windNeighbors = windNeighbors
    }
    const h = Math.max(planetNode.h - planetR, 0)
    const waterNode = (h <= 0) ? 1 : 0
    const moistureDrop = Math.min(moistureDropAtAltitude(h), moisture)
    //console.log("moistureDrop: ", moistureDrop, planetNode.i)
    planetNode.moistureDrop += moistureDrop
    moisture -= moistureDrop
    if (moisture <= 0) return
    planetNode.windNeighbors.forEach(windNeighbor => {
      const neighborNode = planetNodes[windNeighbor.i]
      const neighborH = Math.max(neighborNode.h - planetR, 0)
      let moisturePassed = windNeighbor.frac * moisture
      if (neighborH > h) {
        const md = moistureDropAtAltitude(neighborH - h)
        if (waterNode) {
          neighborNode.moistureDrop += Math.min(md, moisturePassed)
        } else {
          planetNode.moistureDrop += Math.min(md, moisturePassed)
        }
        moisturePassed -= md
      }
      if (moisturePassed > 0) {
        if (!neighborNode.windNeighbors) {
          neighborNode.moistureFromNeighbors += moisturePassed
        } else {
          moistureTravel(moisturePassed, neighborNode)
        }
      }
    })
  }
  planetNodes.forEach(planetNode => {
    const h = Math.max(planetNode.h - planetR, 0)
    const waterNode = (h <= 0) ? 1 : 0
    let moistureAdd = waterNode * moistureAddAtTemperature(planetNode.t)
    //console.log("moistureAdd: ", moistureAdd)
    if (!planetNode.windNeighbors && planetNode.moistureFromNeighbors) {
      moistureAdd += planetNode.moistureFromNeighbors
    }
    if (moistureAdd > 0) {
      moistureTravel(moistureAdd, planetNode)
    }
  })

    // Vertices
  planetNodes.forEach(planetNode => {
    const planetNodeCoords = new THREE.Vector3(0, 0, 0)
    const spherical = new THREE.Spherical(planetNode.h, Math.PI * (planetNode.point[1] + 90) / 180, 2 * Math.PI * (planetNode.point[0] + 180) / 360)
    planetNodeCoords.setFromSpherical(spherical)
    planetLandGeometry.vertices.push(planetNodeCoords)
  })

  console.log("planetNodes: ", planetNodes.filter(n => n.moistureDrop > 0))

  // Faces
  const vertexColorsForIndexes = indexes => {
    return indexes.map(index => {
      const planetNode = planetNodes[index]
      let color = null
      if (planetNode.moistureDrop > 0.2) {
        if (planetNode.t > 20) {
          // Tropics
          color = new THREE.Color(0x48d32d)
        } else if (planetNode.t > 10) {
          // Temperate
          color = new THREE.Color(0x18a30d)
        } else if (planetNode.t > 0) {
          // Tundra
          color = new THREE.Color(0xd4e6ad)
        } else {
          // Snow
          color = new THREE.Color(0xe4e5ed)
        }
      } else {
        if (planetNode.t > 20) {
          // Desert
          color = new THREE.Color(0xd59e18)
        } else if (planetNode.t > 10) {
          // Step
          color = new THREE.Color(0xcfde18)
        } else if (planetNode.t > 0) {
          // Plains
          color = new THREE.Color(0xd4a84a)
        } else {
          // Snow
          color = new THREE.Color(0xe4e5ed)
        }
      }
      const r = 1 - 0.1 * Math.random()
      const c = new THREE.Color(r, r, r)
      color.lerp(c, 0.05 * Math.random())
      return color
    })
  }
  for (let i = 0; i < delaunay.triangles.length; i++) {
    const indexes = [delaunay.triangles[i][0], delaunay.triangles[i][1], delaunay.triangles[i][2]]
    const face = new THREE.Face3(indexes[0], indexes[1], indexes[2])
    const nodesAboveSealevel = indexes.filter(index => planetNodes[index].h > 0).length
    const sumOfNodeMoistureDrop = indexes.reduce((acc, index) => acc + planetNodes[index].moistureDrop, 0)
    const averageTemperature = indexes.reduce((acc, index) => acc + planetNodes[index].t, 0) / 3
    const maxSlope = indexes.reduce((acc, index, i) => {
      const otherI = i === 2 ? 0 : i + 1
      const slope = Math.abs(planetNodes[index].h - planetNodes[indexes[otherI]].h)
      return slope > acc ? slope : acc
    }, 0)
    let color = new THREE.Color(0xd4c5ad)
    if (maxSlope > 2 * maxContinentHeight) {
      // Mountain
      color = new THREE.Color(0x78430d)
    } else {
      if (sumOfNodeMoistureDrop > 0.3) {
        if (averageTemperature > 20) {
          // Tropics
          color = new THREE.Color(0x48d32d)
        } else if (averageTemperature > 10) {
          // Temperate
          color = new THREE.Color(0x18a30d)
        } else if (averageTemperature > 0) {
          // Tundra
          color = new THREE.Color(0xd4c5ad)
        } else {
          // Snow
          color = new THREE.Color(0xe4e5ed)
        }
      } else {
        if (averageTemperature > 20) {
          // Desert
          color = new THREE.Color(0xc19e18)
        } else if (averageTemperature > 10) {
          // Step
          color = new THREE.Color(0xc1de18)
        } else if (averageTemperature > 0) {
          // Plains
          color = new THREE.Color(0xd4c5ad)
        } else {
          // Snow
          color = new THREE.Color(0xe4e5ed)
        }
      }
    }
    const r = 1 - 0.1 * Math.random()
    const c = new THREE.Color(r, r, r)
    color.lerp(c, 0.05 * Math.random())
    face.color = color
    face.vertexColors = vertexColorsForIndexes(indexes)
    planetLandGeometry.faces.push(face)
  }

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
  const oceanGeometry = new THREE.SphereGeometry(planetR, 32, 32)
  const oceanMaterial = new THREE.MeshLambertMaterial({ color: 0x2244dd })
  const oceanObject = new THREE.Mesh(oceanGeometry, oceanMaterial);
  scene.add(oceanObject);
}
