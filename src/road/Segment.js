import * as THREE from 'three'
import IntersectionPoint from "./IntersectionPoint"

class Segment {
  constructor () {
    this._p0 = null
    this._p1 = null
    this._len = -1
    this._dir = new THREE.Vector3()
    this._per = new THREE.Vector3()
  }

  clone () {
    const ret = new Segment()
    if (this._p0) ret._p0 = this._p0.clone()
    if (this._p1) ret._p1 = this._p1.clone()
    ret._len = this._len
    ret._dir.copy(this._dir)
    ret._per.copy(this._per)
    return ret
  }

  reset () {
    this._len = -1
  }

  initP0 () {
    this._p0 = new THREE.Vector3()
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
    if (b < 0.001 && b > -0.001) return 0
    const a = segment.dir.x * dy - segment.dir.y * dx
    return a / b
  }

  pointAt (t, point) {
    point.copy(this._p0)
    point.addScaledVector(this._dir, t)
  }

  distanceToSquared (point, distanceMod, ret, callWhenFound) {
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

  static borderA (p, dirV, r) {
    Segment._borderA.p0.set(p.x - dirV.y * r, p.y + dirV.x * r, p.z)
    Segment._borderA.dir.set(dirV.x, dirV.y, 0)
    return Segment._borderA
  }

  static borderB (p, dirV, r) {
    Segment._borderB.p0.set(p.x - dirV.y * r, p.y + dirV.x * r, p.z)
    Segment._borderB.dir.set(dirV.x, dirV.y, 0)
    return Segment._borderB
  }
}

Segment._borderA = new Segment()
Segment._borderA.initP0()
Segment._borderB = new Segment()
Segment._borderB.initP0()

export default Segment
