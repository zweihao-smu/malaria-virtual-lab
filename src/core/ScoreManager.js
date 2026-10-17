/** 各步骤满分（合计 100） */
export const STEP_SCORES = {
  1: 10, // 器材准备
  2: 15, // 采血
  3: 20, // 推片
  4: 10, // 固定
  5: 15, // 染色
  6: 15, // 镜检
  7: 15, // 虫种鉴定
}

/**
 * 评分管理：记录每次操作的正误与扣分，按步骤汇总成绩。
 * 扣分在步骤分值范围内扣到 0 为止，不倒扣。
 */
export class ScoreManager {
  constructor(mode) {
    this.mode = mode // 'teaching' | 'exam'
    this.records = [] // { stepId, correct, action, detail, penalty }
    this.stepTimes = {} // stepId -> 秒
    this._stepStart = 0
    this.totalTime = 0
    this._experimentStart = Date.now()
  }

  startStep(stepId) { this._stepStart = Date.now() }

  endStep(stepId) {
    this.stepTimes[stepId] = ((this.stepTimes[stepId] ?? 0)) + (Date.now() - this._stepStart) / 1000
  }

  /** 记录一次正确操作 */
  correct(stepId, action, detail = '') {
    this.records.push({ stepId, correct: true, action, detail, penalty: 0 })
  }

  /** 记录一次错误操作并扣分 */
  error(stepId, action, detail, penalty) {
    this.records.push({ stepId, correct: false, action, detail, penalty })
  }

  /** 某步骤剩余得分 */
  stepScore(stepId) {
    const base = STEP_SCORES[stepId] ?? 0
    const lost = this.records
      .filter((r) => r.stepId === stepId && !r.correct)
      .reduce((s, r) => s + r.penalty, 0)
    return Math.max(0, base - lost)
  }

  totalScore() {
    return Object.keys(STEP_SCORES).reduce((s, id) => s + this.stepScore(Number(id)), 0)
  }

  errors() { return this.records.filter((r) => !r.correct) }

  grade() {
    const s = this.totalScore()
    if (s >= 90) return '优秀'
    if (s >= 80) return '良好'
    if (s >= 60) return '及格'
    return '不及格'
  }

  finish() {
    this.totalTime = (Date.now() - this._experimentStart) / 1000
    // 成绩历史存 localStorage，供教学管理查看
    const history = JSON.parse(localStorage.getItem('malaria_lab_history') ?? '[]')
    const record = {
      date: new Date().toLocaleString('zh-CN'),
      mode: this.mode,
      score: this.totalScore(),
      grade: this.grade(),
      timeSec: Math.round(this.totalTime),
      errorCount: this.errors().length,
    }
    history.push(record)
    localStorage.setItem('malaria_lab_history', JSON.stringify(history))
    return record
  }
}
