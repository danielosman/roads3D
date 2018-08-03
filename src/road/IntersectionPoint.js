import * as THREE from 'three'

export default class IntersectionPoint {
  constructor() {
    this.init()
  }

  init () {
    this._snapped = false
    this._segment = null
    this._t = -1
    this._d = 9999999
    this._i = -1
    this._node = null
    this._point = new THREE.Vector3()
    this._originalPoint = null
  }

  clone () {
    const newIntersectionPoint = new IntersectionPoint()
    newIntersectionPoint._snapped = this._snapped
    newIntersectionPoint._segment = this._segment
    newIntersectionPoint._t = this._t
    newIntersectionPoint._d = this._d
    newIntersectionPoint._i = this._i
    newIntersectionPoint._node = this._node
    newIntersectionPoint._point.copy(this._point)
    if (this._originalPoint !== null) newIntersectionPoint._originalPoint = this._originalPoint.clone()
    return newIntersectionPoint
  }

  get snapped () {
    return this._snapped
  }

  get segment () {
    return this._segment
  }

  get t () {
    return this._t
  }

  get d () {
    return this._d
  }

  get i () {
    return this._i
  }

  get node () {
    return this._node
  }

  get p () {
    return this._point
  }

  get originalPoint () {
    return this._originalPoint
  }

  set snapped (snapped) {
    this._snapped = snapped
  }

  set segment (segment) {
    this._segment = segment
  }

  set t (t) {
    this._t = t
  }

  set d (d) {
    this._d = d
  }

  set i (i) {
    this._i = i
  }

  set p (point) {
    this._point = point
  }

  set originalPoint (point) {
    this._originalPoint = point
  }

  static initMinPoint (originalPoint) {
    if (!IntersectionPoint.minPoint) {
      IntersectionPoint.minPoint = new IntersectionPoint()
    } else {
      IntersectionPoint.minPoint.init()
    }
    IntersectionPoint.minPoint.originalPoint = originalPoint
    if (!IntersectionPoint.p) {
      IntersectionPoint.p = new THREE.Vector2()
    }
    if (!IntersectionPoint.projection) {
      IntersectionPoint.projection = new THREE.Vector2()
    }
    return IntersectionPoint.minPoint
  }
}
