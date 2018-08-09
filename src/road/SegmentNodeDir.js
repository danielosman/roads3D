import * as THREE from "three"

export default class SegmentNodeDir {
  constructor(dir, segment) {
    this._dir = dir
    this._segment = segment
    this._bearing = 0
    this._dirV = null
    this._alongs = []
    this._along = 10
    this._alongPoints = [new THREE.Vector3(), new THREE.Vector3()]
  }

  computeParams () {
    this._dirV = new THREE.Vector2(this._dir * this._segment.segment.dir.x, this._dir * this._segment.segment.dir.y)
    this._bearing = this._dirV.angle()
  }

  get segment () {
    return this._segment
  }

  get bearing () {
    return this._bearing
  }

  get dirV () {
    return this._dirV
  }

  get alongs () {
    return this._alongs
  }

  get along () {
    return this._along
  }

  set along (along) {
    this._along = along
  }

  get alongPoints () {
    return this._alongPoints
  }
}
