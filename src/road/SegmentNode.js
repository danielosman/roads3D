import * as THREE from 'three'

export default class SegmentNode {
  constructor() {
    this._point = new THREE.Vector3()
    this._snapPoint = null
    this._segmentDir = []
  }

  clone () {
    const newSegmentNode = new SegmentNode()
    newSegmentNode.p.copy(this._point)
    if (this._snapPoint !== null) {
      const newSnapPoint = this._snapPoint.clone()
      newSegmentNode.modifyFromSnapPoint(newSnapPoint)
    }
    // TODO: copy this._segmentDir
    return newSegmentNode
  }

  get p () {
    return this._point
  }

  modifyFromSnapPoint (snapPoint) {
    this._snapPoint = snapPoint
    let point = snapPoint.p
    if (!this._snapPoint.snapped) {
      point = this._snapPoint.originalPoint
    }
    this._point.set(point.x, point.y, point.z)
  }
}
