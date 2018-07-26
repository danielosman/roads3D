import * as THREE from 'three'
import * as Rx from 'rxjs'
import SegmentOutline from './SegmentOutline'
import Road from './Road'
import Segment from './Segment'

export default class RoadBuilder extends SegmentOutline {
  constructor() {
    super()
    this._lastPoint = new THREE.Vector3()
    this._road = null
    this._road$ = new Rx.Subject()
    this._segments.push(new Segment())
  }

  _initObject () {
    const geometry = new THREE.CircleGeometry(this._settings.r, 24)
    const material = new THREE.MeshBasicMaterial({ color : 0x4488ff, transparent: true, opacity: 0.66 })
    this._object = new THREE.Mesh(geometry, material)
    this._object.visible = false
  }

  _initCircle () {
    this._object.geometry = new THREE.CircleGeometry(this._settings.r, 24)
    this._object.position.copy(this._lastPoint)
  }

  cancel() {
    if (this._points.length === 0) {
      this._object.visible = false
      return { state: 'null' }
    }
    this._points = []
    return { state: 'addRoad', settings: this._settings }
  }

  cancelAll () {

  }

  setSettingsStream(settings$) {
    settings$.subscribe(this.settingsChanged.bind(this))
  }

  setNextPositionStream(point$) {
    point$.subscribe(this.nextPosition.bind(this))
  }

  setChangePositionStream(position$) {
    position$.subscribe(this.changePosition.bind(this))
  }

  get roadStream () {
    return this._road$
  }

  settingsChanged(settings) {
    console.log('settings: ', settings)
    this._settings = settings
    if (this._points.length === 0) {
      this._initCircle()
    }
  }

  nextPosition(pos) {
    this._object.visible = true
    this._points.push(pos.p)
    const nOfPoints = this._points.length
    this._initCircle()
    if (nOfPoints > 2) {
      this._road.nextPoint(this._points[nOfPoints - 1])
    } else if (nOfPoints === 2) {
      // Create new road.
      this._road = new Road()
      this._road.r = this._settings.r
      this._road.nextPoint(this._points[0])
      this._road.nextPoint(this._points[1])
      this._road$.next(this._road)
    }
  }

  changePosition(pos) {
    this._object.visible = true
    this._lastPoint.set(pos.p.x, pos.p.y, pos.p.z + 0.2)
    const nOfPoints = this._points.length
    if (nOfPoints === 0) {
      this._object.position.copy(this._lastPoint)
    } else {
      this.createSegment(nOfPoints - 1, pos.p, this._segments[0])
      if (this._segments[0].len < 0.1) return
      this.createOutline(0, 0, this._outline)
      this.rebuildShape()
      this._object.geometry = new THREE.ShapeGeometry(this._shape)
      this._object.position.set(0, 0, 0.2)
    }
  }
}
