import * as THREE from "three"

const dt = 0.8
const g = 0.0002959122082855900
const au = 149597870.700
const viewMassScale = 0.001
const viewDistanceScale = 100
const masses = [
  {
    name: "Sun", //We use solar masses as the unit of mass, so the mass of the Sun is exactly 1
    m: 1,
    mkg: 1988500e24,
    x: -1.50324727873647e-6,
    y: -3.93762725944737e-6,
    z: -4.86567877183925e-8,
    vx: 3.1669325898331e-5,
    vy: -6.85489559263319e-6,
    vz: -7.90076642683254e-7,
    //r: 695700,
    r: 6957.00,
    gm: 132712440041.93938
  },
  {
    name: "Mercury",
    m: 0.00000016601141531,
    mkg: 3.302e23,
    x: -3.978619667733567E-01,
    y: -8.586039511628002E-02,
    z: 2.859672129807217E-02,
    vx: 0.000626916925608763,
    vy: -0.0261687418637525,
    vz: -0.0021963604379369,
    r: 2440,
    gm: 22031.78,
    md: 0.387
  },
  {
    name: "Venus",
    m: 0.00000244783828778,
    mkg: 48.685e23,
    x: -7.160658875615739E-01,
    y: -8.728545720965177E-02,
    z: 3.985271153540303E-02,
    vx: 0.00253279193312915,
    vy: -0.0201394751398887,
    vz: -0.000422753026873945,
    r: 6051.84,
    gm: 324858.592,
    md: 0.723
  },
  {
    name: "Earth",
    m: 0.00000300348961492,
    mkg: 5.97219e24,
    x: 9.842302434403984E-01,
    y: -1.898503134187415E-01,
    z: 5.920525664909101E-06,
    vx: 0.00308171429613959,
    vy: 0.0167987931260944,
    vz: -7.9433461700057E-08,
    r: 6371.01,
    gm: 398600.435436,
    md: 1
  },
  {
    name: "Mars",
    m: 0.00000032271560376,
    mkg: 6.4171e23,
    x: -1.599095606286884E+00,
    y: 4.773116752586937E-01,
    z: 4.900501544890948E-02,
    vx: -0.00343640672792906,
    vy: -0.0122291406676356,
    vz: -0.000171904382646091,
    r: 3389.92,
    gm: 42828.375214,
    md: 1.524
  },
  {
    // 2019-09-12
    name: "Jupiter",
    m: 0.00095459427067248,
    mkg: 1898.13e24,
    x: -3.040018881285594E-01,
    y: -5.251098606338950E+00,
    z: 2.857780999881336E-02,
    vx: 7.442779361091849E-03,
    vy: -7.692149658575444E-05,
    vz: -1.661665564193456E-04,
    r: 71492,
    gm: 126686534.911,
    md: 5.203
  },
  {
    // 2019-09-12
    name: "Saturn",
    m: 0.00005976235383430,
    mkg: 5.6834e26,
    x: 3.247978828763257E+00,
    y: -9.496228027579027E+00,
    z: 3.582131150924839E-02,
    vx: 4.970100695960967E-03,
    vy: 1.789279459098790E-03,
    vz: -2.293016450160127E-04,
    r: 60268,
    gm: 37931207.8,
    md: 9.529
  },
  {
    // 2019-09-12
    name: "Uranus",
    m: 0.00004365793681564,
    mkg: 86.813e24,
    x: 1.647190734533740E+01,
    y: 1.104684977539340E+01,
    z: -1.723675189488063E-01,
    vx: -2.219623268257755E-03,
    vy: 3.083227259794859E-03,
    vz: 4.019274772286954E-05,
    r: 25559,
    gm: 5793951.322,
    md: 19.19
  },
  {
    // 2019-09-12
    name: "Neptune",
    m: 0.00005150308062937,
    mkg: 102.413e24,
    x: 2.916527957776772E+01,
    y: -6.701863236308421E+00,
    z: -5.341313568039984E-01,
    vx: 6.817649833149638E-04,
    vy: 3.077722933902395E-03,
    vz: -7.908712065665146E-05,
    r: 24624,
    gm: 6835099.5,
    md: 30.06
  }
]

export default function createPlanetSystem (scene) {
  masses.forEach((m, i) => {
    const slices = 8 * Math.ceil(m.r / 10000)
    const color = (i === 0) ? 0xffff00 : 0xdb780d
    const geometry = new THREE.SphereGeometry(m.r * viewMassScale, slices, slices)
    const material = new THREE.MeshBasicMaterial({ color })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(m.x * viewDistanceScale, m.z * viewDistanceScale, m.y * viewDistanceScale)
    m.mesh = mesh
    scene.add(mesh)
  })

  const animate = () => {
    masses.forEach((m, i) => {
      if (i > 0) {
        updateAccelerationVectors(m, masses[0])

        m.vx += m.ax * dt / 2.0
        m.vy += m.ay * dt / 2.0
        m.vz += m.az * dt / 2.0

        m.x += m.vx * dt
        m.y += m.vy * dt
        m.z += m.vz * dt

        updateAccelerationVectors(m, masses[0])

        m.vx += m.ax * dt / 2.0
        m.vy += m.ay * dt / 2.0
        m.vz += m.az * dt / 2.0
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
