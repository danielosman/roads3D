import * as THREE from "three"
import IntersectionPoint from "./IntersectionPoint"

export default class RoadSegmentViewBase {
  constructor (s) {
    this._isCircle = true
    this._r = 3
    this._segments = []
    this._outline = { f: [], b: [] }
    this._shape = new THREE.Shape()

    this._z = s.z
    this._material = s.material
  }

  buildObject (model) {
    if (!model) {
      this._object.visible = false
      return
    }
    this._model = model
    this._object.visible = true
    const isCircle = this._model.segment.len <= 0
    if (isCircle) {
      if (!this._isCircle || this._model.r !== this._r) {
        this._isCircle = true
        this._r = this._model.r
        this._buildCircle()
      }
      this._moveCircle()
    } else {
      this._isCircle = false
      this._segments[0] = this._model.segment
      RoadSegmentViewBase.createOutline(this._segments, this._model.r, 0, 0, this._outline)
      this.rebuildShape()
      this._object.geometry = new THREE.ShapeGeometry(this._shape)
      this._object.position.set(0, 0, this._z)
    }
  }

  get object () {
    return this._object
  }

  _buildCircle () {
    this._object.geometry = new THREE.CircleGeometry(this._r, 24)
  }

  _moveCircle () {
    this._object.position.set(this._model.firstNode.p.x, this._model.firstNode.p.y, this._model.firstNode.p.z + this._z)
  }

  _initObject () {
    const geometry = new THREE.CircleGeometry(this._r, 24)
    const material = new THREE.MeshBasicMaterial(this._material)
    this._object = new THREE.Mesh(geometry, material)
    this._object.visible = false
  }

  rebuildShape () {
    let p
    this._shape.curves = []
    p = this._outline.f[0]
    this._shape.moveTo(p.x, p.y)
    for (let i = 1; i < this._outline.f.length; i++) {
      p = this._outline.f[i]
      this._shape.lineTo(p.x, p.y)
    }
    for (let i = this._outline.b.length - 1; i >= 0; i--) {
      p = this._outline.b[i]
      this._shape.lineTo(p.x, p.y)
    }
    this._shape.autoClose = true
  }

  static createOutline (segments, r, index0, index1, outline = { f: [], b: [] }) {
    const p = IntersectionPoint.p
    // const box = new THREE.Box2()
    // box.expandByPoint(p)
    let pPrev
    let t
    if (index0 === 0) {
      p.set(segments[index0].p0.x, segments[index0].p0.y)
      p.addScaledVector(segments[index0].per, -r)
      outline.f[index0] = p.clone()
      p.addScaledVector(segments[index0].per, 2 * r)
      outline.b[index0] = p.clone()
    }
    for (let i = index0 + 1; i <= index1; i++) {
      // Forward
      p.set(segments[i].p0.x, segments[i].p0.y)
      p.addScaledVector(segments[i].per, -r)
      pPrev = outline.f[outline.f.length - 1].clone()
      t = RoadSegmentViewBase.intersectVectors(pPrev, segments[i - 1].dir, p, segments[i].dir)
      pPrev.addScaledVector(segments[i - 1].dir, t)
      outline.f[i] = pPrev
      // Backward
      p.addScaledVector(segments[i].per, 2 * r)
      pPrev = outline.b[outline.b.length - 1].clone()
      t = RoadSegmentViewBase.intersectVectors(pPrev, segments[i - 1].dir, p, segments[i].dir)
      pPrev.addScaledVector(segments[i - 1].dir, t)
      outline.b[i] = pPrev
    }
    const lastIndex = index1 + 1
    p.copy(segments[index1].p1)
    p.addScaledVector(segments[index1].per, -r)
    outline.f[lastIndex] = p.clone()
    p.addScaledVector(segments[index1].per, 2 * r)
    outline.b[lastIndex] = p.clone()
    return outline
  }

  /**
   * Returns the distance from v1 along v1dir were the intersection was found.
   */
  static intersectVectors(v1, v1dir, v2, v2dir) {
    const c = new THREE.Vector2()
    c.subVectors(v1, v2)
    const b = v1dir.x * v2dir.y - v1dir.y * v2dir.x
    const a = v2dir.x * c.y - v2dir.y * c.x
    return a / b
  }
}
