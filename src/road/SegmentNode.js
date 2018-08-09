import * as THREE from 'three'
import SegmentNodeDir from "./SegmentNodeDir"
import Segment from "./Segment"

export default class SegmentNode {
  constructor() {
    this._id = THREE.Math.generateUUID()
    this._rSquared = 0
    this._point = new THREE.Vector3()
    this._snapPoint = null
    this._segmentDirs = []

    this._view = null
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
    const segmentDir = new SegmentNodeDir(dir, roadSegment)
    segmentDir.computeParams()
    this._segmentDirs.push(segmentDir)
    this.computeAlongs()
  }

  computeAlongs () {
    this._segmentDirs.sort((a, b) => a.bearing - b.bearing)
    this._segmentDirs.forEach((segmentDir, i) => {
      const nextSegmentDir = (i + 1 >= this._segmentDirs.length) ? this._segmentDirs[0] : this._segmentDirs[i + 1]
      const borderA = Segment.borderA(this.p, segmentDir.dirV, segmentDir.segment.r)
      const borderB = Segment.borderB(this.p, nextSegmentDir.dirV, -nextSegmentDir.segment.r)
      const t1 = borderA.intersect(borderB)
      const t0 = borderB.intersect(borderA)
      segmentDir.alongs[1] = t1
      nextSegmentDir.alongs[0] = t0
    })
    this._segmentDirs.forEach(segmentDir => {
      segmentDir.along = Math.max(segmentDir.alongs[0], segmentDir.alongs[1]) + 10
      const borderA = Segment.borderA(this.p, segmentDir.dirV, segmentDir.segment.r)
      const borderB = Segment.borderB(this.p, segmentDir.dirV, -segmentDir.segment.r)
      borderA.pointAt(segmentDir.along, segmentDir.alongPoints[1])
      borderB.pointAt(segmentDir.along, segmentDir.alongPoints[0])
    })
  }

  get p () {
    return this._point
  }

  set view (view) {
    this._view = view
  }

  get view () {
    return this._view
  }

  get segmentDirs () {
    return this._segmentDirs
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
