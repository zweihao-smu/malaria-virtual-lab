/**
 * 步骤 1：器材准备与认知
 * 教学模式：点击每件器材查看名称与用途（全部看完后完成）
 * 考核模式：从台面所有物品中选出本实验所需器材（含 2 个干扰项）
 */
const REQUIRED = ['slideA', 'slideB', 'pusher', 'lancet', 'cottonJar', 'pipette', 'methanol', 'giemsa', 'buffer', 'water', 'cedarOil', 'microscope']
const DISTRACTORS = ['alcoholLamp', 'petriDish']
const ITEM_NAMES = {
  slideA: '载玻片A（厚血膜用）', slideB: '载玻片B（薄血膜用）', pusher: '推片',
  lancet: '一次性采血针', cottonJar: '75%酒精棉球', pipette: '胶头滴管',
  methanol: '甲醇（固定液）', giemsa: '吉姆萨染液', buffer: '缓冲液', water: '蒸馏水',
  cedarOil: '香柏油（油镜用）', microscope: '光学显微镜',
  alcoholLamp: '酒精灯', petriDish: '培养皿',
}
const ITEM_DESC = {
  slideA: '厚血膜载玻片：血膜厚、虫体集中，用于筛查。',
  slideB: '薄血膜载玻片：单层细胞，用于虫种鉴定。',
  pusher: '边缘光滑的玻片，用于推制血膜。',
  lancet: '无菌一次性使用，刺破指尖取末梢血。',
  cottonJar: '75% 酒精用于皮肤消毒。',
  pipette: '滴加染液、缓冲液等。',
  methanol: '固定薄血膜，保持细胞形态。',
  giemsa: '疟原虫经典染色液：核红、质蓝。',
  buffer: 'pH 7.2，保证染色效果。',
  water: '冲洗染液。',
  cedarOil: '油镜（100×）成像介质。',
  microscope: '疟原虫检查的金标准工具。',
}

export default {
  id: 1,
  title: '器材准备与认知',

  enter(ctx) {
    const { interaction, lab, state, mode } = ctx
    const all = [...REQUIRED, ...DISTRACTORS]

    if (mode === 'teaching') {
      ctx.hud.setHint('依次<b>点击台面器材</b>，认识本实验所需物品。右上角可旋转视角观察。')
    } else {
      ctx.hud.setHint('考核：请<b>选出本实验所需的全部器材</b>（多选、选错扣分），完成后点击"确认选择"。')
    }

    for (const key of all) {
      const obj = lab[key]
      if (!obj) continue
      interaction.register(obj, {
        click: () => this._onPick(ctx, key),
      })
    }
    this._done = false
    this._updateProgress(ctx)
  },

  _onPick(ctx, key) {
    const { state, dialog, score, hud, mode } = ctx
    if (state.identified.has(key)) return

    if (mode === 'teaching') {
      state.identified.add(key)
      score.correct(1, `认知器材：${ITEM_NAMES[key]}`)
      dialog.info(ITEM_DESC[key] ?? '', ITEM_NAMES[key])
    } else {
      // 考核模式：判断是否必选
      if (DISTRACTORS.includes(key)) {
        score.error(1, `误选：${ITEM_NAMES[key]}`, '本实验为血涂片镜检，不需要该器材', 3)
        dialog.error(`${ITEM_NAMES[key]} 不是本实验所需器材`, '选错器材')
      } else {
        state.identified.add(key)
        score.correct(1, `选中器材：${ITEM_NAMES[key]}`)
        dialog.success(ITEM_NAMES[key], '选择正确')
      }
    }
    this._updateProgress(ctx)
  },

  _updateProgress(ctx) {
    const { state, hud, mode } = ctx
    if (this._done) return
    const need = mode === 'teaching' ? [...REQUIRED, ...DISTRACTORS] : REQUIRED
    const got = [...need].filter((k) => state.identified.has(k)).length
    const target = mode === 'teaching' ? need.length : REQUIRED.length

    if (mode === 'teaching') {
      ctx.hud.setHint(`依次<b>点击台面器材</b>认识用途。进度：<b>${got}/${target}</b>${got >= target ? '，即将进入下一步…' : ''}`)
    } else {
      ctx.hud.setHint(`考核：选出全部所需器材。已选对 <b>${got}/${target}</b>${got >= target ? '，即将进入下一步…' : ''}`)
    }

    if (got >= target) {
      this._done = true
      hud.showBanner('步骤 1 完成')
      setTimeout(() => ctx.nextStep(), 1500)
    }
  },

  exit(ctx) {
    ctx.score.endStep(1)
  },
}
