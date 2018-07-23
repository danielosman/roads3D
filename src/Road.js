import * as THREE from 'three'

export default class Road {
  constructor() {
    this._r = 3
    this._points = []
    this._segments = []

    this._shape = new THREE.Shape()

    const geometry = new THREE.CircleGeometry(this._r, 12)
    const material = new THREE.MeshBasicMaterial({ color : 0x444444 })
    this._object = new THREE.Mesh(geometry, material)
  }

  setPointStream(point$) {
    point$.subscribe(this.nextPoint.bind(this))
  }

  get object() {
    return this._object
  }

  isEmpty() {
    return this._points.length < 2
  }

  distanceTo (point) {
    const ret = { d: 9999999, i: -1, t: 0, p: new THREE.Vector3() }
    const p = new THREE.Vector2()
    const proj = new THREE.Vector2()
    this._segments.forEach((s, i) => {
      p.set(point.x, point.y)
      p.sub(s.p)
      const t = p.dot(s.dir)
      proj.set(0, 0)
      proj.addScaledVector(s.dir, t)
      const d = proj.distanceToSquared(p)
      if (d < ret.d) {
        ret.d = d
        ret.i = i
        ret.t = t
        ret.p.set(proj.x, proj.y)
        ret.p.add(s.p)
      }
    })
    return ret
  }

  createSegment (index) {
    const segment = {}
    const p0 = this._points[index]
    const p1 = this._points[index + 1]
    segment.p = p0
    segment.dir = new THREE.Vector3()
    segment.dir.subVectors(p1, p0)
    segment.len = p0.distanceTo(p1)
    segment.dir.divideScalar(segment.len)
    segment.per = new THREE.Vector3()
    segment.per.x = -segment.dir.y
    segment.per.y = +segment.dir.x
    segment.per.z = 0
    return segment
  }

  rebuildShape () {
    const nOfSegments = this._segments.length
    const p = new THREE.Vector2()
    const pPrev = new THREE.Vector2()
    const box = new THREE.Box2()
    this._shape.curves = []
    // Forward
    pPrev.set(this._segments[0].p.x, this._segments[0].p.y)
    pPrev.addScaledVector(this._segments[0].per, this._r)
    box.expandByPoint(pPrev)
    this._shape.moveTo(pPrev.x, pPrev.y)
    for (let i = 1; i < nOfSegments; i++) {
      p.set(this._segments[i].p.x, this._segments[i].p.y)
      p.addScaledVector(this._segments[i].per, this._r)
      const t = Road.intersectVectors(pPrev, this._segments[i - 1].dir, p, this._segments[i].dir)
      pPrev.addScaledVector(this._segments[i - 1].dir, t)
      this._shape.lineTo(pPrev.x, pPrev.y)
      box.expandByPoint(pPrev)
    }
    pPrev.set(this._points[nOfSegments].x, this._points[nOfSegments].y)
    pPrev.addScaledVector(this._segments[nOfSegments - 1].per, this._r)
    this._shape.lineTo(pPrev.x, pPrev.y)
    box.expandByPoint(pPrev)
    // Backwards
    pPrev.addScaledVector(this._segments[nOfSegments - 1].per, -2 * this._r)
    this._shape.lineTo(pPrev.x, pPrev.y)
    box.expandByPoint(pPrev)
    for (let i = nOfSegments - 2; i >= 0; i--) {
      p.set(this._segments[i].p.x, this._segments[i].p.y)
      p.addScaledVector(this._segments[i].per, -this._r)
      const t = Road.intersectVectors(pPrev, this._segments[i + 1].dir, p, this._segments[i].dir)
      pPrev.addScaledVector(this._segments[i + 1].dir, t)
      this._shape.lineTo(pPrev.x, pPrev.y)
      box.expandByPoint(pPrev)
    }
    pPrev.set(this._points[0].x, this._points[0].y)
    pPrev.addScaledVector(this._segments[0].per, -this._r)
    this._shape.lineTo(pPrev.x, pPrev.y)
    box.expandByPoint(pPrev)
    console.log("box: ", box)
    this._shape.autoClose = true
  }

  nextPoint(point) {
    this._points.push(point.clone())
    const nOfPoints = this._points.length
    if (nOfPoints < 2) return
    this._segments.push(this.createSegment(nOfPoints - 2))
    this.rebuildShape()
    this._object.geometry = new THREE.ShapeGeometry(this._shape)
    this._object.position.set(0, 0, 0.1)
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
