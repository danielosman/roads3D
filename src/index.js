import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import SphereMarkerView from './building/SphereMarkerView'
//import createPlanet from './land/PlanetBuilder'
import createPlanetSystem from './planetSystem/PlanetSystemBuilder'

const buttonPanelWidth = 100
const canvas = { w: window.innerWidth - buttonPanelWidth, h: window.innerHeight }
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, canvas.w / canvas.h, 1, 500000)
//const camera = new THREE.OrthographicCamera((window.innerWidth - buttonPanelWidth) / -2, (window.innerWidth - buttonPanelWidth) / 2, window.innerHeight / -2, window.innerHeight / 2, 1, 500000)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
//const renderer = new SVGRenderer({ antialias: true, alpha: true })

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const sphereIntersection = new THREE.Vector3()

const cameraObjectParent = new THREE.Mesh()
const cameraObjectChild = new THREE.Mesh()
scene.add(cameraObjectParent)
cameraObjectParent.add(cameraObjectChild)

cameraObjectChild.position.set(0, 0, 20000)
cameraObjectChild.updateMatrixWorld()
camera.matrixAutoUpdate = false
camera.position.applyMatrix4(cameraObjectChild.matrixWorld)
camera.lookAt(0, 0, 0)
camera.updateMatrix()

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
const ambientLight = new THREE.AmbientLight( 0x909090 )
//directionalLight.position.set(camera.position.x, camera.position.y, camera.position.z)
//scene.add(directionalLight)
scene.add(ambientLight)

renderer.setSize(canvas.w, canvas.h)

// DOM
canvas.elem = document.getElementById('canvas')
const cancelButton = document.getElementById('cancelButton')
canvas.elem.appendChild(renderer.domElement)
/*
const controls = new OrbitControls(camera, renderer.domElement)
controls.enabled = true
controls.enablePan = true
controls.enableRotate = true
controls.enableZoom = true
controls.update()
*/
const stateButtons = {
  pointOnSphereButton: document.getElementById('pointOnSphereButton')
}

// Functions
const eventToSpherePosition = function(event, planet) {
  mouse.x = (event.clientX / canvas.w) * 2 - 1
  mouse.y = -(event.clientY / canvas.h) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  if (!raycaster.ray.intersectSphere(planet.sphere, sphereIntersection)) return null
  const markerNodes = planet.markerAt(sphereIntersection)
  return markerNodes[0].p
}

// Streams
const animation$ = Rx.interval(0, Rx.Scheduler.animationFrame)
const mouseMove$ = Rx.fromEvent(canvas.elem, 'mousemove')
const click$ = Rx.fromEvent(canvas.elem, 'click')
const keydown$ = Rx.fromEvent(document, 'keydown').pipe(Op.map(ev => ({ key: ev.key, v: 1 })))
const keyup$ = Rx.fromEvent(document, 'keyup').pipe(Op.map(ev => ({ key: ev.key, v: 0 })))
const pointOnSphereButton$ = Rx.fromEvent(stateButtons.pointOnSphereButton, 'click').pipe(Op.mapTo('pointOnSphere'))
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas.elem, 'contextmenu')
const cancel$ = Rx.merge(cancelButton$, rightButton$).pipe(Op.mapTo('null'))
const state$ = Rx.merge(pointOnSphereButton$, cancel$).pipe(
  Op.startWith('null'),
  Op.map(state => ({ state })),
  Op.pairwise(),
  Op.map(([fromState, toState]) => toState ),
  Op.share()
)
const distinctState$ = state$.pipe(Op.distinctUntilKeyChanged('state'), Op.share())
const pointOnSphereState$ = distinctState$.pipe(Op.filter(s => s.state === 'pointOnSphere'))

/*
const sphereMarkerView$ = Rx.of(new SphereMarkerView()).pipe(
  Op.tap(view => scene.add(view.object))
)

const planet$ = Rx.from(createPlanet(scene))

pointOnSphereState$.subscribe(state => {
  console.log('Point on sphere: ', state)
  mouseMove$.pipe(
    Op.withLatestFrom(planet$),
    Op.map(([event, planet]) => eventToSpherePosition(event, planet)),
    Op.withLatestFrom(sphereMarkerView$),
    Op.tap(([p, view]) => view.setPosition(p)),
    Op.takeUntil(distinctState$),
    Op.last(),
    Op.tap(([p, view]) => view.setPosition(null)),
  ).subscribe()
})
*/

