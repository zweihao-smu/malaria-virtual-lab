/**
 * 消息提示（toast）：操作反馈。
 * success/error/info 三种类型，自动消失。
 */
export class Dialog {
  constructor() {
    this.container = document.getElementById('toast-container')
  }

  _show(type, title, text, duration = 3000) {
    const el = document.createElement('div')
    el.className = `toast ${type}`
    el.innerHTML = `<div class="toast-title">${title}</div>${text ? `<div>${text}</div>` : ''}`
    this.container.appendChild(el)
    setTimeout(() => {
      el.classList.add('fade-out')
      setTimeout(() => el.remove(), 450)
    }, duration)
  }

  success(text, title = '操作正确') { this._show('success', `✓ ${title}`, text, 2200) }
  error(text, title = '操作错误') { this._show('error', `✗ ${title}`, text, 3800) }
  info(text, title = '提示') { this._show('info', title, text, 3000) }
}
