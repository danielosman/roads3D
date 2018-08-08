import Segment from "./Segment"
import SegmentNode from "./SegmentNode"

export default class RoadSegment {
  constructor() {
    this._node = [null, null]
    this._segment = new Segment()
    this._r = 3
    this._rSquared = 9

    this._view = null
  }

  clone () {
    const ret = new RoadSegment()
    this._node.forEach((n, i) => ret._node[i] = n)
    ret._segment = this._segment.clone()
    ret._r = this._r
    ret._rSquared = this._rSquared
    return ret
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

  commitSegment () {
    this._node[1] = this._node[1].actualNode()
    const builtRoadSegment = this.clone()
    builtRoadSegment.nodes[0].addDir(+1, builtRoadSegment)
    builtRoadSegment.nodes[1].addDir(-1, builtRoadSegment)
    return builtRoadSegment
  }

  addStep () {
    const ret = {}
    if (this._node[0] === null) {
      this._node[0] = new SegmentNode()
      ret.designedSegment = this
    } else if(this._node[1] === null) {
      this._node[0] = this._node[0].actualNode()
      this._node[1] = this._node[0].clone()
      ret.designedSegment = this
    } else if (this.allNodesExist) {
      const builtRoadSegment = this.commitSegment()
      // Split existing roads if node.snapPoint.isSegment
      // Fix all nodes of builtRoadSegment
      // Fix all roadSegments of these nodes
      ret.newRoadSegments = [builtRoadSegment]
      const newDesignedSegment = new RoadSegment()
      newDesignedSegment.setNodes(builtRoadSegment.lastNode, builtRoadSegment.lastNode.clone())
      newDesignedSegment.r = this.r
      ret.designedSegment = newDesignedSegment
    }
    return ret
  }

  revertLastStep () {
    console.log('Reverting last step: ', this)
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
    this._rSquared = r * r
  }

  get r () {
    return this._r
  }

  set view (view) {
    this._view = view
  }

  get view () {
    return this._view
  }

  get nodes () {
    return this._node
  }

  get rSquared () {
    return this._rSquared
  }

  distanceToSquared (point, minPoint) {
    return this._segment.distanceToSquared(point, this._rSquared, minPoint, ret => ret.segment = this)
  }
}
