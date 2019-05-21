import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import SphereMarkerView from './building/SphereMarkerView'
import createPlanet from './land/PlanetBuilder'

const buttonPanelHeight = 60
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / (window.innerHeight - buttonPanelHeight), 1, 5000)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const sphereIntersection = new THREE.Vector3()

const cameraSpherical = new THREE.Spherical(300, Math.PI / 2, 0)
camera.position.setFromSpherical(cameraSpherical)
camera.lookAt(0, 0, 0)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.95)
directionalLight.position.set(camera.position.x, camera.position.y, camera.position.z)
scene.add(directionalLight)

renderer.setSize(window.innerWidth, window.innerHeight - buttonPanelHeight)

// DOM
const canvas = document.getElementById('canvas')
const cancelButton = document.getElementById('cancelButton')
canvas.appendChild(renderer.domElement)
const stateButtons = {
  pointOnSphereButton: document.getElementById('pointOnSphereButton')
}

// Functions
const eventToSpherePosition = function(event, planet) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / (window.innerHeight - buttonPanelHeight)) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  if (!raycaster.ray.intersectSphere(planet.sphere, sphereIntersection)) return null
  const markerNodes = planet.markerAt(sphereIntersection)
  return markerNodes[0].p
}

const onRightButton = function (event) {
  event.preventDefault()
  return false;
}

// Streams
const animation$ = Rx.interval(0, Rx.Scheduler.animationFrame)
const mouseMove$ = Rx.fromEvent(canvas, 'mousemove')
const click$ = Rx.fromEvent(canvas, 'click')
const keydown$ = Rx.fromEvent(document, 'keydown').pipe(Op.map(ev => ({ key: ev.key, v: 1 })))
const keyup$ = Rx.fromEvent(document, 'keyup').pipe(Op.map(ev => ({ key: ev.key, v: 0 })))
const pointOnSphereButton$ = Rx.fromEvent(stateButtons.pointOnSphereButton, 'click').pipe(Op.mapTo('pointOnSphere'))
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas, 'contextmenu')
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

const planet$ = Rx.from(createPlanet(scene))

const sphereMarkerView$ = Rx.of(new SphereMarkerView()).pipe(
  Op.tap(view => scene.add(view.object))
)

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

const moveCamera = function(frame, keys) {
  const rotateBy = 0.01
  let phi = cameraSpherical.phi
  let theta = cameraSpherical.theta
  if (keys.d) {
    theta += rotateBy
  }
  if (keys.a) {
    theta -= rotateBy
  }
  if (keys.s) {
    phi += rotateBy
  }
  if (keys.w) {
    phi -= rotateBy
  }
  cameraSpherical.phi = phi
  cameraSpherical.theta = theta
  cameraSpherical.makeSafe()
  camera.position.setFromSpherical(cameraSpherical)
  camera.lookAt(0, 0, 0)
  directionalLight.position.set(camera.position.x, camera.position.y, camera.position.z)
  directionalLight.lookAt(0, 0, 0)
}

animation$.pipe(
  Op.withLatestFrom(keyHandler$, moveCamera),
  Op.tap(() => renderer.render(scene, camera))
).subscribe()

canvas.addEventListener('contextmenu', onRightButton)
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / (window.innerHeight - buttonPanelHeight)
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight - buttonPanelHeight)
}, false )
