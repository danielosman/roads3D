import * as THREE from 'three'
import SegmentNodeDir from "./SegmentNodeDir"

export default class SegmentNode {
  constructor() {
    this._id = THREE.Math.generateUUID()
    this._rSquared = 0
    this._point = new THREE.Vector3()
    this._snapPoint = null
    this._segmentDir = []
  }

  clone () {
    const newSegmentNode = new SegmentNode()
    newSegmentNode.p.copy(this._point)
    // We do not copy rSquared.
    // We do not copy the snapPoint.
    // We do not copy the segmentDir.
    return newSegmentNode
  }

  commitSnapPoint () {
    if (this._snapPoint !== null) {
      // We clone the existing snapPoint and save its reference in this Node so it will not be overwritten.
      // The snapPoint for the new node can be null.
      this._snapPoint = this._snapPoint.clone()
    }
  }

  actualNode () {
    if (this._snapPoint !== null && this._snapPoint.snapped) {
      if (this._snapPoint.isNode) {
        return this._snapPoint.node
      }
      if (this._snapPoint.isSegment) {
        this.commitSnapPoint()
        return this
      }
    }
    this._snapPoint = null
    return this
  }

  addDir (dir, roadSegment) {
    if (this._rSquared < roadSegment.rSquared) {
      this._rSquared = roadSegment.rSquared
    }
    this._segmentDir.push(new SegmentNodeDir(dir, roadSegment))
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

  distanceToSquared (point, minPoint) {
    const d = this._point.distanceToSquared(point) - this._rSquared
    if (d < minPoint.d) {
      minPoint.d = d
      minPoint.node = this
      minPoint.p.copy(this._point)
    }
    return minPoint
  }
}
