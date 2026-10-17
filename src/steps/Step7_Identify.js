import { SPECIES_NAMES, STAGE_NAMES } from '../microscopy/ParasiteShapes.js'
import { buildQuestionPool, imgUrl } from '../microscopy/imageLibrary.js'
import { ScopeView } from '../microscopy/ScopeView.js'

/**
 * 步骤 7：虫种鉴定问答（虚拟显微镜读片版）
 * 每道题提供一张真实血涂片照片，学生需操作虚拟显微镜
 * （切换物镜 10×/40×/100×、粗/细准焦调焦、拖拽移动视野）观察后作答。
 * 共 6 题：间日疟、恶性疟各随机 3 张不同图片。每题 2.5 分（虫种 1.5 分 + 发育期 1 分），共 15 分。
 */
const QUIZ_SPECIES = ['vivax', 'falciparum'] // 仅间日疟 / 恶性疟
const QUESTIONS_PER_SPECIES = 3
const SCORE_SPECIES = 1.5
const SCORE_STAGE = 1

export default {
  id: 7,
  title: '虫种鉴定',

  enter(ctx) {
    this.ctx = ctx
    this.scopes = []

    // 组题：每个虫种随机抽 3 张不同图片，合并后打乱顺序
    const pool = buildQuestionPool()
    const shuffled = (arr) => arr.slice().sort(() => Math.random() - 0.5)
    this.questions = QUIZ_SPECIES
      .flatMap((sp) => shuffled(pool.filter((q) => q.species === sp)).slice(0, QUESTIONS_PER_SPECIES))
      .sort(() => Math.random() - 0.5)

    const overlay = document.getElementById('quiz-overlay')
    const body = document.getElementById('quiz-body')
    overlay.classList.remove('hidden')
    ctx.hud.setHint(ctx.mode === 'teaching'
      ? '操作虚拟显微镜观察真实血涂片：<b>先 10× 调焦找到血膜，再换高倍/油镜细查，拖拽移动视野</b>。观察清楚后选择虫种与发育期。'
      : null)

    const speciesOpts = QUIZ_SPECIES.map((k) => `<option value="${k}">${SPECIES_NAMES[k]}</option>`).join('')
    const stageOpts = Object.entries(STAGE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')

    body.innerHTML = this.questions.map((q, i) => `
      <div class="quiz-question">
        <p><b>第 ${i + 1} 题</b>：调节显微镜观察这张真实血涂片（吉姆萨染色），判断虫种与发育期：</p>
        <div class="quiz-scope">
          <div class="quiz-viewport">
            <canvas id="qcv${i}" width="420" height="420"></canvas>
            <div class="quiz-obj-label" id="qobj${i}">10× 物镜</div>
          </div>
          <div class="quiz-controls">
            <label>物镜转换</label>
            <div class="qc-obj-row">
              <button data-obj="10" class="active">10×</button>
              <button data-obj="40">40×</button>
              <button data-obj="100">100×</button>
            </div>
            <label>粗准焦螺旋</label>
            <input type="range" class="qc-coarse" min="0" max="100" value="12" />
            <label>细准焦螺旋</label>
            <input type="range" class="qc-fine" min="0" max="100" value="50" />
            <div class="qc-focus-state" id="qfs${i}">图像模糊，请调焦</div>
            <div class="qc-tip">拖拽视野移动观察位置</div>
          </div>
        </div>
        <div class="quiz-credit">图片来源：${q.credit}（经 Wikimedia Commons）</div>
        <div class="quiz-selects">
          <select id="q${i}-species">
            <option value="">— 选择虫种 —</option>${speciesOpts}
          </select>
          <select id="q${i}-stage">
            <option value="">— 选择发育期 —</option>${stageOpts}
          </select>
        </div>
      </div>
    `).join('') + `<button id="btn-submit-quiz">提交鉴定结果</button>`

    // 为每题创建虚拟镜检视窗并接线控件
    this.questions.forEach((q, i) => {
      const canvas = document.getElementById(`qcv${i}`)
      const scope = new ScopeView(canvas, imgUrl(q))
      this.scopes.push(scope)

      const qEl = canvas.closest('.quiz-question')
      const label = document.getElementById(`qobj${i}`)
      const fsState = document.getElementById(`qfs${i}`)

      qEl.querySelectorAll('.qc-obj-row button').forEach((btn) => {
        btn.addEventListener('click', () => {
          qEl.querySelectorAll('.qc-obj-row button').forEach((b) => b.classList.remove('active'))
          btn.classList.add('active')
          scope.setObjective(Number(btn.dataset.obj))
          label.textContent = `${btn.dataset.obj}× ${btn.dataset.obj === '100' ? '油镜' : '物镜'}`
        })
      })
      qEl.querySelector('.qc-coarse').addEventListener('input', (e) => scope.setCoarse(e.target.value))
      qEl.querySelector('.qc-fine').addEventListener('input', (e) => scope.setFine(e.target.value))

      scope.onStateChange = () => {
        const err = scope.focusError
        fsState.textContent = err < 0.12 ? '✓ 图像清晰' : err < 0.35 ? '接近清晰，用细准焦微调' : '图像模糊，请调焦'
        fsState.style.color = err < 0.12 ? '#86efac' : '#fbbf24'
      }
      scope.onStateChange()
    })

    document.getElementById('btn-submit-quiz').onclick = () => this._submit(ctx, overlay)
  },

  _submit(ctx, overlay) {
    if (this._submitted) return
    const { score, dialog } = ctx
    const results = []
    this.questions.forEach((q, i) => {
      const sp = document.getElementById(`q${i}-species`).value
      const st = document.getElementById(`q${i}-stage`).value
      if (sp && st) results.push({ q, sp, st, idx: i })
    })
    if (results.length < this.questions.length) {
      dialog.error('请完成所有题目的选择后再提交', '答案不完整')
      return
    }
    // 全部答完才计分，避免中途改答案重复计分；记录标注题号，便于成绩单定位错题
    for (const { q, sp, st, idx } of results) {
      const tag = `第${idx + 1}题 `
      if (sp === q.species) score.correct(7, `${tag}虫种正确：${SPECIES_NAMES[sp]}`)
      else score.error(7, `${tag}虫种错误`, `应为 ${SPECIES_NAMES[q.species]}，误选 ${SPECIES_NAMES[sp]}`, SCORE_SPECIES)
      if (st === q.stage) score.correct(7, `${tag}发育期正确：${STAGE_NAMES[st]}`)
      else score.error(7, `${tag}发育期错误`, `应为 ${STAGE_NAMES[q.stage]}，误选 ${STAGE_NAMES[st]}`, SCORE_STAGE)
    }
    this._submitted = true
    overlay.classList.add('hidden')
    ctx.hud.showBanner('步骤 7 完成')
    setTimeout(() => ctx.nextStep(), 1200)
  },

  exit(ctx) { ctx.score.endStep(7) },
}
