import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import Road from './Road'
import RoadBuilder from './RoadBuilder'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000)
const renderer = new THREE.WebGLRenderer()

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
const planeIntersection = new THREE.Vector3()

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2)
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide })
const groundObject = new THREE.Mesh(groundGeometry, groundMaterial)
scene.add(groundObject)

const roadBuilder = new RoadBuilder()
scene.add(roadBuilder.object)

camera.position.z = 500
renderer.setSize(window.innerWidth, window.innerHeight - 50)

// DOM
const canvas = document.getElementById('canvas')
const addRoadButton = document.getElementById('addRoadButton')
const cancelButton = document.getElementById('cancelButton')
canvas.appendChild(renderer.domElement)

// Functions
const eventToPosition = function(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / (window.innerHeight - 50)) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  raycaster.ray.intersectPlane(plane, planeIntersection)
  return planeIntersection
}

const onRightButton = function (event) {
  event.preventDefault()
  return false;
}

const handleStateTransition = function(prev, curr) {
  if (prev.state === 'addRoad' && curr.state !== 'addRoad') {
    if (curr.state === 'null') {
      return roadBuilder.cancel()
    } else {
      roadBuilder.cancelAll()
    }
  }
  return curr
}

const animate = function () {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

// Streams
const mouseMove$ = Rx.fromEvent(canvas, 'mousemove')
const click$ = Rx.fromEvent(canvas, 'click')
const addRoadButton$ = Rx.fromEvent(addRoadButton, 'click')
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas, 'contextmenu')
const cancel$ = Rx.merge(cancelButton$, rightButton$)
const state$ = new Rx.Observable(subscriber => {
  addRoadButton$.subscribe(() => subscriber.next({ state: 'addRoad', settings: { r: 3 } }))
  cancel$.subscribe(() => subscriber.next({ state: 'null' }))
}).pipe(Op.scan(handleStateTransition, { state: 'null' }), Op.share())
const distinctState$ = state$.pipe(Op.distinctUntilChanged((s1, s2) => s1.state === s2.state), Op.share())
const addRoadState$ = distinctState$.pipe(Op.filter(s => s.state === 'addRoad'))

addRoadState$.subscribe(state => {
  console.log('Adding road: ', state)
  const position$ = mouseMove$.pipe(
    Op.map(eventToPosition),
    // map snapping
    Op.takeUntil(distinctState$)
  )
  const point$ = click$.pipe(
    Op.withLatestFrom(position$),
    Op.map(([ev, pos]) => pos),
    Op.takeUntil(distinctState$),
    Op.share()
  )
  const settings$ = state$.pipe(
    Op.takeWhile(s => s.state === 'addRoad'),
    Op.startWith(state),
    Op.map(s => s.settings)
  )
  roadBuilder.setSettingsStream(settings$)
  roadBuilder.setPositionStream(position$)
  roadBuilder.setPointStream(point$)

  const road = new Road()
  road.setPointStream(point$)

  scene.add(road.object)
  point$.subscribe(undefined, undefined, () => {
    console.log('Ending addRoad')
    if (road.isEmpty()) {
      scene.remove(road.object)
      console.log("Removed empty road")
    }
  })
})

canvas.addEventListener('contextmenu', onRightButton)

animate()
