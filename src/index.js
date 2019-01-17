import * as THREE from 'three'
import * as Rx from 'rxjs'
import * as Op from 'rxjs/operators'
import RoadBuilder from './road/RoadBuilder'
import IntersectionPoint from './road/IntersectionPoint'
import DesignedRoadSegmentView from './road/DesignedRoadSegmentView'
import RoadSegmentView from './road/RoadSegmentView'
import SegmentNodeView from './road/SegmentNodeView'
import createLand from './land/LandBuilder'
import createPlanet from './land/PlanetBuilder'

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
const planeIntersection = new THREE.Vector3()
const sphereIntersection = new THREE.Vector3()

const groundGeometry = new THREE.PlaneGeometry(2000, 2000, 2, 2)
const groundMaterial = new THREE.MeshBasicMaterial({ color: 0x2244dd, side: THREE.FrontSide })
const groundObject = new THREE.Mesh(groundGeometry, groundMaterial)

const roadBuilder = new RoadBuilder()
const roadSegments = []
const roadSegmentNodes = []
const buttonPanelHeight = 60

const cameraSpherical = new THREE.Spherical(300, Math.PI / 2, 0)
camera.position.setFromSpherical(cameraSpherical)
camera.lookAt(0, 0, 0)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25)
directionalLight.position.set(camera.position.x, camera.position.y, camera.position.z)
scene.add(directionalLight)

renderer.setSize(window.innerWidth, window.innerHeight - buttonPanelHeight)

const planetMarkerGeometry = new THREE.Geometry()
planetMarkerGeometry.vertices.push(new THREE.Vector3(0, 0, 200))
planetMarkerGeometry.vertices.push(new THREE.Vector3(10, 10, 200))
planetMarkerGeometry.vertices.push(new THREE.Vector3(10, -10, 200))
planetMarkerGeometry.vertices.push(new THREE.Vector3(-10, -10, 200))
planetMarkerGeometry.vertices.push(new THREE.Vector3(-10, 10, 200))
planetMarkerGeometry.faces.push(new THREE.Face3(0, 2, 1))
planetMarkerGeometry.faces.push(new THREE.Face3(0, 3, 2))
planetMarkerGeometry.faces.push(new THREE.Face3(0, 4, 3))
planetMarkerGeometry.faces.push(new THREE.Face3(0, 1, 4))
planetMarkerGeometry.computeFaceNormals()
const planetMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xee5533 })
const planetMarkerObject = new THREE.Mesh(planetMarkerGeometry, planetMarkerMaterial)
scene.add(planetMarkerObject)

//scene.add(groundObject)
//createLand(scene)
const planet = createPlanet(scene)

// DOM
const canvas = document.getElementById('canvas')
const cancelButton = document.getElementById('cancelButton')
canvas.appendChild(renderer.domElement)
const stateButtons = {
  addRoadButton: document.getElementById('addRoadButton'),
  pointOnSphereButton: document.getElementById('pointOnSphereButton')
}

// Functions
const eventToPosition = function(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / (window.innerHeight - buttonPanelHeight)) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  raycaster.ray.intersectPlane(plane, planeIntersection)
  return planeIntersection
}

const eventToSpherePosition = function(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1
  mouse.y = -(event.clientY / (window.innerHeight - buttonPanelHeight)) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  if (!raycaster.ray.intersectSphere(planet.sphere, sphereIntersection)) {
    return null
  }
  const markerNodes = planet.markerAt(sphereIntersection)
  markerNodes.forEach((n, i) => planetMarkerObject.geometry.vertices[i].copy(n.p))
  planetMarkerObject.geometry.computeFaceNormals()
  planetMarkerObject.geometry.verticesNeedUpdate = true
  planetMarkerObject.geometry.normalsNeedUpdate = true
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
const pointOnSphereButton$ = Rx.fromEvent(stateButtons.pointOnSphereButton, 'click').pipe(Op.mapTo('pointOnSphere'))
const cancelButton$ = Rx.fromEvent(cancelButton, 'click')
const rightButton$ = Rx.fromEvent(canvas, 'contextmenu')
const cancel$ = Rx.merge(cancelButton$, rightButton$).pipe(Op.mapTo('null'))
const state$ = Rx.merge(addRoadButton$, pointOnSphereButton$, cancel$).pipe(
  Op.startWith('null'),
  Op.map(state => ({ state })),
  Op.pairwise(),
  //Op.map(roadBuilder.handleStateTransition.bind(roadBuilder)),
  Op.map(([fromState, toState]) => toState ),
  Op.share()
)
const distinctState$ = state$.pipe(Op.distinctUntilKeyChanged('state'), Op.share())
const addRoadState$ = distinctState$.pipe(Op.filter(s => s.state === 'addRoad'))
const pointOnSphereState$ = distinctState$.pipe(Op.filter(s => s.state === 'pointOnSphere'))

pointOnSphereState$.subscribe(state => {
  console.log('Point on sphere: ', state)
  const sphereMarkerFromMove$ = mouseMove$.pipe(
    Op.map(eventToSpherePosition),
  ).subscribe()
})

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
  /*
  const moveBy = 2
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
  */
}

animation$.pipe(
  Op.withLatestFrom(keyHandler$, moveCamera),
  Op.tap(() => renderer.render(scene, camera))
).subscribe()

canvas.addEventListener('contextmenu', onRightButton)
