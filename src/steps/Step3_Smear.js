import * as THREE from 'three'
import { createThickFilm } from '../models/Slide.js'

/**
 * 步骤 3：血膜制作（3D 实时反馈版，移植自 malaria-smear-sim 的 3D 模块）
 *
 * 厚血膜（A）：推片以"尖角"接触血滴，跟随指针画圈搅拌；
 *   血斑按 8 扇区覆盖度实时生长，血滴随搅拌摊平消失。
 *   判定：最终直径 0.8–1.2 cm + 搅拌均匀（每扇区扫过 ≥1.5 rad）。
 * 薄血膜（B）：推片按滑块角度真实倾斜，拖动时血膜条带在推片身后实时生长，
 *   厚度 ∝ tan(角度)/速度；速度突变处出现断带白条。
 *   判定：角度(30–45°)、直线性、速度均匀性（沿用原轨迹分析）。
 *
 * 兼容约束：最终血膜必须命名为 thinFilm / thickFilm、材质为单一 material、
 * 位置在 bloodAnchor 1.5 范围内——Step4/Step5 按此查找并改色。
 */

const SLIDE_TOP = 0.24      // 玻片表面世界高度
// 血膜在玻片表面之上（底面高出 0.005 避免深度冲突）。
// 曾嵌在玻璃内部（0.16）：正俯视时透明玻璃后渲染盖住血膜，薄的体部/舌尖被
// 冲淡到不可见，只剩最厚的头部——血膜应涂于玻片表面，任何视角可见。
const FILM_Y = 0.245
const THICK_SECTORS = 8
const SECTOR_NEED = 1.5     // 每扇区至少扫过 1.5 rad 算涂匀
const PATCH_R0 = 0.27       // 血斑初始半径 cm
const PATCH_R_MAX = 0.62
const PATCH_GROW = 0.0154   // cm/rad：约 2.5 圈从 0.55 cm 涂到 1.0 cm

