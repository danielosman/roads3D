import Segment from "./Segment"
import SegmentNode from "./SegmentNode"

export default class RoadSegment {
  constructor() {
    this._node = [null, null]
    this._segment = new Segment()
    this._r = 6
  }

  setNodes (n0, n1) {
    this._node[0] = n0
    this._node[1] = n1
    this._segment.setNodes(this._node[0].p, this._node[1].p)
  }

  buildSegment () {
    if (this.allNodesExist) {
      this._segment.setNodes(this._node[0].p, this._node[1].p)
    }
  }

  addStep () {
    const ret = {}
    if (this._node[0] === null) {
      this._node[0] = new SegmentNode()
      ret.designedSegment = this
    } else if(this._node[1] === null) {
      this._node[1] = this._node[0]
      this._node[0] = this._node[0].clone()
      ret.designedSegment = this
    }
    return ret
  }

  revertLastStep () {
    this._node[0] = this._node[1]
    this._node[1] = null
    this._segment.reset()
  }

  get segment () {
    return this._segment
  }

  get allNodesExist () {
    return this._node[0] !== null && this._node[1] !== null
  }

  get numberOfExistingNodes () {
    return this._node.filter(n => n !== null).length
  }

  get lastExistingNode () {
    if (this._node[0] === null) return null
    if (this._node[1] !== null) return this._node[1]
    return this._node[0]
  }

  set lastNode (lastNode) {
    this._node[1] = lastNode
  }

  get lastNode () {
    return this._node[1]
  }

  set firstNode (firstNode) {
    this._node[0] = firstNode
  }

  get firstNode () {
    return this._node[0]
  }

  set r (r) {
    this._r = r
  }

  get r () {
    return this._r
  }

  distanceTo (point, minPoint) {
    return this._segment.distanceTo(point, this._r * this._r, minPoint, ret => ret.segment = this)
  }
}
