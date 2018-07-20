import * as THREE from 'three'

export default class Road {
  constructor() {
    this._r = 3
    this._points = []
    //this._curvePath = new THREE.CurvePath()
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

  nextPoint(point) {
    this._points.push(point.clone())
    const len = this._points.length
    if (len < 2) return
    let dirCurr = new THREE.Vector2()
    let dirPrev = new THREE.Vector2()
    let perCurr = new THREE.Vector2()
    let perPrev = new THREE.Vector2()
    let pCurr = new THREE.Vector2()
    let pPrev = new THREE.Vector2()

    this._shape.curves = []
    // Forward
    dirPrev.subVectors(this._points[1], this._points[0])
    dirPrev.normalize()
    perPrev.set(-dirPrev.y, +dirPrev.x)
    pPrev.set(this._points[0].x, this._points[0].y)
    pPrev.addScaledVector(perPrev, this._r)
    this._shape.moveTo(pPrev.x, pPrev.y)
    for (let i = 1; i < len - 1; i++) {
      dirCurr.subVectors(this._points[i + 1], this._points[i])
      dirCurr.normalize()
      perCurr.set(-dirCurr.y, +dirCurr.x)
      pCurr.set(this._points[i].x, this._points[i].y)
      pCurr.addScaledVector(perCurr, this._r)
      const t = Road.intersectVectors(pPrev, dirPrev, pCurr, dirCurr)
      pPrev.addScaledVector(dirPrev, t)
      this._shape.lineTo(pPrev.x, pPrev.y)
      pPrev.set(pCurr.x, pCurr.y)
      perPrev.set(perCurr.x, perCurr.y)
      dirPrev.set(dirCurr.x, dirCurr.y)
    }
    pCurr.set(this._points[len - 1].x, this._points[len - 1].y)
    pCurr.addScaledVector(perPrev, this._r)
    this._shape.lineTo(pCurr.x, pCurr.y)

    // Backward
    dirPrev.subVectors(this._points[len - 2], this._points[len - 1])
    dirPrev.normalize()
    perPrev.set(-dirPrev.y, +dirPrev.x)
    pPrev.set(this._points[len - 1].x, this._points[len - 1].y)
    pPrev.addScaledVector(perPrev, this._r)
    this._shape.lineTo(pPrev.x, pPrev.y)
    for (let i = len - 2; i > 0; i--) {
      dirCurr.subVectors(this._points[i - 1], this._points[i])
      dirCurr.normalize()
      perCurr.set(-dirCurr.y, +dirCurr.x)
      pCurr.set(this._points[i].x, this._points[i].y)
      pCurr.addScaledVector(perCurr, this._r)
      const t = Road.intersectVectors(pPrev, dirPrev, pCurr, dirCurr)
      pPrev.addScaledVector(dirPrev, t)
      this._shape.lineTo(pPrev.x, pPrev.y)
      pPrev.set(pCurr.x, pCurr.y)
      perPrev.set(perCurr.x, perCurr.y)
      dirPrev.set(dirCurr.x, dirCurr.y)
    }
    pCurr.set(this._points[0].x, this._points[0].y)
    pCurr.addScaledVector(perPrev, this._r)
    this._shape.lineTo(pCurr.x, pCurr.y)

    this._shape.autoClose = true
    this._object.geometry = new THREE.ShapeGeometry(this._shape)
    this._object.position.set(0, 0, 0.1)
  }

  /**
   * Returns the distance from v1 along v1dir were the intersection was found.
   */
  static intersectVectors(v1, v1dir, v2, v2dir) {
    const c = new THREE.Vector2()
    c.subVectors(v1, v2)
    const mian = v1dir.x * v2dir.y - v1dir.y * v2dir.x
    const licz = v2dir.x * c.y - v2dir.y * c.x
    return licz / mian
  }
}
