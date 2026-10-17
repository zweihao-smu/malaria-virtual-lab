import { BloodFilmRenderer } from '../microscopy/BloodFilmRenderer.js'
import { FILM_W, FILM_H } from '../microscopy/CaseGenerator.js'

/**
 * 步骤 6：显微镜检查
 * 流程：10× 找血膜 → 40× 观察 → 滴香柏油 → 100× 油镜 → 找到并标记 3 个疟原虫
 * 交互：拖拽移动视野、滑块调焦、点击虫体标记
 */
const NEED_FOUND = 3

export default {
  id: 6,
  title: '显微镜检查',

  enter(ctx) {
    const { caseData } = ctx
    this.ctx = ctx
    this.renderer = new BloodFilmRenderer(caseData)
    this.objective = 10
    this.cx = FILM_W / 2
    this.cy = FILM_H / 2
    this.focus = 30          // 滑块值 0–100，最佳值随物镜变化
    this.bestFocus = { 10: 30, 40: 55, 100: 80 }
    this.oiled = false
    this._raf = null

    // 相机推近显微镜
    ctx.engine.moveCamera([70, 26, 30], [58, 12, 12], 1.4)

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '镜检流程：<b>10× 定位血膜 → 40× 观察 → 滴香柏油 → 100× 油镜细查</b>。找到虫体后点击标记，共需标记 3 个。'
      : null)

    // 绑定覆盖层控件
    this.$overlay = document.getElementById('microscope-overlay')
    this.$canvas = document.getElementById('view-canvas')
    this.$viewLabel = document.getElementById('view-label')
    this.$focus = document.getElementById('focus-slider')
    this.$focusState = document.getElementById('focus-state')
    this.$oil = document.getElementById('btn-oil')
    this.$found = document.getElementById('found-counter')
    this.$finish = document.getElementById('btn-finish-scope')
    this.$overlay.classList.remove('hidden')
    this.gctx = this.$canvas.getContext('2d')

    this._bindControls(ctx)
    this._loop()
  },

  _bindControls(ctx) {
    // 物镜按钮
    document.querySelectorAll('.obj-btn').forEach((btn) => {
      btn.onclick = () => {
        const obj = Number(btn.dataset.obj)
        this._switchObjective(ctx, obj, btn)
      }
    })
    // 香柏油
    this.$oil.onclick = () => {
      if (this.oiled) return
      this.oiled = true
      ctx.state.oiled = true
      this.$oil.textContent = '✓ 已滴加香柏油'
      this.$oil.classList.add('done')
      ctx.score.correct(6, '滴加香柏油')
      ctx.dialog.success('香柏油已滴加，现在可转 100× 油镜观察')
    }
    // 调焦
    this.$focus.oninput = () => {
      this.focus = Number(this.$focus.value)
      const err = this._focusError()
      this.$focusState.textContent = err < 0.08 ? '✓ 图像清晰' : err < 0.25 ? '接近清晰，继续微调' : '图像模糊'
      this.$focusState.style.color = err < 0.08 ? '#86efac' : '#fbbf24'
    }
    // 拖拽移动视野
    let dragging = false, lastX = 0, lastY = 0, moved = 0
    this.$canvas.onpointerdown = (e) => { dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY }
    window.onpointermove = (e) => {
      if (!dragging) return
      const d = this.renderer.viewDiameter(this.objective)
      const scale = d / this.$canvas.width
      this.cx -= (e.clientX - lastX) * scale
      this.cy -= (e.clientY - lastY) * scale
      moved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY)
      lastX = e.clientX; lastY = e.clientY
      this.cx = Math.max(200, Math.min(FILM_W - 200, this.cx))
      this.cy = Math.max(200, Math.min(FILM_H - 200, this.cy))
    }
    window.onpointerup = (e) => {
      if (dragging && moved < 6) this._clickView(ctx, e)
      dragging = false
    }
    // 方向键移动
    this._keyHandler = (e) => {
      const step = this.renderer.viewDiameter(this.objective) / 6
      if (e.key === 'ArrowLeft') this.cx -= step
      if (e.key === 'ArrowRight') this.cx += step
      if (e.key === 'ArrowUp') this.cy -= step
      if (e.key === 'ArrowDown') this.cy += step
      this.cx = Math.max(200, Math.min(FILM_W - 200, this.cx))
      this.cy = Math.max(200, Math.min(FILM_H - 200, this.cy))
    }
    window.addEventListener('keydown', this._keyHandler)

    this.$finish.onclick = () => this._finish(ctx)
  },

  _switchObjective(ctx, obj, btn) {
    if (obj === 100 && !this.oiled) {
      ctx.score.error(6, '未滴香柏油直接用油镜', '100× 油镜必须以香柏油为介质，否则无法成像且损伤镜头', 4)
      ctx.dialog.error('使用 100× 油镜前必须先在血膜上滴加香柏油！', '违反操作规程')
      return
    }
    this.objective = obj
    document.querySelectorAll('.obj-btn').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    this.$viewLabel.textContent = obj === 100 ? '100× 油镜' : `${obj}× 物镜`
    // 换物镜后需重新调焦
    this.focus = 20
    this.$focus.value = 20
    if (obj === 100) {
      ctx.state.usedOilObjective = true
      ctx.score.correct(6, '转换油镜观察')
    }
  },

  _focusError() {
    const best = this.bestFocus[this.objective]
    return Math.abs(this.focus - best) / 100
  },

  _clickView(ctx, e) {
    // 点击标记虫体
    const rect = this.$canvas.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * this.$canvas.width
    const py = ((e.clientY - rect.top) / rect.height) * this.$canvas.height
    const [fx, fy] = this.renderer.pxToFilm(px, py, this.cx, this.cy, this.objective)

    // 判定点击位置附近是否有虫体（容差按物镜缩放）
    const tol = this.renderer.viewDiameter(this.objective) * 0.08
    let hit = null
    for (const p of ctx.caseData.parasites) {
      if (Math.hypot(p.x - fx, p.y - fy) < tol) { hit = p; break }
    }
    if (hit) {
      if (hit.found) { ctx.dialog.info('该虫体已标记'); return }
      hit.found = true
      ctx.state.foundCount++
      ctx.score.correct(6, `标记虫体（${ctx.state.foundCount}）`)
      ctx.dialog.success('发现疟原虫感染红细胞！')
      this.$found.textContent = `已找到疟原虫：${ctx.state.foundCount} / ${NEED_FOUND}`
      if (ctx.state.foundCount >= NEED_FOUND) {
        this.$finish.disabled = false
        this.$finish.textContent = '完成镜检 →'
      }
    } else {
      ctx.score.error(6, '误标正常细胞', '该位置为正常血细胞，不是疟原虫', 2)
      ctx.dialog.error('此处为正常血细胞，请仔细辨认虫体特征（蓝色胞质+红色核）', '标记错误')
    }
  },

  _loop() {
    this.renderFrame()
    this._raf = requestAnimationFrame(() => this._loop())
  },

  /** 渲染一帧视野（公开以便测试环境手动驱动） */
  renderFrame() {
    const err = this._focusError()
    this.renderer.render(this.gctx, this.cx, this.cy, this.objective, err)
  },

  _finish(ctx) {
    if (this._finished) return
    if (!ctx.state.usedOilObjective) {
      ctx.dialog.error('请使用 100× 油镜确认虫体形态后再完成', '镜检不充分')
      ctx.score.error(6, '未用油镜确认', '油镜是疟原虫确诊的必要放大倍数', 3)
      return
    }
    this._finished = true
    cancelAnimationFrame(this._raf)
    window.removeEventListener('keydown', this._keyHandler)
    this.$overlay.classList.add('hidden')
    ctx.hud.showBanner('步骤 6 完成')
    setTimeout(() => ctx.nextStep(), 1200)
  },

  exit(ctx) {
    this._finished = true
    cancelAnimationFrame(this._raf)
    window.removeEventListener('keydown', this._keyHandler)
    document.getElementById('microscope-overlay').classList.add('hidden') // 兜底隐藏
    ctx.score.endStep(6)
  },
}
