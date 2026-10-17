import { STEP_SCORES } from '../core/ScoreManager.js'

const STEP_NAMES = {
  1: '器材准备', 2: '末梢采血', 3: '血膜制作', 4: '血膜固定', 5: '吉姆萨染色', 6: '显微镜检查', 7: '虫种鉴定',
}

/** 成绩单页面 */
export function showReport(scoreManager) {
  const overlay = document.getElementById('report-overlay')
  overlay.classList.remove('hidden')
  scoreManager.finish()

  const total = scoreManager.totalScore()
  const grade = scoreManager.grade()
  const errors = scoreManager.errors()
  const gradeColor = total >= 90 ? '#16a34a' : total >= 80 ? '#0e7490' : total >= 60 ? '#d97706' : '#dc2626'

  const rows = Object.keys(STEP_SCORES).map((id) => {
    const s = scoreManager.stepScore(Number(id))
    const base = STEP_SCORES[id]
    const cls = s === base ? 'score-full' : s >= base * 0.6 ? 'score-mid' : 'score-low'
    const t = scoreManager.stepTimes[id] ? `${scoreManager.stepTimes[id].toFixed(0)}s` : '—'
    return `<tr><td>${STEP_NAMES[id]}</td><td class="score-cell ${cls}">${s} / ${base}</td><td>${t}</td></tr>`
  }).join('')

  const errorHtml = errors.length
    ? `<div class="error-list"><h4>错误操作记录（${errors.length} 项）</h4><ul>${
        errors.map((e) => `<li><b>[${STEP_NAMES[e.stepId]}]</b> ${e.action}${e.detail ? ' — ' + e.detail : ''}（扣 ${e.penalty} 分）</li>`).join('')
      }</ul></div>`
    : '<div class="error-list" style="background:#f0fdf4;border-color:#bbf7d0;"><h4 style="color:#16a34a;">全程零失误，操作规范！</h4></div>'

  overlay.innerHTML = `
    <div class="report-card">
      <h2>实验成绩单</h2>
      <div class="report-sub">疟原虫血涂片制作与筛查 · ${scoreManager.mode === 'exam' ? '考核模式' : '教学模式'} · ${new Date().toLocaleString('zh-CN')}</div>
      <div class="report-total">
        <span class="score-num" style="color:${gradeColor}">${total}</span>
        <span class="score-grade" style="color:${gradeColor}">${grade}</span>
      </div>
      <div style="text-align:center;color:#64748b;font-size:13px;">总用时 ${Math.round(scoreManager.totalTime)} 秒</div>
      <table>
        <thead><tr><th>步骤</th><th style="text-align:center">得分</th><th>用时</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${errorHtml}
      <div class="report-actions">
        <button id="btn-restart">重新开始</button>
        <button id="btn-print">打印成绩单</button>
      </div>
    </div>`

  document.getElementById('btn-restart').onclick = () => location.reload()
  document.getElementById('btn-print').onclick = () => window.print()
}
