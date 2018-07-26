import * as THREE from 'three'

export default class Segment {
  constructor() {
    this._p0 = null
    this._p1 = null
    this._len = -1
    this._dir = new THREE.Vector3()
    this._per = new THREE.Vector3()
  }

  setPoints(p0, p1) {
    this._p0 = p0
    this._p1 = p1
    this._len = p0.distanceTo(p1)
    this._dir.subVectors(p1, p0).divideScalar(this._len)
    this._per.set(-this._dir.y, +this._dir.x, 0)
  }

  get p () {
    return this._p0
  }

  get endPoint () {
    return this._p1
  }

  get dir () {
    return this._dir
  }

  get per () {
    return this._per
  }

  get len () {
    return this._len
  }
}
