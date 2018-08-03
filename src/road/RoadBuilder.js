import * as THREE from 'three'
import RoadSegment from './RoadSegment'
import SegmentNode from "./SegmentNode"

export default class RoadBuilder {
  constructor() {
    this._lastPoint = new THREE.Vector3()
    this._settings = { r: 3 }
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
    const rr = this._settings.r * this._settings.r
    if (intersectionPoint.d <= rr) {
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
    return this._designedRoadSegment.addStep()
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

  get object () {
    return this._object
  }

  settingsChanged (settings) {
    console.log('RoadBuilder settings: ', settings)
    this._settings = settings
    this._designedRoadSegment.r = this._settings.r
  }

  nextPosition(pos) {
    this._object.visible = true
    this._points.push(pos.p)
    const nOfPoints = this._points.length
    this._initCircle()
    if (nOfPoints > 2) {
      this._road.nextPoint(this._points[nOfPoints - 1])
    } else if (nOfPoints === 2) {
      // Create new road.
      this._road = new Road()
      this._road.r = this._settings.r
      this._road.nextPoint(this._points[0])
      this._road.nextPoint(this._points[1])
      this._road$.next(this._road)
    }
  }

  changePosition(pos) {
    this._object.visible = true
    this._lastPoint.set(pos.p.x, pos.p.y, pos.p.z + 0.2)
    const nOfPoints = this._points.length
    if (nOfPoints === 0) {
      this._object.position.copy(this._lastPoint)
    } else {
      this.createSegment(nOfPoints - 1, pos.p, this._segments[0])
      if (this._segments[0].len < 0.1) return
      this.createOutline(0, 0, this._outline)
      this.rebuildShape()
      this._object.geometry = new THREE.ShapeGeometry(this._shape)
      this._object.position.set(0, 0, 0.2)
    }
  }
}
