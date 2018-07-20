import * as THREE from 'three'

export default class Marker {
  constructor() {
    this._r = 0.1
    this._points = []
    this._shape = new THREE.Shape()
    this._lastPoint = new THREE.Vector2()
    this._dir = new THREE.Vector2()

    const geometry = new THREE.CircleGeometry(this._r, 12)
    const material = new THREE.MeshBasicMaterial({ color : 0x2266ff, transparent: true, opacity: 0.5 })
    this._object = new THREE.Mesh(geometry, material)
    this._object.visible = false
  }

  initCircle(r) {
    this._r = r
    this._points = []
    this._object.geometry = new THREE.CircleGeometry(this._r, 12)
    this._object.material = new THREE.MeshBasicMaterial({ color: 0x2266ff, transparent: true, opacity: 0.5 })
    this._object.position.set(this._lastPoint.x, this._lastPoint.y, 0.1)
    this._object.visible = true
  }

  setPointStream(point$) {
    point$.subscribe(
      this.nextPoint.bind(this),
      () => {},
      () => this.initCircle(this._r)
    )
  }

  setPositionsStream(point$) {
    point$.subscribe(this.movePoint.bind(this))
  }

  get object() {
    return this._object
  }

  nextPoint(point) {
    this._points.push(point.clone())
  }

  movePoint(point) {
    const nOfPoints = this._points.length
    if (nOfPoints === 0) {
      this._object.position.set(point.x, point.y, point.z + 0.1)
    } else {
      this._shape.curves = []
      this._lastPoint.set(this._points[nOfPoints - 1].x, this._points[nOfPoints - 1].y)
      this._dir.set(point.x, point.y)
      this._dir.sub(this._lastPoint)
      const len = this._dir.length()
      const per = new THREE.Vector2(-this._dir.y, +this._dir.x)
      per.divideScalar(len)
      const p = new THREE.Vector2(this._lastPoint.x, this._lastPoint.y)
      this._shape.moveTo(p.x, p.y)
      p.addScaledVector(per, this._r)
      this._shape.lineTo(p.x, p.y)
      p.add(this._dir)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(per, -2 * this._r)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(this._dir, -1)
      this._shape.lineTo(p.x, p.y)
      p.addScaledVector(per, -this._r)
      this._shape.autoClose = true

      this._object.geometry = new THREE.ShapeGeometry(this._shape)
      this._object.position.set(0, 0, 0.1)
    }
  }
}
