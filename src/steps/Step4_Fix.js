/**
 * 步骤 4：血膜固定
 * 规则：薄血膜（B）用甲醇固定；厚血膜（A）禁止固定（需溶血脱血红蛋白）
 */
export default {
  id: 4,
  title: '血膜固定',

  enter(ctx) {
    const { interaction, lab } = ctx
    this._methanolInHand = false

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '固定规则：<b>薄血膜（B）用甲醇固定</b>以保存形态；<b>厚血膜（A）不能固定</b>，需保留血红蛋白以便溶血后查虫。<br>请点击甲醇瓶，再点击薄血膜（载玻片B）。'
      : null)

    interaction.register(lab.methanol, { click: () => this._takeMethanol(ctx) })
    interaction.register(lab.slideA, { click: () => this._apply(ctx, 'A') })
    interaction.register(lab.slideB, { click: () => this._apply(ctx, 'B') })
  },

  _takeMethanol(ctx) {
    if (this._methanolInHand) { ctx.dialog.info('已拿起甲醇'); return }
    this._methanolInHand = true
    ctx.score.correct(4, '取甲醇固定液')
    ctx.dialog.success('已取甲醇，请点击要固定的血膜')
  },

  _apply(ctx, which) {
    const { state, dialog, score, lab } = ctx
    if (!this._methanolInHand) { dialog.info('请先点击甲醇瓶'); return }
    if (which === 'A') {
      score.error(4, '厚血膜误用甲醇固定', '厚血膜固定后血红蛋白保留，虫体被遮盖，无法镜检', 6)
      dialog.error('厚血膜（A）不能固定！厚血膜需要先溶血脱掉血红蛋白。', '固定对象错误')
      return
    }
    if (state.thinFixed) { dialog.info('薄血膜已固定'); return }
    state.thinFixed = true
    score.correct(4, '薄血膜甲醇固定')
    dialog.success('薄血膜固定完成（甲醇作用 1–2 分钟）')
    // 视觉：薄血膜颜色略变浅表示已固定
    const film = this._findFilm(ctx, lab.slideB)
    if (film) film.material.color.setHex(0xc05a45)
    ctx.hud.showBanner('步骤 4 完成')
    setTimeout(() => ctx.nextStep(), 1500)
  },

  _findFilm(ctx, slide) {
    const anchor = slide.userData.bloodAnchor.clone()
    slide.localToWorld(anchor)
    let found = null
    ctx.engine.scene.traverse((o) => {
      if ((o.name === 'thinFilm' || o.name === 'thickFilm') && o.position.distanceTo(anchor) < 1.5) found = o
    })
    return found
  },

  exit(ctx) { ctx.score.endStep(4) },
}
