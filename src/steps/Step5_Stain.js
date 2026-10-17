/**
 * 步骤 5：吉姆萨染色
 * 正确流程：滴加染液 → 计时染色（模拟 15 秒代表 20–30 分钟）→ 缓冲液/水洗
 * 错误：染色时间不足即冲洗、用错试剂（甲醇/香柏油）
 */
export default {
  id: 5,
  title: '吉姆萨染色',

  enter(ctx) {
    const { interaction, lab } = ctx
    this._selected = null     // 当前手持试剂
    this._staining = false
    this._stainStart = 0
    this._stainTimer = null

    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '染色流程：<b>①点击吉姆萨染液 → ②点击血膜 → ③等待染色完成（计时）→ ④用缓冲液冲洗</b>。'
      : null)

    for (const key of ['giemsa', 'buffer', 'water', 'methanol', 'cedarOil']) {
      interaction.register(lab[key], { click: () => this._select(ctx, key) })
    }
    interaction.register(lab.slideA, { click: () => this._applyTo(ctx, 'A') })
    interaction.register(lab.slideB, { click: () => this._applyTo(ctx, 'B') })
    this._stainedSlides = new Set()
  },

  _select(ctx, key) {
    const names = { giemsa: '吉姆萨染液', buffer: '缓冲液', water: '蒸馏水', methanol: '甲醇', cedarOil: '香柏油' }
    this._selected = key
    ctx.dialog.info(`已取：${names[key]}，请点击要作用的血膜`)
  },

  _applyTo(ctx, which) {
    const { state, dialog, score } = ctx
    const sel = this._selected
    if (this._completed) { dialog.info('本步骤已完成'); return }
    if (!sel) { dialog.info('请先选择试剂瓶'); return }

    // 染色阶段
    if (!this._staining) {
      if (sel === 'giemsa') {
        this._staining = true
        this._stainStart = performance.now()
        this._stainedSlides.add(which)
        score.correct(5, `载玻片${which} 滴加吉姆萨染液`)
        dialog.success('已滴加染液，染色中…请等待 15 秒（模拟 20–30 分钟）')
        ctx.hud.setHint('染色中：<b>请勿冲洗</b>，等待计时结束…')
        this._tintFilms(ctx, 0x6d28d9)
        this._stainTimer = setTimeout(() => {
          state.stained = true
          dialog.info('染色完成！现在用<b>缓冲液</b>（或蒸馏水）冲洗掉多余染液')
          ctx.hud.setHint(ctx.mode === 'teaching' ? '染色完成。请点击<b>缓冲液</b>或<b>蒸馏水</b>，再点击血膜进行冲洗。' : null)
        }, 15000)
        return
      }
      if (sel === 'buffer' || sel === 'water') {
        score.error(5, '未染色先冲洗', '血膜尚未染色，冲洗会冲掉血膜', 3)
        dialog.error('请先滴加吉姆萨染液染色，再冲洗', '顺序错误')
        return
      }
      score.error(5, '用错试剂', '甲醇是固定液（步骤4已用），香柏油是镜检介质，均非染液', 3)
      dialog.error('染色应使用吉姆萨染液', '试剂选择错误')
      return
    }

    // 染色中/染色后 → 冲洗阶段
    if (sel === 'buffer' || sel === 'water') {
      if (!state.stained) {
        const elapsed = (performance.now() - this._stainStart) / 1000
        score.error(5, '染色时间不足即冲洗', `仅染色 ${elapsed.toFixed(1)} 秒，虫体着色不良`, 5)
        dialog.error('染色时间不足！虫体会着色过浅，影响观察', '冲洗过早')
        clearTimeout(this._stainTimer)
        state.stained = true // 强制结束染色但已扣分
        state.weakStain = true
      } else {
        score.correct(5, '冲洗染液')
      }
      state.washed = true
      this._tintFilms(ctx, state.weakStain ? 0xb99ad9 : 0x7c3aed)
      dialog.success('冲洗完成，血膜呈淡紫红色，晾干后可镜检')
      this._completed = true // 防重复推进步骤
      ctx.hud.showBanner('步骤 5 完成')
      setTimeout(() => ctx.nextStep(), 1500)
      return
    }
    if (sel === 'giemsa') { dialog.info('染液已滴加，请等待染色计时结束'); return }
    score.error(5, '用错试剂', '此时应用缓冲液冲洗', 2)
    dialog.error('染色完成后应用缓冲液冲洗', '试剂选择错误')
  },

  _tintFilms(ctx, color) {
    ctx.engine.scene.traverse((o) => {
      if (o.name === 'thinFilm' || o.name === 'thickFilm') o.material.color.setHex(color)
    })
  },

  exit(ctx) {
    clearTimeout(this._stainTimer)
    ctx.score.endStep(5)
  },
}
