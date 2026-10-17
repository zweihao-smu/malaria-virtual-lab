/**
 * 步骤状态机：管理 7 个实验步骤的进入、退出与推进。
 * 每个步骤模块实现接口：
 *   { id, title, enter(ctx), exit(ctx) }
 * 步骤完成后调用 ctx.nextStep() 推进。
 */
export class StepManager {
  /**
   * @param {object} ctx 共享上下文（engine/interaction/score/hud/state 等）
   * @param {Array} steps 步骤模块数组
   */
  constructor(ctx, steps) {
    this.ctx = ctx
    this.steps = steps
    this.currentIndex = -1
  }

  get current() { return this.steps[this.currentIndex] }

  start() {
    this.currentIndex = 0
    this._enter()
  }

  next() {
    this.current?.exit?.(this.ctx)
    this.currentIndex++
    if (this.currentIndex >= this.steps.length) {
      this.ctx.onExperimentFinished?.()
      return
    }
    this._enter()
  }

  _enter() {
    const step = this.current
    this.ctx.interaction.clear() // 每步重建可交互物体，防止误操作上一步物品
    this.ctx.score.startStep(step.id)
    this.ctx.hud.setStep(this.currentIndex + 1, this.steps.length, step.title)
    step.enter(this.ctx)
  }
}
