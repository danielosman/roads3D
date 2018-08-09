import RoadSegmentViewBase from "./RoadSegmentViewBase"

export default class DesignedRoadSegmentView extends RoadSegmentViewBase {
  constructor () {
    super({ z: 0.2, material: { color: 0x4488ff, transparent: true, opacity: 0.66 } })
    this._initObject()
  }
}
