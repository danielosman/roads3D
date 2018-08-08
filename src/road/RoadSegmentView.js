import RoadSegmentViewBase from "./RoadSegmentViewBase"

export default class RoadSegmentView extends RoadSegmentViewBase {
  constructor (model) {
    super({ z: 0.1, material: { color: 0x474747 } })
    model.view = this
    this._initObject()
    this.buildObject(model)
  }
}
