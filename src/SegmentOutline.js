import * as THREE from 'three'

export default class SegmentOutline {
  constructor() {
    this._settings = { r: 0.1 }
    this._points = []
    this._segments = []
    this._outline = { f: [], b: [] }
    this._shape = new THREE.Shape()
    this._initObject()
  }

  _initObject () {
    const geometry = new THREE.CircleGeometry(1, 12)
    const material = new THREE.MeshBasicMaterial({ color : 0x474747, wireframe: false })
    this._object = new THREE.Mesh(geometry, material)
  }

  get object() {
    return this._object
  }

  get r () {
    return this._settings.r
  }

  set r (radius) {
    this._settings.r = radius
  }

  getPoint (index) {
    return this._points[index]
  }

  getSegment (index) {
    return this._segments[index]
  }

  get numOfSegments () {
    return this._segments.length
  }

  /**
   * Creates and returns a segment from points[index] to p or points[index + 1].
   */
  createSegment (index, p, segment = { dir: new THREE.Vector3(), per: new THREE.Vector3() }) {
    const p0 = this._points[index]
    const p1 = p || this._points[index + 1]
    segment.p = p0
    segment.dir.subVectors(p1, p0)
    segment.len = p0.distanceTo(p1)
    segment.dir.divideScalar(segment.len)
    segment.per.set(-segment.dir.y, +segment.dir.x, 0)
    return segment
  }

  createOutline (index0, index1, outline = { f: [], b: [] }) {
    const p = new THREE.Vector2()
    // const box = new THREE.Box2()
    // box.expandByPoint(p)
    let pPrev
    let t
    if (index0 === 0) {
      p.set(this._segments[index0].p.x, this._segments[index0].p.y)
      p.addScaledVector(this._segments[index0].per, -this._settings.r)
      outline.f[index0] = p.clone()
      p.addScaledVector(this._segments[index0].per, 2 * this._settings.r)
      outline.b[index0] = p.clone()
    }
    for (let i = index0 + 1; i <= index1; i++) {
      // Forward
      p.set(this._segments[i].p.x, this._segments[i].p.y)
      p.addScaledVector(this._segments[i].per, -this._settings.r)
      pPrev = outline.f[outline.f.length - 1].clone()
      t = SegmentOutline.intersectVectors(pPrev, this._segments[i - 1].dir, p, this._segments[i].dir)
      pPrev.addScaledVector(this._segments[i - 1].dir, t)
      outline.f[i] = pPrev
      // Backward
      p.addScaledVector(this._segments[i].per, 2 * this._settings.r)
      pPrev = outline.b[outline.b.length - 1].clone()
      t = SegmentOutline.intersectVectors(pPrev, this._segments[i - 1].dir, p, this._segments[i].dir)
      pPrev.addScaledVector(this._segments[i - 1].dir, t)
      outline.b[i] = pPrev
    }
    const lastIndex = index1 + 1
    p.set(this._segments[index1].p.x, this._segments[index1].p.y)
    p.addScaledVector(this._segments[index1].dir, this._segments[index1].len)
    p.addScaledVector(this._segments[index1].per, -this._settings.r)
    outline.f[lastIndex] = p.clone()
    p.addScaledVector(this._segments[index1].per, 2 * this._settings.r)
    outline.b[lastIndex] = p.clone()
    return outline
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
