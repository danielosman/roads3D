import Segment from "./Segment"
import SegmentNode from "./SegmentNode"
import * as THREE from "three"

export default class RoadSegment {
  constructor() {
    this._id = THREE.Math.generateUUID()
    this._nodes = [null, null]
    this._segment = new Segment()
    this._r = 3
    this._rSquared = 9

    this._view = null
  }

  clone () {
    const ret = new RoadSegment()
    this._nodes.forEach((n, i) => ret._nodes[i] = n)
    ret._segment = this._segment.clone()
    ret._r = this._r
    ret._rSquared = this._rSquared
    return ret
  }

  setNodes (n0, n1) {
    this._nodes[0] = n0
    this._nodes[1] = n1
    this._segment.setNodes(this._nodes[0].p, this._nodes[1].p)
  }

  buildSegment () {
    if (this.allNodesExist) {
      this._segment.setNodes(this._nodes[0].p, this._nodes[1].p)
    }
  }

  commitSegment () {
    this._nodes[1] = this._nodes[1].actualNode()
    const builtRoadSegment = this.clone()
    builtRoadSegment.nodes[0].addDir(+1, builtRoadSegment)
    builtRoadSegment.nodes[1].addDir(-1, builtRoadSegment)
    return builtRoadSegment
  }

  addStep () {
    const ret = {}
    if (this._nodes[0] === null) {
      this._nodes[0] = new SegmentNode()
      ret.designedSegment = this
    } else if(this._nodes[1] === null) {
      this._nodes[0] = this._nodes[0].actualNode()
      this._nodes[1] = this._nodes[0].clone()
      ret.designedSegment = this
    } else if (this.allNodesExist) {
      // Create builtRoadSegment with fixed nodes
      const builtRoadSegment = this.commitSegment()
      // Split existing roads if node.snapPoint.isSegment
      ret.removedRoadSegments = builtRoadSegment.splitNeighbours()
      ret.newRoadSegments = builtRoadSegment.relatedSegments
      // Fix lengths of all ret.newRoadSegments
      ret.newRoadSegmentNodes = builtRoadSegment.nodes
      const newDesignedSegment = new RoadSegment()
      newDesignedSegment.setNodes(builtRoadSegment.lastNode, builtRoadSegment.lastNode.clone())
      newDesignedSegment.r = this.r
      ret.designedSegment = newDesignedSegment
    }
    return ret
  }

  splitNeighbours () {
    const splitSegments = []
    this._nodes.forEach((n, i) => {
      const snapPoint = n.snapPoint
      if (snapPoint && snapPoint.isSegment) {
        console.log('Splitting segment: ', snapPoint.segment)
        splitSegments.push(snapPoint.segment)
        const s1 = new RoadSegment()
        s1.r = this.r
        s1.setNodes(snapPoint.segment.firstNode, n)
        s1.nodes[0].addDir(+1, s1)
        s1.nodes[1].addDir(-1, s1)
        const s2 = new RoadSegment()
        s2.r = this.r
        s2.setNodes(n, snapPoint.segment.lastNode)
        s2.nodes[0].addDir(+1, s2)
        s2.nodes[1].addDir(-1, s2)
        snapPoint.segment.remove()
      }
      n.removeSnapPoint()
    })
    return splitSegments
  }

  remove () {
    this._nodes.forEach(n => n.removeSegment(this))
  }

  revertLastStep () {
    console.log('Reverting last step: ', this)
    this._nodes[0] = this._nodes[1]
    this._nodes[1] = null
    this._segment.reset()
  }

  get segment () {
    return this._segment
  }

  get allNodesExist () {
    return this._nodes[0] !== null && this._nodes[1] !== null
  }

  get numberOfExistingNodes () {
    return this._nodes.filter(n => n !== null).length
  }

  get lastExistingNode () {
    if (this._nodes[0] === null) return null
    if (this._nodes[1] !== null) return this._nodes[1]
    return this._nodes[0]
  }

  set lastNode (lastNode) {
    this._nodes[1] = lastNode
  }

  get lastNode () {
    return this._nodes[1]
  }

  set firstNode (firstNode) {
    this._nodes[0] = firstNode
  }

  get firstNode () {
    return this._nodes[0]
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
    return this._nodes
  }

  get relatedSegments () {
    const gatheredSegments = [this]
    this._nodes.forEach(n => {
      n.segmentDirs.forEach(sd => {
        if (!gatheredSegments.find(gs => gs._id === sd.segment._id)) {
          gatheredSegments.push(sd.segment)
        }
      })
    })
    return gatheredSegments
  }

  get rSquared () {
    return this._rSquared
  }

  distanceToSquared (point, minPoint) {
    return this._segment.distanceToSquared(point, this._rSquared, minPoint, ret => ret.segment = this)
  }
}
