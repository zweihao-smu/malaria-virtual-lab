import * as THREE from 'three'
import { createBloodDrop } from '../models/Slide.js'

/**
 * 步骤 2：末梢采血
 * 正确流程：酒精棉球消毒 → 待干 → 采血针穿刺 → 擦去第一滴血 → 取第二滴血
 */
export default {
  id: 2,
  title: '末梢采血',

  enter(ctx) {
    const { interaction, lab } = ctx
    this._cotton = null // 当前"取出"的棉球
    this._phase = 'disinfect' // disinfect -> dry -> puncture -> wipe -> collect

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '采血流程：<b>①酒精消毒 → ②待酒精挥发 → ③采血针穿刺 → ④擦去第一滴血 → ⑤取血</b>。请点击酒精棉球罐。'
      : null)

    interaction.register(lab.cottonJar, { click: () => this._takeCotton(ctx) })
    interaction.register(lab.lancet, { click: () => this._useLancet(ctx) })
    interaction.register(lab.finger, { click: () => this._touchFinger(ctx) })
    interaction.register(lab.slideA, { click: () => this._collect(ctx, 'A') })
    interaction.register(lab.slideB, { click: () => this._collect(ctx, 'B') })
  },

  _takeCotton(ctx) {
    const { state, dialog, score, lab } = ctx
    if (this._cotton) { dialog.info('已取出一枚棉球'); return }
    this._cotton = true
    this._phase = 'disinfecting'
    score.correct(2, '取出酒精棉球')
    dialog.success('取出一枚 75% 酒精棉球，请点击手指进行消毒')
    // 在手指上显示"拿着棉球"的视觉反馈：一个小白球跟随到手指旁
    const cottonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
    )
    cottonMesh.name = 'cottonInHand'
    cottonMesh.position.set(-48, 5, 4)
    ctx.engine.scene.add(cottonMesh)
    this._cottonMesh = cottonMesh
    void lab
  },

  _useLancet(ctx) {
    const { state, dialog, score } = ctx
    if (this._phase === 'disinfect' || this._phase === 'disinfecting') {
      score.error(2, '未消毒即采血', '采血前必须用 75% 酒精消毒指腹，否则易引起感染、污染血样', 4)
      dialog.error('采血前必须先用酒精消毒手指！', '违反无菌操作')
      return
    }
    if (this._phase === 'drying') {
      score.error(2, '酒精未干即穿刺', '酒精未挥发干时穿刺，酒精随血液进入血膜会引起溶血，影响镜检', 3)
      dialog.error('酒精尚未挥发，请稍等片刻再穿刺', '引起溶血')
      return
    }
    if (this._phase === 'ready') {
      this._phase = 'punctured'
      state.punctured = true
      score.correct(2, '采血针穿刺')
      dialog.success('穿刺成功，指腹出现血滴。请先擦去第一滴血。')
      this._showFingerDrop(ctx, 0.5)
      ctx.hud.setHint(ctx.mode === 'teaching' ? '第一滴血含组织液，<b>必须用棉球擦去</b>，再取第二滴血制片。<b>再次点击手指</b>完成擦拭。' : null)
      return
    }
    if (this._phase === 'punctured' || this._phase === 'wiped') {
      dialog.info('已完成穿刺，无需重复')
    }
  },

  _touchFinger(ctx) {
    const { state, dialog, score } = ctx
    if (!this._cotton && this._phase === 'disinfect') {
      dialog.info('请先从棉球罐取酒精棉球')
      return
    }
    if (this._phase === 'disinfecting') {
      // 消毒完成，进入"待干"阶段（2 秒后酒精挥发）
      this._phase = 'drying'
      state.disinfected = true
      score.correct(2, '酒精消毒指腹')
      dialog.success('已消毒。等待酒精自然挥发（约 2 秒）…')
      this._removeCotton(ctx)
      setTimeout(() => {
        if (this._phase === 'drying') {
          this._phase = 'ready'
          state.alcoholDry = true
          dialog.info('酒精已挥发，请点击采血针进行穿刺')
          ctx.hud.setHint(ctx.mode === 'teaching' ? '酒精已干。请点击<b>采血针</b>穿刺指腹。' : null)
        }
      }, 2000)
      return
    }
    if (this._phase === 'punctured') {
      // 用棉球擦第一滴血（前提是手里还有棉球——简化：消毒后棉球仍在手边）
      this._phase = 'wiped'
      state.firstDropWiped = true
      score.correct(2, '擦去第一滴血')
      dialog.success('已擦去第一滴血。现在取第二滴血：点击载玻片，再点手指取血。')
      this._clearFingerDrop(ctx)
      ctx.hud.setHint(ctx.mode === 'teaching'
        ? '轻压指腹使血液自然流出。<b>先点载玻片A（厚血膜），再点手指</b>；同样为载玻片B取血。'
        : null)
      return
    }
    if (this._phase === 'wiped') {
      dialog.info('请先点击要取血的载玻片，再点击手指')
    }
  },

  _collect(ctx, which) {
    const { state, dialog, score, lab } = ctx
    if (this._phase === 'punctured') {
      score.error(2, '未擦去第一滴血即取血', '第一滴血混有组织液和消毒液残留，会降低血膜质量', 3)
      dialog.error('应先用棉球擦去第一滴血，再取第二滴血制片', '血样不合格')
      return
    }
    if (this._phase !== 'wiped') {
      dialog.info('请先完成消毒、穿刺与擦去第一滴血')
      return
    }
    // 该玻片是否已取血
    if (state[which === 'A' ? 'thickOnA' : 'thinOnB']) {
      dialog.info('该玻片已取血')
      return
    }
    const slide = which === 'A' ? lab.slideA : lab.slideB
    const drop = createBloodDrop(which === 'A' ? 0.5 : 0.32)
    const anchor = slide.userData.bloodAnchor.clone()
    slide.localToWorld(anchor)
    drop.position.copy(anchor)
    ctx.engine.scene.add(drop)
    if (which === 'A') { state.thickOnA = true; state.dropsTaken++ } else { state.thinOnB = true; state.dropsTaken++ }
    score.correct(2, `载玻片${which} 取血`)
    dialog.success(`载玻片 ${which} 已取到血滴`)

    if (state.dropsTaken >= 2) {
      ctx.hud.showBanner('步骤 2 完成')
      setTimeout(() => ctx.nextStep(), 1500)
    }
  },

  _showFingerDrop(ctx, r) {
    const anchor = ctx.lab.finger.userData.punctureAnchor.clone()
    ctx.lab.finger.localToWorld(anchor)
    const drop = createBloodDrop(r)
    drop.name = 'fingerDrop'
    drop.position.copy(anchor)
    ctx.engine.scene.add(drop)
  },
  _clearFingerDrop(ctx) {
    const d = ctx.engine.scene.getObjectByName('fingerDrop')
    if (d) ctx.engine.scene.remove(d)
  },
  _removeCotton(ctx) {
    if (this._cottonMesh) { ctx.engine.scene.remove(this._cottonMesh); this._cottonMesh = null }
  },

  exit(ctx) {
    ctx.score.endStep(2)
    this._removeCotton(ctx)
    this._clearFingerDrop(ctx)
  },
}
