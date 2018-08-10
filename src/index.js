import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import RoadBuilder from './road/RoadBuilder'
import IntersectionPoint from "./road/IntersectionPoint"
import DesignedRoadSegmentView from "./road/DesignedRoadSegmentView"
import RoadSegmentView from "./road/RoadSegmentView"
import SegmentNodeView from "./road/SegmentNodeView"

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
  if (intersectionPoint.snapped) return intersectionPoint
  return roadSegments.reduce((minPoint, segment) => segment.distanceToSquared(intersectionPoint.originalPoint, minPoint), intersectionPoint)
}

const snapToNode = function (intersectionPoint) {
  return roadSegmentNodes.reduce((minPoint, node) => node.distanceToSquared(intersectionPoint.originalPoint, minPoint), intersectionPoint)
}

const enlistRoadSegment = function (segment) {
  if (!segment.enlisted) {
    roadSegments.push(segment)
    segment.enlisted = true
  }
}

const enlistRoadSegmentNode = function (node) {
  if (!node.enlisted) {
    roadSegmentNodes.push(node)
    node.enlisted = true
  }
}

// Streams
const designedSegmentRender$ = new Rx.Subject()
const newRoadSegmentRender$ = new Rx.Subject()
const newRoadSegmentNodeRender$ = new Rx.Subject()
const animation$ = Rx.interval(0, Rx.Scheduler.animationFrame)
const mouseMove$ = Rx.fromEvent(canvas, 'mousemove')
const click$ = Rx.fromEvent(canvas, 'click')
const keydown$ = Rx.fromEvent(document, 'keydown').pipe(Op.map(ev => ({ key: ev.key, v: 1 })))
const keyup$ = Rx.fromEvent(document, 'keyup').pipe(Op.map(ev => ({ key: ev.key, v: 0 })))
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
    Op.map(snapToNode),
    Op.map(roadBuilder.confirmSnap.bind(roadBuilder)),
    Op.map(snapToRoadSegment),
    // Op.distinctUntilChanged((pos1, pos2) => pos1.p.x === pos2.p.x && pos1.p.y === pos2.p.y),
    Op.map(roadBuilder.confirmSnap.bind(roadBuilder)),
    Op.map(roadBuilder.modifyRoadSegment.bind(roadBuilder)),
    // Op.map(check for collisions)
    Op.takeUntil(distinctState$)
  )
  const designedSegmentFromState$ = state$.pipe(
    Op.map(() => roadBuilder.designedRoadSegment),
    Op.takeUntil(distinctState$)
  )
  const newStep$ = click$.pipe(
    Op.map(() => roadBuilder.designedRoadSegment),
    Op.map(roadBuilder.addStep.bind(roadBuilder)),
    Op.takeUntil(distinctState$),
    Op.share()
  )
  const designedSegmentFromClick$ = newStep$.pipe(
    Op.pluck('designedSegment')
  )
  const designedSegment$ = Rx.merge(designedSegmentFromMove$, designedSegmentFromState$, designedSegmentFromClick$)

  // Send designed segment to the rendering stream.
  designedSegment$.subscribe(designedSegment => designedSegmentRender$.next(designedSegment), undefined, () => designedSegmentRender$.next(null))

  newStep$.pipe(
    Op.pluck('newRoadSegments'),
    Op.filter(arr => arr && arr.length),
    Op.concatMap(arr => Rx.from(arr))
  ).subscribe(roadSegment => newRoadSegmentRender$.next(roadSegment))

  newStep$.pipe(
    Op.pluck('newRoadSegmentNodes'),
    Op.filter(arr => arr && arr.length),
    Op.concatMap(arr => Rx.from(arr))
  ).subscribe(roadSegmentNode => newRoadSegmentNodeRender$.next(roadSegmentNode))
})

const designedSegmentView$ = Rx.of(new DesignedRoadSegmentView()).pipe(
  Op.tap(view => scene.add(view.object))
)
designedSegmentRender$.pipe(
  Op.withLatestFrom(designedSegmentView$, (designedSegment, view) => view.buildObject(designedSegment))
).subscribe()

newRoadSegmentRender$.pipe(
  Op.tap(enlistRoadSegment),
  Op.tap(roadSegment => {
    console.log('Built RoadSegment: ', roadSegment)
    const view = roadSegment.view || new RoadSegmentView()
    view.buildObject(roadSegment)
    scene.add(view.object)
  })
).subscribe()

newRoadSegmentNodeRender$.pipe(
  Op.tap(enlistRoadSegmentNode),
  Op.tap(roadSegmentNode => {
    const view = roadSegmentNode.view || new SegmentNodeView()
    view.buildObject(roadSegmentNode)
    scene.add(view.object)
  })
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

const keyHandler$ = Rx.merge(keydown$, keyup$).pipe(
  Op.startWith({ key: 'w', v: 0 }),
  Op.scan((acc, cur) => {
    acc[cur.key] = cur.v
    return acc
  }, {})
)

const hVector = new THREE.Vector3(1, 0, 0)
const vVector = new THREE.Vector3(0, 1, 0)

const moveCamera = function(frame, keys) {
  const moveBy = 2
  const rotateBy = 0.01
  let hLen = 0
  let vLen = 0
  if (keys.d) {
    hLen += moveBy
  }
  if (keys.a) {
    hLen -= moveBy
  }
  if (keys.s) {
    vLen -= moveBy
  }
  if (keys.w) {
    vLen += moveBy
  }
  if (hLen) camera.translateOnAxis(hVector, hLen)
  if (vLen) camera.translateOnAxis(vVector, vLen)
  let rot = 0
  if (keys.q) {
    rot += rotateBy
  }
  if (keys.e) {
    rot -= rotateBy
  }
  if (rot) camera.rotateZ(rot)
  rot = 0
  if (keys.r) {
    rot += rotateBy
  }
  if (keys.f) {
    rot -= rotateBy
  }
  if (rot) camera.rotateX(rot)
}

animation$.pipe(
  Op.withLatestFrom(keyHandler$, moveCamera),
  Op.tap(() => renderer.render(scene, camera))
).subscribe()

canvas.addEventListener('contextmenu', onRightButton)
