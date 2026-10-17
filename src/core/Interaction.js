import * as THREE from 'three'

/**
 * 交互管理：射线拾取、悬停高亮、点击与拖拽回调。
 * 步骤模块通过 register() 声明当前可交互物体，由 StepManager 在每步切换时重置。
 */
export class Interaction {
  constructor(engine) {
    this.engine = engine
    this.raycaster = new THREE.Raycaster()
    this.pointer = new THREE.Vector2()
    this.entries = new Map() // rootObject -> { handlers, meshes }
    this.hovered = null
    this.dragging = null
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) // 默认台面平面
    this.enabled = true

    const el = engine.renderer.domElement
    el.addEventListener('pointermove', (e) => this._onPointerMove(e))
    el.addEventListener('pointerdown', (e) => this._onPointerDown(e))
    el.addEventListener('pointerup', (e) => this._onPointerUp(e))
  }

  /**
   * 注册可交互物体
   * @param {THREE.Object3D} obj 根物体（射线命中其任意子网格都算）
   * @param {object} handlers { click, dragStart, drag, dragEnd, enabled }
   */
  register(obj, handlers = {}) {
    const meshes = []
    obj.traverse((c) => { if (c.isMesh) meshes.push(c) })
    this.entries.set(obj, { handlers, meshes })
  }

  unregister(obj) { this.entries.delete(obj) }

  /** 清除全部注册（步骤切换时调用） */
  clear() {
    this.entries.clear()
    this._setHighlight(null)
    this.hovered = null
    this.dragging = null
  }

  _raycast(event) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.engine.camera)

    let best = null
    for (const [obj, entry] of this.entries) {
      if (entry.handlers.enabled && !entry.handlers.enabled()) continue
      const hits = this.raycaster.intersectObjects(entry.meshes, false)
      if (hits.length && (!best || hits[0].distance < best.distance)) {
        best = { obj, entry, distance: hits[0].distance, point: hits[0].point }
      }
    }
    return best
  }

  _setHighlight(obj) {
    // 恢复旧高亮
    if (this.hovered && this.hovered !== obj) {
      this.hovered.traverse((c) => {
        if (c.isMesh && c.userData._origEmissive !== undefined) {
          c.material.emissive?.setHex(c.userData._origEmissive)
        }
      })
    }
    // 设置新高亮
    if (obj && this.hovered !== obj) {
      obj.traverse((c) => {
        if (c.isMesh && c.material.emissive) {
          if (c.userData._origEmissive === undefined) c.userData._origEmissive = c.material.emissive.getHex()
          c.material.emissive.setHex(0x3a4a6b)
        }
      })
    }
    this.hovered = obj
  }

  _updatePointer(e) {
    const rect = this.engine.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.engine.camera)
  }

  _onPointerMove(e) {
    if (!this.enabled) return
    this._updatePointer(e)
    if (this.dragging) {
      const point = new THREE.Vector3()
      if (this.raycaster.ray.intersectPlane(this.dragPlane, point)) {
        this.dragging.entry.handlers.drag?.(point, e)
      }
      return
    }
    const hit = this._raycast(e)
    this._setHighlight(hit?.obj ?? null)
    this.engine.renderer.domElement.style.cursor = hit ? 'pointer' : 'default'
  }

  _onPointerDown(e) {
    if (!this.enabled || e.button !== 0) return
    this._updatePointer(e)
    const hit = this._raycast(e)
    if (!hit) return
    // 记录按下位置，用于区分"点击"与"拖拽"
    this._downX = e.clientX
    this._downY = e.clientY
    if (hit.entry.handlers.drag) {
      this.dragging = hit
      this.engine.controls.enabled = false // 拖拽物品时锁定相机
      const point = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this.dragPlane, point)
      hit.entry.handlers.dragStart?.(point, e)
    }
  }

  _onPointerUp(e) {
    if (!this.enabled) return
    if (this.dragging) {
      const { entry } = this.dragging
      this.dragging = null
      this.engine.controls.enabled = true
      entry.handlers.dragEnd?.(e)
      // 位移很小视为点击：补发 click（拖拽类物体也需要支持点击选中）
      const moved = Math.hypot(e.clientX - this._downX, e.clientY - this._downY)
      if (moved < 6) {
        this._updatePointer(e)
        const hit = this._raycast(e)
        hit?.entry.handlers.click?.(hit.point, e)
      }
      return
    }
    const hit = this._raycast(e)
    hit?.entry.handlers.click?.(hit.point, e)
  }
}