createPlanetSystem(scene, camera)

// Activate the action buttons.
distinctState$.subscribe(s => {
  Object.values(stateButtons).forEach(button => button.classList.remove('active'))
  const buttonName = s.state + 'Button'
  const button = stateButtons[buttonName]
  if (button) {
    button.classList.add('active')
  }
})

const keyHandler$ = Rx.merge(keydown$, keyup$).pipe(
  Op.startWith({ key: 'w', v: 0 }),
  Op.scan((acc, cur) => {
    acc[cur.key] = cur.v
    return acc
  }, {})
)

let tiltAngle = 0
let rotAngle = 0
const xAxis = new THREE.Vector3(1, 0, 0)
const yAxis = new THREE.Vector3(0, 1, 0)
const zAxis = new THREE.Vector3(0, 0, 1)
const qTilt = new THREE.Quaternion()
const qRot = new THREE.Quaternion()

const moveCamera = function(frame, keys) {
  const rotateBy = 0.002
  const moveBy = 10
  if (keys.r) {
    tiltAngle -= rotateBy
  }
  if (keys.f) {
    tiltAngle += rotateBy
  }
  if (keys.q) {
    rotAngle -= rotateBy
  }
  if (keys.e) {
    rotAngle += rotateBy
  }
  xAxis.set(1, 0, 0)
  yAxis.set(0, 1, 0)
  zAxis.set(0, 0, 1)
  qTilt.setFromAxisAngle(xAxis, tiltAngle)
  qRot.setFromAxisAngle(zAxis, rotAngle)
  cameraObjectParent.quaternion.multiplyQuaternions(qRot, qTilt)
  xAxis.applyQuaternion(qRot)
  yAxis.applyQuaternion(qRot)
  if (keys.d) {
    cameraObjectParent.position.addScaledVector(xAxis, moveBy)
  } else if (keys.a) {
    cameraObjectParent.position.addScaledVector(xAxis, -moveBy)
  }
  if (keys.s) {
    cameraObjectParent.position.addScaledVector(yAxis, -moveBy)
  } else if (keys.w) {
    cameraObjectParent.position.addScaledVector(yAxis, moveBy)
  }
  cameraObjectChild.updateMatrixWorld()
  camera.position.set(0, 0, 0)
  camera.position.applyMatrix4(cameraObjectChild.matrixWorld)
  camera.quaternion.setFromRotationMatrix(cameraObjectChild.matrixWorld)
  camera.updateMatrix()
  directionalLight.position.set(camera.position.x, camera.position.y, camera.position.z)
  directionalLight.lookAt(0, 0, 0)
}

animation$.pipe(
  Op.withLatestFrom(keyHandler$, moveCamera),
  Op.tap(() => {
    renderer.render(scene, camera)
  })
).subscribe()

const onRightButton = function (event) {
  event.preventDefault()
  return false;
}

const onZoom = function (event) {
  event.preventDefault()
  const zoomBy = 5
  const offsetBy = 500
  const w2 = canvas.w / 2
  const h2 = canvas.h / 2
  const offsetX = (event.offsetX - w2) / w2
  const offsetY = (event.offsetY - h2) / h2
  let x = camera.position.x
  let y = camera.position.y
  let z = camera.position.z
  //const sign = (event.deltaY > 0) ? 1 : -1
  //x += offsetBy * offsetX * sign
  //y += offsetBy * offsetY * sign
  z += zoomBy * event.deltaY
  camera.position.set(x, y, z)
  camera.updateMatrixWorld()
}

canvas.elem.addEventListener('contextmenu', onRightButton)
canvas.elem.addEventListener('wheel', onZoom)
window.addEventListener('resize', () => {
  canvas.w = window.innerWidth - buttonPanelWidth
  canvas.h = window.innerHeight
  camera.aspect = canvas.w / canvas.h
  camera.updateProjectionMatrix()
  renderer.setSize(canvas.w, canvas.h)
}, false )
