import * as THREE from 'three'
import IntersectionPoint from "./IntersectionPoint"

export default class Segment {
  constructor () {
    this._p0 = null
    this._p1 = null
    this._len = -1
    this._dir = new THREE.Vector3()
    this._per = new THREE.Vector3()
  }

  reset () {
    this._len = -1
  }

  setNodes (p0, p1) {
    this._p0 = p0
    this._p1 = p1
    this._len = p0.distanceTo(p1)
    this._dir.subVectors(p1, p0).divideScalar(this._len)
    this._per.set(-this._dir.y, +this._dir.x, 0)
  }

  intersect (segment) {
    const dx = this.p0.x - segment.p0.x
    const dy = this.p0.y - segment.p0.y
    const b = this.dir.x * segment.dir.y - this.dir.y * segment.dir.x
    const a = segment.dir.x * dy - segment.dir.y * dx
    return a / b
  }

  distanceTo (point, distanceMod, ret, callWhenFound) {
    const p = IntersectionPoint.p
    const projection = IntersectionPoint.projection
    p.set(point.x, point.y)
    p.sub(this.p0)
    let t = p.dot(this.dir)
    if (t > this.len) t = this.len
    if (t < 0) t = 0
    projection.set(0, 0)
    projection.addScaledVector(this.dir, t)
    const d = projection.distanceToSquared(p) - (distanceMod || 0)
    if (d < ret.d) {
      ret.d = d
      ret.segment = this
      ret.i = 0
      ret.t = t
      ret.p.set(projection.x, projection.y, 0)
      ret.p.add(this.p0)
      callWhenFound(ret)
    }
    return ret
  }

  get p0 () {
    return this._p0
  }

  get p1 () {
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