export default {
  id: 3,
  title: '血膜制作（推片）',

  enter(ctx) {
    const { interaction, lab } = ctx
    this._pusherInHand = false
    this._target = null
    this._dragPoints = []
    this._angle = 60 // 推片角度，默认错误值让学生调整
    // 推片原始摆位（步骤结束时还原）
    this._pusherHome = { pos: lab.pusher.position.clone(), rot: lab.pusher.rotation.clone() }
    // 推片姿态枢轴：把推片重挂到枢轴下，枢轴原点=接触点（棱边或尖角）
    this._pivot = null
    this._ribbon = null       // 薄血膜条带 mesh（thinFilm）
    this._samples = []        // 薄血膜采样 {sx, v, th, w, streak}
    this._patch = null        // 厚血膜扇区 group
    this._patchR = PATCH_R0
    this._sectorSweep = new Array(THICK_SECTORS).fill(0)
    this._sweepSum = 0
    this._drop = null
    this._anchor = null       // 当前玻片锚点（世界坐标）

    // 拉近视角便于观察血膜生长
    ctx.engine.moveCamera([-3, 16, 20], [-3, 0, 2], 1.2)

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '先制作<b>厚血膜</b>：点击<b>推片</b>拿起，再点击载玻片A，然后<b>按住血滴画圈</b>涂成约 1cm 圆斑。'
      : null)

    // 推片既响应点击（拿起），也作为拖拽手柄：选定玻片后拖动推片本体即开始涂片。
    // 必须如此——倾斜的推片板面会遮挡玻片锚点区域，若只在玻片上接收拖拽起点，
    // 学生在血滴处按下会被推片"吞掉"，无法开始拖动。
    interaction.register(lab.pusher, {
      click: () => this._takePusher(ctx),
      dragStart: (p) => { if (this._target) this._dragStart(ctx, this._target, p) },
      drag: (p) => this._drag(ctx, p),
      dragEnd: () => { if (this._target) this._dragEnd(ctx, this._target) },
    })
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

  // ---------- 推片姿态 ----------
  /** 把推片挂到枢轴下：mode 'edge'（薄血膜棱边接触）| 'corner'（厚血膜尖角接触） */
  _rigPusher(ctx, mode) {
    const { lab, engine } = ctx
    if (this._pivot) engine.scene.remove(this._pivot)
    const pivot = new THREE.Group()
    engine.scene.add(pivot)
    pivot.add(lab.pusher) // 重挂（自动脱离原父级）
    if (mode === 'edge') {
      // 棱边（短端工作边，带蓝条）落在枢轴原点；推片绕 y 翻面使板面向 -x
      // （血膜侧）延伸，枢轴绕 z 旋转 +α 后板面向血膜上方后仰、开口朝推进
      // 方向——若板面朝 +x 再配负角会插进台面（穿帮且推片几乎不可见）
      lab.pusher.position.set(-3.8, 0, 0)
      lab.pusher.rotation.set(0, Math.PI, 0)
    } else {
      // 下角点落在枢轴原点；后仰 + 偏航 → 只留尖角接触
      lab.pusher.position.set(3.8, 0, -1.3)
      lab.pusher.rotation.set(0, 0, 0)
      pivot.rotation.z = 0.45
      pivot.rotation.y = 0.55
    }
    this._pivot = pivot
    return pivot
  },

  _unrigPusher(ctx) {
    const { lab, engine } = ctx
    if (this._pivot) { engine.scene.remove(this._pivot); this._pivot = null }
    engine.scene.add(lab.pusher)
    lab.pusher.position.copy(this._pusherHome.pos)
    lab.pusher.rotation.copy(this._pusherHome.rot)
  },

  _takePusher(ctx) {
    if (this._pusherInHand) { ctx.dialog.info('推片已在手中'); return }
    this._pusherInHand = true
    ctx.score.correct(3, '拿起推片')
    ctx.dialog.success('已拿起推片。请点击要制作的血膜（先A厚膜，后B薄膜）')
    ctx.lab.pusher.position.y = 1.2 // 高亮反馈
  },

  _selectTarget(ctx, which) {
    const { state, dialog, lab } = ctx
    if (!this._pusherInHand) { dialog.info('请先点击拿起推片'); return }
    if (which === 'A' && state.thickFilmQuality) { dialog.info('厚血膜已制作完成'); return }
    if (which === 'B' && state.thinFilmQuality) { dialog.info('薄血膜已制作完成'); return }
    if (which === 'B' && !state.thickFilmQuality) {
      dialog.info('建议先制作厚血膜（A），再制作薄血膜（B）')
    }
    this._target = which
    const slide = which === 'A' ? lab.slideA : lab.slideB
    // 厚血膜滴于玻片中央（thickAnchor），薄血膜用左侧滴血锚点（bloodAnchor）
    const anchor = (which === 'A' ? slide.userData.thickAnchor : slide.userData.bloodAnchor).clone()
    slide.localToWorld(anchor)
    this._anchor = anchor

    // 摆好推片姿态：厚血膜尖角 / 薄血膜倾角棱边
    const pivot = this._rigPusher(ctx, which === 'A' ? 'corner' : 'edge')
    if (which === 'A') {
      pivot.position.set(anchor.x, SLIDE_TOP, anchor.z)
      this._hideAngleSlider()
      dialog.info('已对准载玻片A，<b>按住血滴画圈搅拌</b>，涂成约 1cm 圆斑')
    } else {
      pivot.position.set(anchor.x + 0.15, SLIDE_TOP, anchor.z) // 蓝边轻贴血滴右缘
      this._setPivotAngle() // 按当前滑块值倾斜
      this._showAngleSlider(ctx)
      dialog.info('已对准载玻片B，调好角度后<b>按住向右匀速推片</b>')
    }
  },

  _setPivotAngle() {
    if (!this._pivot) return
    // 推片已翻面（板面向 -x/血膜侧延伸）：必须配 -α，自由端才向上抬起
    // （(-d,0) 绕 z 转 -α 后 y=+d·sinα）；配 +α 板面会沉入台面穿模
    this._pivot.rotation.set(0, 0, (-this._angle * Math.PI) / 180)
  },

  // ---------- 拖动 ----------
  _dragStart(ctx, which, point) {
    if (!this._pusherInHand || this._target !== which) return
    if (which === 'A' && ctx.state.thickFilmQuality) return
    if (which === 'B' && ctx.state.thinFilmQuality) return
    this._dragPoints = [{ x: point.x, z: point.z, t: performance.now() }]
    if (which === 'A') {
      this._patchR = PATCH_R0
      this._sectorSweep = new Array(THICK_SECTORS).fill(0)
      this._sweepSum = 0
      this._drop = this._findDrop(ctx)
      this._rebuildPatch(ctx)
    } else {
      this._samples = []
      // 血滴被推片"带走"：开始推时隐藏
      const drop = this._findDrop(ctx)
      if (drop) drop.visible = false
      this._lastSx = null
    }
  },

  _drag(ctx, point) {
    if (!this._dragPoints.length) return
    this._dragPoints.push({ x: point.x, z: point.z, t: performance.now() })
    if (this._target === 'A') this._stirThick(ctx, point)
    else this._pushThin(ctx, point)
  },

  // ---- 厚血膜：尖角跟随 + 圆斑生长 + 血滴摊平 ----
  _stirThick(ctx, p) {
    const a = this._anchor
    if (this._pivot) this._pivot.position.set(p.x, SLIDE_TOP, p.z)
    const dx = p.x - a.x, dz = p.z - a.z
    if (Math.hypot(dx, dz) < 0.12) return // 贴着中心打转不算涂
    const theta = Math.atan2(dz, dx)
    if (this._lastTheta === undefined || this._lastTheta === null) { this._lastTheta = theta; return }
    let d = theta - this._lastTheta
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    this._lastTheta = theta
    const sweep = Math.abs(d)
    if (sweep < 0.005) return
    const idx = Math.floor(((theta + Math.PI) / (2 * Math.PI)) * THICK_SECTORS) % THICK_SECTORS
    this._sectorSweep[idx] += sweep
    this._sweepSum += sweep
    // 血滴随搅拌摊平，满一圈基本并入血斑
    if (this._drop) {
      const f = Math.min(this._sweepSum / (Math.PI * 2), 1)
      this._drop.scale.set(1 + f * 0.6, 0.55 * (1 - f * 0.95), 1 + f * 0.6)
      if (f >= 0.98) { ctx.engine.scene.remove(this._drop); this._drop = null }
    }
    this._patchR = Math.min(this._patchR + sweep * PATCH_GROW, PATCH_R_MAX)
    this._rebuildPatch(ctx)
  },

  _rebuildPatch(ctx) {
    if (this._patch) { ctx.engine.scene.remove(this._patch) }
    const group = new THREE.Group()
    const a = this._anchor
    const r = this._patchR
    for (let i = 0; i < THICK_SECTORS; i++) {
      const a0 = -Math.PI + (i * Math.PI) / 4
      const geo = new THREE.CircleGeometry(r, 6, a0, Math.PI / 4)
      geo.rotateX(-Math.PI / 2)
      const coverage = Math.min(this._sectorSweep[i] / SECTOR_NEED, 1)
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: 0x8f1d1d, roughness: 0.5,
        transparent: true, opacity: 0.3 + 0.65 * coverage,
        side: THREE.DoubleSide,
      }))
      group.add(m)
    }
    // 1 cm 参考圈
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.5, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.6 })
    )
    ring.position.y = 0.005
    group.add(ring)
    group.position.set(a.x, SLIDE_TOP + 0.005, a.z)
    ctx.engine.scene.add(group)
    this._patch = group
  },

  // ---- 薄血膜：推片倾斜跟随 + 条带生长 ----
  _pushThin(ctx, p) {
    const a = this._anchor
    // 只在玻片范围内采样（锚点向右最多 4.4cm）
    const sx = Math.max(0, Math.min(4.4, p.x - a.x))
    if (Math.abs(p.z - a.z) > 1.6) return
    if (this._pivot) this._pivot.position.set(a.x + sx, SLIDE_TOP, a.z)

    const now = performance.now()
    const prev = this._samples[this._samples.length - 1]
    if (prev) {
      const dt = now - prev.t
      if (dt < 12) return
      const v = Math.max(((sx - prev.sx) * 100) / dt, 0.01) // cm/s（向右为正）
      // 厚度模型（视觉）：tan(角度)/速度，系数按 cm 尺度调
      const th = Math.min((3 * Math.tan((this._angle * Math.PI) / 180)) / v, 3)
      const w = Math.min(0.35 + 0.35 * th, 1.1)
      this._samples.push({
        sx, t: now, v, th, w,
        streak: Math.abs(v - prev.v) / Math.max(prev.v, 0.05) > 2.5,
      })
    } else {
      this._samples.push({ sx, t: now, v: 3, th: 0.7, w: 0.6, streak: false })
    }
    this._rebuildRibbon(ctx)
  },

  _rebuildRibbon(ctx) {
    const s = this._samples
    if (this._ribbon) { ctx.engine.scene.remove(this._ribbon); this._ribbon.geometry.dispose() }
    if (s.length < 2) return
    const len = Math.abs(s[s.length - 1].sx) // 当前血膜长度（sx ≥ 0，从锚点向右延伸）

    // 把拖动采样按 0.12cm 均匀重采样并平滑 w/th——拖动事件间距不匀会让
    // 半宽逐点抖动，舌尖圆弧段只有几个采样点时会呈"阶梯/缺口"状
    const STEP = 0.12
    const n = Math.max(2, Math.floor(len / STEP) + 1)
    let j = 0
    const rs = [] // {x, w, th}
    for (let i = 0; i < n; i++) {
      const x = Math.min(i * STEP, len)
      while (j < s.length - 2 && s[j + 1].sx < x) j++
      const p0 = s[j], p1 = s[j + 1]
      const k = p1.sx === p0.sx ? 0 : Math.min(Math.max((x - p0.sx) / (p1.sx - p0.sx), 0), 1)
      rs.push({ x, w: p0.w + (p1.w - p0.w) * k, th: p0.th + (p1.th - p0.th) * k })
    }
    // 滑动平均（窗口 5）抚平半宽抖动，保持体部两侧平行
    for (let i = 0; i < rs.length; i++) {
      let sw = 0, st = 0, c = 0
      for (let d = -2; d <= 2; d++) {
        const q = rs[i + d]
        if (!q) continue
        sw += q.w; st += q.th; c++
      }
      rs[i].ws = sw / c; rs[i].ths = st / c
    }

    // 舌状半宽包络：起始端平直钝边（全宽）→ 体部两侧近乎平行（约 1.5cm 宽）
    // → 末端以超椭圆剖面（p=1.5，比半圆尖细）收口成舌尖，t=1 处导数为 0，
    //   与体部光滑连接
    const bodyOf = (ws) => 0.45 + 0.3 * Math.min(ws / 1.1, 1)
    const TAPER = Math.min(1.2, len * 0.55)
    const taperK = (x) => { // x: 局部坐标（≥0）；返回收口系数 1=不收
      const t = (len - Math.abs(x)) / TAPER
      return t >= 1 ? 1 : Math.pow(1 - Math.pow(1 - t, 1.5), 1 / 1.5)
    }
    const pts = rs.map((p) => {
      const k = taperK(p.x)
      const h = 0.015 + Math.min(p.ths * 0.045, 0.14)
      return { x: p.x, hw: bodyOf(p.ws) * k, y: h * (k >= 1 ? 1 : 0.45 + 0.55 * k) }
    })
    pts.push({ x: len + 0.1, hw: 0.015, y: 0.006 }) // 收尖
    // 顶点色：起始端深红 → 舌尖浅粉，模拟血膜头厚尾薄
    const cDark = new THREE.Color(0x651010)
    const cLight = new THREE.Color(0xd49284)
    const tmp = new THREE.Color()
    const pos = [], col = []
    for (const p of pts) {
      pos.push(p.x, p.y, -p.hw, p.x, p.y, p.hw)
      pos.push(p.x, 0.004, -p.hw, p.x, 0.004, p.hw)
      tmp.copy(cDark).lerp(cLight, Math.min((Math.abs(p.x) / 4.4) * 1.1, 1))
      for (let k = 0; k < 4; k++) col.push(tmp.r, tmp.g, tmp.b)
    }
    const idx = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 4, b = (i + 1) * 4
      idx.push(a, a + 1, b, a + 1, b + 1, b)
      idx.push(a + 2, a, b + 2, a, b, b + 2)
      idx.push(a + 1, a + 3, b + 1, a + 3, b + 3, b + 1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const ribbon = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      // 双面：条带顶点沿 -x 生长，顶面三角形绕序朝下，单面会被视锥剔除成"描边"
      vertexColors: true, roughness: 0.45, transparent: true, opacity: 0.94,
      side: THREE.DoubleSide,
    }))
    // 断带白条（速度突变标记）
    for (const p of s) {
      if (!p.streak) continue
      const k = taperK(p.sx)
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.01, bodyOf(p.w) * k * 2),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 })
      )
      const h = (0.015 + Math.min(p.th * 0.045, 0.14)) * (k >= 1 ? 1 : 0.45 + 0.55 * k)
      bar.position.set(p.sx, h + 0.006, 0)
      ribbon.add(bar)
    }
    ribbon.position.set(this._anchor.x, FILM_Y, this._anchor.z)
    ctx.engine.scene.add(ribbon)
    this._ribbon = ribbon
  },

  // ---------- 拖动结束：判定 ----------
  _dragEnd(ctx, which) {
    const { state, dialog, score } = ctx
    if (!this._pusherInHand || this._target !== which || this._dragPoints.length < 4) {
      this._dragPoints = []
      return
    }
    const pts = this._dragPoints
    this._dragPoints = []
    this._lastTheta = null

    // 轨迹分析（沿用原实现）
    let dist = 0
    const speeds = []
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dz = pts[i].z - pts[i - 1].z
      const dt = Math.max(pts[i].t - pts[i - 1].t, 1)
      const d = Math.hypot(dx, dz)
      dist += d
      speeds.push((d / dt) * 1000)
    }
    const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length
    const sd = Math.sqrt(speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length)
    const cv = mean > 0 ? sd / mean : 1
    const line = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z)
    const straightness = dist > 0 ? line / dist : 0

    if (which === 'A') {
      // 厚血膜：直径 + 搅拌均匀度（基于实时生长的圆斑）
      const dia = this._patchR * 2
      const even = this._sectorSweep.every((s) => s >= SECTOR_NEED)
      let quality, msg
      if (dia < 0.8) { quality = 'thick'; msg = `血斑直径仅 ${dia.toFixed(2)} cm：涂开不充分，太厚，染色时易龟裂脱片` }
      else if (dia > 1.2) { quality = 'broken'; msg = `血斑直径 ${dia.toFixed(2)} cm：涂得太大太薄，虫体密度低易漏检` }
      else if (!even) { quality = 'broken'; msg = '搅拌不充分：血斑厚薄不均，厚的区域虫体堆叠、薄的区域漏检' }
      else { quality = 'good'; msg = `厚血膜直径 ${dia.toFixed(2)} cm，圆整均匀` }
      state.thickFilmQuality = quality
      // 扇区组 → 单 mesh 成品（Step4/5 按名字+单一材质查找）
      this._finalizeThick(ctx, quality)
      if (quality === 'good') { score.correct(3, '厚血膜制作优良'); dialog.success(msg, '厚血膜完成') }
      else { score.error(3, '厚血膜质量不佳', msg, 4); dialog.error(msg, '厚血膜不合格') }
    } else {
      // 薄血膜：角度 + 直线性 + 速度均匀性（沿用原判定）
      const angleOk = this._angle >= 30 && this._angle <= 45
      let quality = 'good'
      const problems = []
      if (!angleOk) { quality = 'thick'; problems.push(`推片角度 ${this._angle}°（应为 30–45°）`) }
      if (straightness < 0.85) { quality = 'broken'; problems.push('拖动方向不直，血膜断裂') }
      if (cv > 0.75) { quality = 'broken'; problems.push('推片速度不匀，血膜出现波纹') }
      if (dist < 4) { quality = 'broken'; problems.push('推片距离太短，未形成薄层') }
      state.thinFilmQuality = quality
      if (this._ribbon) {
        this._ribbon.name = 'thinFilm' // 实时条带即成品
        // 顶点色与 material.color 相乘：合格保持自然血色，不合格做灰暗提示
        this._ribbon.material.color.setHex(quality === 'good' ? 0xffffff : 0xcf9a8d)
      }
      if (quality === 'good') {
        score.correct(3, `薄血膜制作优良（角度 ${this._angle}°）`)
        dialog.success('血膜呈均匀舌状，边缘整齐', '薄血膜完成')
      } else {
        score.error(3, '薄血膜质量不佳', problems.join('；'), 5)
        dialog.error(problems.join('<br>'), '薄血膜不合格')
      }
      this._hideAngleSlider()
    }

    // 推片归位
    this._unrigPusher(ctx)
    this._target = null

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

  /** 厚血膜成品：单个圆盘 mesh（兼容 Step4/5 的查找方式），半径=学生实际涂出的大小 */
  _finalizeThick(ctx, quality) {
    if (this._patch) { ctx.engine.scene.remove(this._patch); this._patch = null }
    if (this._drop) { ctx.engine.scene.remove(this._drop); this._drop = null }
    // 直径合格用真实半径；不合格也保留实际结果（教学反馈）
    const film = createThickFilm()
    const r = this._patchR
    film.geometry.dispose()
    film.geometry = new THREE.CylinderGeometry(r, r, 0.05, 32)
    film.material.color.setHex(quality === 'good' ? 0x8f1d1d : 0x9c4a3d)
    film.position.set(this._anchor.x, FILM_Y, this._anchor.z)
    ctx.engine.scene.add(film)
  },

  _findDrop(ctx) {
    const a = this._anchor
    let found = null
    ctx.engine.scene.traverse((o) => {
      if (o.name === 'bloodDrop' && o.visible && o.position.distanceTo(a) < 1.2) found = o
    })
    return found
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
      this._setPivotAngle() // 推片倾角实时联动
    })
    this._sliderEl = el
  },
  _hideAngleSlider() {
    if (this._sliderEl) { this._sliderEl.remove(); this._sliderEl = null }
  },

  exit(ctx) {
    this._hideAngleSlider()
    this._unrigPusher(ctx)
    if (this._patch) { ctx.engine.scene.remove(this._patch); this._patch = null }
    ctx.score.endStep(3)
    // 还原全景机位
    ctx.engine.moveCamera([0, 55, 85], [0, 0, -2], 1.2)
  },
}
