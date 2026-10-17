/**
 * ScopeView：可复用的虚拟显微镜视野组件。
 * 把一张真实血涂片照片当作"玻片"，支持：
 *   - 物镜切换（10×/40×/100×，改变放大倍率）
 *   - 粗/细准焦螺旋（偏离焦平面 → 图像模糊）
 *   - 拖拽移动视野（在照片范围内平移）
 * 小尺寸照片会自动限制最大放大倍数，避免过度拉伸失真。
 */
export class ScopeView {
  static ZOOM = { 10: 1, 40: 2.6, 100: 5.2 }        // 各物镜相对全图的放大倍率
  static OPTIMUM = { 10: 25, 40: 55, 100: 80 }      // 各物镜的焦平面位置（低倍远、高倍近，模拟真实镜筒长度）

  /**
   * @param {HTMLCanvasElement} canvas 视野画布（圆形裁切由 CSS 负责）
   * @param {string} src 血涂片照片 URL
   */
  constructor(canvas, src) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.off = document.createElement('canvas')
    this.offCtx = this.off.getContext('2d')
    this.objective = 10
    this.coarse = 12   // 粗调初始远离焦点 → 初始模糊，需要学生先调焦
    this.fine = 50     // 细调居中
    this.cx = 0.5      // 视野中心（照片比例坐标 0–1）
    this.cy = 0.5
    this.ready = false
    this.img = new Image()
    this.img.onload = () => { this.ready = true; this.render() }
    this.img.src = src
    this._bindPan()
  }

  /** 当前焦点位置：细调在粗调基础上微调 ±6 */
  get focusPos() { return this.coarse + (this.fine - 50) * 0.12 }

  /** 焦距偏差 0–1（0 = 清晰） */
  get focusError() {
    return Math.min(Math.abs(this.focusPos - ScopeView.OPTIMUM[this.objective]) / 25, 1)
  }

  isSharp() { return this.focusError < 0.12 }

  /** 当前放大倍率（小图自动限倍） */
  zoom() {
    const z = ScopeView.ZOOM[this.objective]
    if (!this.ready) return z
    const maxZ = Math.min(this.img.width, this.img.height) / 160
    return Math.min(z, Math.max(1, maxZ))
  }

  setObjective(o) { this.objective = o; this.render() }
  setCoarse(v) { this.coarse = Number(v); this.render() }
  setFine(v) { this.fine = Number(v); this.render() }

  _bindPan() {
    let drag = null
    this.canvas.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY }
      try { this.canvas.setPointerCapture(e.pointerId) } catch { /* 合成事件无真实指针，忽略 */ }
    })
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag || !this.ready) return
      const side = Math.min(this.img.width, this.img.height) / this.zoom()
      // 拖拽方向与视野移动方向相反（移动载物台的效果）
      this.cx -= ((e.clientX - drag.x) / this.canvas.width) * side / this.img.width
      this.cy -= ((e.clientY - drag.y) / this.canvas.height) * side / this.img.height
      const mx = (side / 2) / this.img.width
      const my = (side / 2) / this.img.height
      this.cx = Math.min(Math.max(this.cx, mx), 1 - mx)
      this.cy = Math.min(Math.max(this.cy, my), 1 - my)
      drag = { x: e.clientX, y: e.clientY }
      this.render()
    })
    const end = () => { drag = null }
    this.canvas.addEventListener('pointerup', end)
    this.canvas.addEventListener('pointercancel', end)
  }

  render() {
    const size = this.canvas.width
    if (!this.ready) {
      this.ctx.fillStyle = '#111827'
      this.ctx.fillRect(0, 0, size, size)
      return
    }
    const side = Math.min(this.img.width, this.img.height) / this.zoom()
    const sx = this.cx * this.img.width - side / 2
    const sy = this.cy * this.img.height - side / 2
    this.off.width = size
    this.off.height = size
    this.offCtx.fillStyle = '#efe9dc'
    this.offCtx.fillRect(0, 0, size, size)
    this.offCtx.drawImage(this.img, sx, sy, side, side, 0, 0, size, size)
    this.ctx.clearRect(0, 0, size, size)
    this.ctx.save()
    const blur = this.focusError * 10
    this.ctx.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : 'none'
    this.ctx.drawImage(this.off, 0, 0)
    this.ctx.restore()
    this.onStateChange?.()
  }
}
