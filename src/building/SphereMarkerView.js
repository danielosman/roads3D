import * as THREE from 'three'

export default class SphereMarkerView {
  constructor(s) {
    const defaults = { r: 1 }
    this._params = { ...defaults, ...s }
    const geometry = new THREE.SphereGeometry(this._params.r, 8, 8)
    const material = new THREE.MeshBasicMaterial({ color: 0xee5533 })
    this._object = new THREE.Mesh(geometry, material)
    this._object.visible = false
    console.log("SphereMarkerView created.")
  }

  setPosition (p) {
    if (!p) {
      this._object.visible = false
      return
    }
    this._object.visible = true
    this._object.position.copy(p)
  }

  get object () {
    return this._object
  }
}
