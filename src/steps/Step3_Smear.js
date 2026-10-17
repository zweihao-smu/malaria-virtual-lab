import * as THREE from 'three'
import { createThickFilm, createThinFilm } from '../models/Slide.js'

/**
 * 步骤 3：推片（厚血膜 + 薄血膜）
 * 厚血膜：持推片在血滴上画圆涂开（判定：拖动距离）
 * 薄血膜：选择推片角度（30–45° 合格）后沿玻片匀速拖动（判定：角度、直线性、速度均匀性）
 */
export default {
  id: 3,
  title: '血膜制作（推片）',

  enter(ctx) {
    const { interaction, lab } = ctx
    this._pusherInHand = false
    this._target = null       // 'A' | 'B'
    this._dragPoints = []     // 拖动轨迹 [{x,z,t}]
    this._angle = 60          // 推片角度，默认错误值让学生调整

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '先制作<b>厚血膜</b>：点击<b>推片</b>拿起，再点击载玻片A上的血滴，然后按住拖动把血滴涂开成圆形。'
      : null)

    interaction.register(lab.pusher, { click: () => this._takePusher(ctx) })
    interaction.register(lab.slideA, {
      click: () => this._selectTarget(ctx, 'A'),
      dragStart: (p) => this._dragStart(ctx, 'A', p),
      drag: (p) => this._drag(ctx, p),
      dragEnd: () => this._dragEnd(ctx, 'A'),
    })
    interaction.register(lab.slideB, {
      click: () => this._selectTarget(ctx, 'B'),
      dragStart: (p) => this._dragStart(ctx, 'B', p),
      drag: (p) => this._drag(ctx, p),
      dragEnd: () => this._dragEnd(ctx, 'B'),
    })
  },

  _takePusher(ctx) {
    if (this._pusherInHand) { ctx.dialog.info('推片已在手中'); return }
    this._pusherInHand = true
    ctx.score.correct(3, '拿起推片')
    ctx.dialog.success('已拿起推片。请点击要制作的血膜（先A厚膜，后B薄膜）')
    // 视觉反馈：推片略抬起并高亮
    ctx.lab.pusher.position.y = 1.2
  },

  _selectTarget(ctx, which) {
    const { state, dialog } = ctx
    if (!this._pusherInHand) { dialog.info('请先点击拿起推片'); return }
    if (which === 'A' && state.thickFilmQuality) { dialog.info('厚血膜已制作完成'); return }
    if (which === 'B' && state.thinFilmQuality) { dialog.info('薄血膜已制作完成'); return }
    if (which === 'B' && !state.thickFilmQuality) {
      dialog.info('建议先制作厚血膜（A），再制作薄血膜（B）')
    }
    this._target = which
    if (which === 'B') this._showAngleSlider(ctx)
    else this._hideAngleSlider()
    dialog.info(`已对准载玻片${which}，<b>按住血膜区域并拖动</b>进行推片`)
  },

  _dragStart(ctx, which, point) {
    if (!this._pusherInHand || this._target !== which) return
    // 已完成的血膜不可重复推片
    if (which === 'A' && ctx.state.thickFilmQuality) return
    if (which === 'B' && ctx.state.thinFilmQuality) return
    this._dragPoints = [{ x: point.x, z: point.z, t: performance.now() }]
  },

  _drag(ctx, point) {
    if (!this._dragPoints.length) return
    this._dragPoints.push({ x: point.x, z: point.z, t: performance.now() })
  },

  _dragEnd(ctx, which) {
    const { state, dialog, score, lab } = ctx
    if (!this._pusherInHand || this._target !== which || this._dragPoints.length < 4) {
      this._dragPoints = []
      return
    }
    const pts = this._dragPoints
    this._dragPoints = []

    // 轨迹分析
    let dist = 0
    const speeds = []
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dz = pts[i].z - pts[i - 1].z
      const dt = Math.max(pts[i].t - pts[i - 1].t, 1)
      const d = Math.hypot(dx, dz)
      dist += d
      speeds.push(d / dt * 1000)
    }
    // 速度变异系数（越小越均匀）
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length
    const sd = Math.sqrt(speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length)
    const cv = mean > 0 ? sd / mean : 1
    // 直线性：首尾连线 vs 实际路径
    const line = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z)
    const straightness = dist > 0 ? line / dist : 0

    const slide = which === 'A' ? lab.slideA : lab.slideB
    const anchor = slide.userData.bloodAnchor.clone()
    slide.localToWorld(anchor)

    if (which === 'A') {
      // 厚血膜：要求足够的涂开距离
      let quality, msg
      if (dist < 8) { quality = 'thick'; msg = '涂开不充分，厚血膜过厚，虫体堆积难辨认' }
      else if (dist > 30) { quality = 'broken'; msg = '过度涂抹，血膜破裂' }
      else { quality = 'good'; msg = '厚血膜直径约 1cm，厚薄适中' }
      state.thickFilmQuality = quality
      // 移除血滴，换上血膜
      this._removeDrop(ctx, slide)
      const film = createThickFilm()
      film.position.copy(anchor)
      film.position.y = 0.16
      ctx.engine.scene.add(film)
      if (quality === 'good') { score.correct(3, '厚血膜制作优良'); dialog.success(msg, '厚血膜完成') }
      else { score.error(3, '厚血膜质量不佳', msg, 4); dialog.error(msg, '厚血膜不合格') }
    } else {
      // 薄血膜：角度 + 直线性 + 速度均匀性
      const angleOk = this._angle >= 30 && this._angle <= 45
      let quality = 'good'
      const problems = []
      if (!angleOk) { quality = 'thick'; problems.push(`推片角度 ${this._angle}°（应为 30–45°）`) }
      if (straightness < 0.85) { quality = 'broken'; problems.push('拖动方向不直，血膜断裂') }
      if (cv > 0.75) { quality = 'broken'; problems.push('推片速度不匀，血膜出现波纹') }
      if (dist < 4) { quality = 'broken'; problems.push('推片距离太短，未形成薄层') }
      state.thinFilmQuality = quality
      this._removeDrop(ctx, slide)
      const film = createThinFilm(quality)
      film.position.copy(anchor)
      film.position.y = 0.16
      film.rotation.y = Math.PI / 2 // 舌状朝左展开
      ctx.engine.scene.add(film)
      if (quality === 'good') {
        score.correct(3, `薄血膜制作优良（角度 ${this._angle}°）`)
        dialog.success('血膜呈均匀舌状，边缘整齐', '薄血膜完成')
      } else {
        score.error(3, '薄血膜质量不佳', problems.join('；'), 5)
        dialog.error(problems.join('<br>'), '薄血膜不合格')
      }
      this._hideAngleSlider()
    }

    // 两片都完成 → 等待干燥后进入下一步
    if (state.thickFilmQuality && state.thinFilmQuality) {
      dialog.info('血膜制作完成，自然晾干中（约 3 秒）…')
      setTimeout(() => {
        state.filmDry = true
        ctx.hud.showBanner('步骤 3 完成')
        setTimeout(() => ctx.nextStep(), 1500)
      }, 3000)
    }
  },

  _removeDrop(ctx, slide) {
    // 删除该玻片上的血滴（通过位置匹配 scene 中的 bloodDrop）
    const anchor = slide.userData.bloodAnchor.clone()
    slide.localToWorld(anchor)
    const toRemove = []
    ctx.engine.scene.traverse((o) => {
      if (o.name === 'bloodDrop' && o.position.distanceTo(anchor) < 1.2) toRemove.push(o)
    })
    toRemove.forEach((o) => ctx.engine.scene.remove(o))
  },

  _showAngleSlider(ctx) {
    if (this._sliderEl) return
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:12px 20px;border-radius:12px;z-index:40;font-size:14px;min-width:320px;'
    el.innerHTML = `推片角度：<b id="angle-val">${this._angle}°</b>（标准 30–45°）<br>
      <input type="range" id="angle-slider" min="15" max="75" value="${this._angle}" style="width:100%;accent-color:#38bdf8;margin-top:6px;">`
    document.body.appendChild(el)
    el.querySelector('#angle-slider').addEventListener('input', (e) => {
      this._angle = Number(e.target.value)
      el.querySelector('#angle-val').textContent = `${this._angle}°`
    })
    this._sliderEl = el
  },
  _hideAngleSlider() {
    if (this._sliderEl) { this._sliderEl.remove(); this._sliderEl = null }
  },

  exit(ctx) {
    this._hideAngleSlider()
    ctx.score.endStep(3)
    ctx.lab.pusher.position.y = 0.1
    void THREE
  },
}
