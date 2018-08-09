import RoadSegmentViewBase from "./RoadSegmentViewBase"

export default class RoadSegmentView extends RoadSegmentViewBase {
  constructor () {
    super({ z: 0.1, material: { color: 0x474747 } })
    this._initObject()
  }
}
