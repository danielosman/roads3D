import * as THREE from 'three'
import RoadSegment from './RoadSegment'
import SegmentNode from "./SegmentNode"

export default class RoadBuilder {
  constructor() {
    this._lastPoint = new THREE.Vector3()
    this._settings = { r: 3 }
    this._snapDistanceSquared = this.snapDistanceSquared
    this._designedRoadSegment = this.createInitialRoadSegment()
  }

  handleStateTransition ([fromState, toState]) {
    if (fromState.state !== 'addRoad' && toState.state !== 'addRoad' ) return
    console.log('RoadBuilder state transition: ', fromState, toState)
    if (toState.state === 'addRoad') {
      if (toState.settings) {
        this.settingsChanged(toState.settings)
      }
    } else if (toState.state === 'null') {
      this.cancel(toState)
    } else {
      this.cancelAll()
    }
    return toState
  }

  confirmSnap (intersectionPoint) {
    if (intersectionPoint.d <= this._snapDistanceSquared) {
      intersectionPoint.snapped = true
    }
    return intersectionPoint
  }

  modifyRoadSegment (intersectionPoint) {
    this._designedRoadSegment.lastExistingNode.modifyFromSnapPoint(intersectionPoint)
    this._designedRoadSegment.buildSegment()
    return this._designedRoadSegment
  }

  addStep () {
    const stepResult = this._designedRoadSegment.addStep()
    this._designedRoadSegment = stepResult.designedSegment
    return stepResult
  }

  cancel (currentState) {
    this._designedRoadSegment.revertLastStep()
    if (this._designedRoadSegment.numberOfExistingNodes === 0) {
      this.cancelAll()
    } else {
      currentState.state = 'addRoad'
    }
  }

  cancelAll () {
    this._designedRoadSegment = this.createInitialRoadSegment()
  }

  get snapDistanceSquared () {
    return this._settings.r * this._settings.r + 100
  }

  createInitialRoadSegment () {
    const roadSegment = new RoadSegment()
    roadSegment.firstNode = new SegmentNode()
    roadSegment.firstNode.p.copy(this._lastPoint)
    roadSegment.r = this._settings.r
    return roadSegment
  }

  get designedRoadSegment () {
    return this._designedRoadSegment
  }

  settingsChanged (settings) {
    console.log('RoadBuilder settings: ', settings)
    this._settings = settings
    this._designedRoadSegment.r = this._settings.r
    this._snapDistanceSquared = this.snapDistanceSquared
  }
}
