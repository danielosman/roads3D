import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import RoadBuilder from './road/RoadBuilder'
import IntersectionPoint from "./road/IntersectionPoint"
import DesignedRoadSegmentView from "./road/DesignedRoadSegmentView"

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 5000)
const renderer = new THREE.WebGLRenderer()

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
const planeIntersection = new THREE.Vector3()

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2)
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0xd4c5ad, side: THREE.DoubleSide })
const groundObject = new THREE.Mesh(groundGeometry, groundMaterial)

const roadBuilder = new RoadBuilder()
const roadSegments = []
const roadSegmentNodes = []
const buttonPanelHeight = 60

camera.position.z = 500
renderer.setSize(window.innerWidth, window.innerHeight - buttonPanelHeight)

scene.add(groundObject)

// DOM
const canvas = document.getElementById('canvas')
const cancelButton = document.getElementById('cancelButton')
canvas.appendChild(renderer.domElement)
const stateButtons = {
  addRoadButton: document.getElementById('addRoadButton')
}

// Functions
const eventToPosition = function(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / (window.innerHeight - buttonPanelHeight)) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  raycaster.ray.intersectPlane(plane, planeIntersection)
  return planeIntersection
}

const onRightButton = function (event) {
  event.preventDefault()
  return false;
}

const prepareIntersectionPoint = function(point) {
  return IntersectionPoint.initMinPoint(point)
}

const snapToRoadSegment = function(intersectionPoint) {
  return roadSegments.reduce((minPoint, segment) => segment.distanceTo(intersectionPoint.originalPoint, minPoint), intersectionPoint)
}

const snapToNode = function (intersectionPoint) {
  if (!pos.snapped) return pos
  if (pos.t < 2 * pos.road.r) {
    pos.t = 0
    pos.p = pos.road.getPoint(pos.i)
    return pos
  }
  const segment = pos.road.getSegment(pos.i)
  if (pos.t > segment.len - 2 * pos.road.r) {
    pos.t = 0
    pos.i += 1
    pos.p = pos.road.getPoint(pos.i)
    if (pos.i === pos.road.numOfSegments) {
      pos.i -= 1
      pos.t = segment.len
    }
    return pos
  }
  return pos
}

// Streams
const designedSegmentRender$ = new Rx.Subject()
const animation$ = Rx.interval(0, Rx.Scheduler.animationFrame)
const mouseMove$ = Rx.fromEvent(canvas, 'mousemove')
const click$ = Rx.fromEvent(canvas, 'click')
const addRoadButton$ = Rx.fromEvent(stateButtons.addRoadButton, 'click').pipe(Op.mapTo('addRoad'))
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas, 'contextmenu')
const cancel$ = Rx.merge(cancelButton$, rightButton$).pipe(Op.mapTo('null'))
const state$ = Rx.merge(addRoadButton$, cancel$).pipe(
  Op.startWith('null'),
  Op.map(state => ({ state })),
  Op.pairwise(),
  Op.map(roadBuilder.handleStateTransition.bind(roadBuilder)),
  Op.share()
)
const distinctState$ = state$.pipe(Op.distinctUntilKeyChanged('state'), Op.share())
const addRoadState$ = distinctState$.pipe(Op.filter(s => s.state === 'addRoad'))

addRoadState$.subscribe(state => {
  console.log('Building road: ', state)
  const designedSegmentFromMove$ = mouseMove$.pipe(
    Op.sample(animation$),
    Op.map(eventToPosition),
    Op.map(prepareIntersectionPoint),
    Op.map(snapToRoadSegment),
    // Op.map(snapToNode),
    // Op.distinctUntilChanged((pos1, pos2) => pos1.p.x === pos2.p.x && pos1.p.y === pos2.p.y),
    Op.map(roadBuilder.confirmSnap.bind(roadBuilder)),
    Op.map(roadBuilder.modifyRoadSegment.bind(roadBuilder)),
    // Op.map(check for collisions)
    Op.takeUntil(distinctState$)
  )
  const designedSegmentFromState$ = state$.pipe(
    Op.mapTo(roadBuilder.designedRoadSegment),
    Op.tap(s => console.log('Segment from state change: ', s)),
    Op.takeUntil(distinctState$)
  )
  const newStep$ = click$.pipe(
    Op.mapTo(roadBuilder.designedRoadSegment),
    Op.map(roadBuilder.addStep.bind(roadBuilder)),
    Op.takeUntil(distinctState$)
  )
  const designedSegmentFromClick$ = newStep$.pipe(
    Op.pluck('designedSegment'),
    Op.tap(s => console.log('Segment from click: ', s)),
  )
  const designedSegment$ = Rx.merge(designedSegmentFromMove$, designedSegmentFromState$, designedSegmentFromClick$)
  /*
  const point$ = click$.pipe(
    Op.withLatestFrom(position$),
    Op.map(([ev, pos]) => pos),
    Op.takeUntil(distinctState$),
    Op.share()
  )
  */
  // Send designed segment to the rendering stream.
  designedSegment$.subscribe(designedSegment => designedSegmentRender$.next(designedSegment), undefined, () => designedSegmentRender$.next(null))
  /*
  roadBuilder.roadStream.subscribe(road => {
    scene.add(road.object)
    roads.push(road)
  })
  */
  /*
  segment$.subscribe(roadSegment => {
    console.log('built road segment: ', roadSegment)
  })
  */
})

designedSegmentRender$.pipe(
  Op.scan((designedSegmentView, designedSegment) => {
    let view = designedSegmentView
    if (view !== null) {
      view.buildObject(designedSegment)
    } else if (designedSegment !== null) {
      view = new DesignedRoadSegmentView(designedSegment)
      scene.add(view.object)
    }
    return view
  }, null)
).subscribe()

// Activate the action buttons.
distinctState$.subscribe(s => {
  Object.values(stateButtons).forEach(button => button.classList.remove('active'))
  const buttonName = s.state + 'Button'
  const button = stateButtons[buttonName]
  if (button) {
    button.classList.add('active')
  }
})

animation$.subscribe(() => {
  renderer.render(scene, camera)
})

canvas.addEventListener('contextmenu', onRightButton)
