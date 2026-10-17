/**
 * HUD：顶部步骤栏、底部提示栏、计时器、步骤完成横幅。
 * 教学/考核模式差异在此体现：考核模式不显示实时得分与引导提示。
 */
export class Hud {
  constructor() {
    this.elTop = document.getElementById('hud-top')
    this.elBottom = document.getElementById('hud-bottom')
    this.elIndex = document.getElementById('step-index')
    this.elTitle = document.getElementById('step-title')
    this.elHint = document.getElementById('hint-text')
    this.elTimer = document.getElementById('timer')
    this.elScore = document.getElementById('score-display')
    this.elMode = document.getElementById('mode-badge')
    this.elBanner = document.getElementById('step-banner')
    this._timerId = null
    this._seconds = 0
  }

  show(mode) {
    this.elTop.classList.remove('hidden')
    this.elBottom.classList.remove('hidden')
    this.elMode.textContent = mode === 'exam' ? '考核模式' : '教学模式'
    this.elMode.classList.toggle('exam', mode === 'exam')
    this.mode = mode
    this.startTimer()
  }

  setStep(index, total, title) {
    this.elIndex.textContent = `第 ${index}/${total} 步`
    this.elTitle.textContent = title
  }

  /** 设置底部操作提示；考核模式下传入 null 则显示固定模糊提示 */
  setHint(html) {
    if (this.mode === 'exam' && html === null) {
      this.elHint.innerHTML = '考核模式：请根据所学知识自主完成当前步骤'
      return
    }
    this.elHint.innerHTML = html ?? ''
  }

  updateScore(score) {
    this.elScore.textContent = `得分 ${score}`
  }

  startTimer() {
    this.elTimer.classList.remove('hidden')
    this._timerId = setInterval(() => {
      this._seconds++
      const m = String(Math.floor(this._seconds / 60)).padStart(2, '0')
      const s = String(this._seconds % 60).padStart(2, '0')
      this.elTimer.textContent = `${m}:${s}`
    }, 1000)
  }

  get elapsedSeconds() { return this._seconds }

  /** 步骤完成横幅，1.6s 后自动消失 */
  showBanner(text) {
    this.elBanner.textContent = text
    this.elBanner.classList.remove('hidden')
    clearTimeout(this._bannerTimer)
    this._bannerTimer = setTimeout(() => this.elBanner.classList.add('hidden'), 1600)
  }
}
