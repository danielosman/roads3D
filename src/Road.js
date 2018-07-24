import * as THREE from 'three'
import SegmentOutline from './SegmentOutline'

export default class Road extends SegmentOutline {
  constructor() {
    super()
    const geometry = new THREE.CircleGeometry(1, 12)
    const material = new THREE.MeshBasicMaterial({ color : 0x444444, wireframe: false })
    this._object = new THREE.Mesh(geometry, material)
  }

  get object() {
    return this._object
  }

  /**
   * Computes minimum squared distance from the given point to this road.
   * p and projection vectors can be given if creating new instances for every calculation is too costly.
   */
  distanceTo (point, p = new THREE.Vector2(), projection = new THREE.Vector2()) {
    const ret = { d: 9999999, i: -1, t: 0, p: new THREE.Vector3() }
    const r2 = this._settings.r * this._settings.r
    this._segments.forEach((s, i) => {
      p.set(point.x, point.y)
      p.sub(s.p)
      let t = p.dot(s.dir)
      if (t > s.len) t = s.len
      if (t < 0) t = 0
      projection.set(0, 0)
      projection.addScaledVector(s.dir, t)
      const d = projection.distanceToSquared(p) - r2
      if (d < ret.d) {
        ret.d = d
        ret.i = i
        ret.t = t
        ret.p.set(projection.x, projection.y, 0)
        ret.p.add(s.p)
      }
    })
    return ret
  }

  nextPoint(point) {
    this._points.push(point.clone())
    const nOfPoints = this._points.length
    if (nOfPoints < 2) return
    let index0 = nOfPoints - 3
    if (index0 < 0) index0 = 0
    const index1 = nOfPoints - 2
    this._segments.push(this.createSegment(index1))
    this.createOutline(index0, index1, this._outline)
    this.rebuildShape()
    this._object.geometry = new THREE.ShapeGeometry(this._shape)
    this._object.position.set(0, 0, 0.1)
  }
}
