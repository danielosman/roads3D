import * as THREE from 'three'
import * as Rx from 'rxjs'
import Road from './Road'

export default class RoadBuilder {
  constructor() {
    this._settings = { r: 0.1 }
    this._points = []
    this._shape = new THREE.Shape()
    this._lastPoint = new THREE.Vector2()
    this._dir = new THREE.Vector2()
    this._road = null
    this._road$ = new Rx.Subject()

    const geometry = new THREE.CircleGeometry(this._settings.r, 16)
    const material = new THREE.MeshBasicMaterial({ color : 0x2266ff, transparent: true, opacity: 0.5 })
    this._object = new THREE.Mesh(geometry, material)
    this._object.visible = false
  }

  _initCircle () {
    this._object.geometry = new THREE.CircleGeometry(this._settings.r, 16)
    this._object.position.set(this._lastPoint.x, this._lastPoint.y, 0.1)
    this._object.visible = true
  }

  cancel() {
    console.log('road builder cancel')
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

  setPointStream(point$) {
    point$.subscribe(this.nextPoint.bind(this))
  }

  setPositionStream(position$) {
    position$.subscribe(this.movePoint.bind(this))
  }

  get roadStream () {
    return this._road$
  }

  get object() {
    return this._object
  }

  settingsChanged(settings) {
    console.log('settings: ', settings)
    this._settings = settings
    if (this._points.length === 0) {
      this._initCircle()
    }
  }

  nextPoint(point) {
    this._points.push(point.p)
    const nOfPoints = this._points.length
    if (nOfPoints > 2) {
      this._road.nextPoint(this._points[nOfPoints - 1])
    } else if (nOfPoints === 2) {
      // Create new road.
      this._road = new Road()
      this._road.nextPoint(this._points[0])
      this._road.nextPoint(this._points[1])
      this._road$.next(this._road)
    }
  }

  movePoint(point) {
    const nOfPoints = this._points.length
    if (nOfPoints === 0) {
      this._object.position.set(point.p.x, point.p.y, point.p.z + 0.1)
    } else {
      this._shape.curves = []
      this._lastPoint.set(this._points[nOfPoints - 1].x, this._points[nOfPoints - 1].y)
      this._dir.set(point.p.x, point.p.y)
      this._dir.sub(this._lastPoint)
      const len = this._dir.length()
      const per = new THREE.Vector2(-this._dir.y, +this._dir.x)
      per.divideScalar(len)
      const p = new THREE.Vector2(this._lastPoint.x, this._lastPoint.y)
      this._shape.moveTo(p.x, p.y)
      p.addScaledVector(per, this._settings.r)
      this._shape.lineTo(p.x, p.y)
      p.add(this._dir)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(per, -2 * this._settings.r)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(this._dir, -1)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(per, -this._settings.r)
      this._shape.autoClose = true

      this._object.geometry = new THREE.ShapeGeometry(this._shape)
      this._object.position.set(0, 0, 0.1)
    }
  }
}
