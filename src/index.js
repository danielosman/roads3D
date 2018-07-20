import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import Road from './Road'
import Marker from './Marker'

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

const marker = new Marker()
scene.add(marker.object)

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

const animate = function () {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

// Streams
const mouseMove$ = Rx.fromEvent(canvas, 'mousemove')
const click$ = Rx.fromEvent(canvas, 'click')
const currentMousePosition$ = mouseMove$.pipe(Op.map(eventToPosition))
const addRoadButton$ = Rx.fromEvent(addRoadButton, 'click')
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas, 'contextmenu')
const cancel$ = Rx.merge(cancelButton$, rightButton$)
const state$ = new Rx.Observable(subscriber => {
  addRoadButton$.subscribe(() => subscriber.next('addRoad'))
  cancel$.subscribe(() => subscriber.next('cancel'))
})
const addRoadState$ = state$.pipe(Op.filter(state => 'addRoad' === state))

addRoadState$.subscribe(() => {
  const point$ = click$.pipe(
    Op.map(eventToPosition),
    Op.takeUntil(cancel$),
    Op.share()
  )
  marker.initCircle(3)
  const road = new Road()
  road.setPointStream(point$)
  marker.setPointStream(point$)
  scene.add(road.object)
  point$.subscribe(undefined, undefined, () => {
    if (road.isEmpty()) {
      scene.remove(road.object)
      console.log("Removed empty road")
    }
  })
})

marker.setPositionsStream(currentMousePosition$)
canvas.addEventListener('contextmenu', onRightButton)

animate()
