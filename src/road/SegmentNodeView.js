import * as THREE from "three"

class SegmentNodeView {
  constructor () {
    this._model = null
    this._shape = new THREE.Shape()
    const geometry = new THREE.CircleGeometry(6, 4)
    const material = new THREE.MeshBasicMaterial({ color: 0x272727 })
    this._object = new THREE.Mesh(geometry, material)
    this._object.position.set(0, 0, 0.15)
  }

  buildObject (model) {
    this._model = model
    model.view = this
    this._shape.curves = []
    this._shape.moveTo(this._model.segmentDirs[0].alongPoints[1].x, this._model.segmentDirs[0].alongPoints[1].y);
    this._model.segmentDirs.forEach((segmentDir, i) => {
      const nextSegmentDir = (i + 1 >= this._model.segmentDirs.length) ? this._model.segmentDirs[0] : this._model.segmentDirs[i + 1]
      const cp1 = SegmentNodeView.cp1
      const cp2 = SegmentNodeView.cp2
      cp1.set(segmentDir.alongPoints[1].x - segmentDir.dirV.x * segmentDir.along, segmentDir.alongPoints[1].y - segmentDir.dirV.y * segmentDir.along)
      cp2.set(nextSegmentDir.alongPoints[0].x - nextSegmentDir.dirV.x * nextSegmentDir.along, nextSegmentDir.alongPoints[0].y - nextSegmentDir.dirV.y * nextSegmentDir.along)
      this._shape.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, nextSegmentDir.alongPoints[0].x, nextSegmentDir.alongPoints[0].y)
      this._shape.lineTo(nextSegmentDir.alongPoints[1].x, nextSegmentDir.alongPoints[1].y)
    })
    this._object.geometry = new THREE.ShapeGeometry(this._shape)
  }

  get object () {
    return this._object
  }
}

SegmentNodeView.cp1 = new THREE.Vector2()
SegmentNodeView.cp2 = new THREE.Vector2()

export default SegmentNodeView
