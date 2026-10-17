import { Engine } from './core/Engine.js'
import { Interaction } from './core/Interaction.js'
import { StepManager } from './core/StepManager.js'
import { ScoreManager } from './core/ScoreManager.js'
import { buildLabScene } from './scenes/LabScene.js'
import { createExperimentState } from './steps/experimentState.js'
import { generateCase } from './microscopy/CaseGenerator.js'
import { Hud } from './ui/Hud.js'
import { Dialog } from './ui/Dialog.js'
import { showReport } from './ui/Report.js'

import Step1 from './steps/Step1_Prepare.js'
import Step2 from './steps/Step2_Collect.js'
import Step3 from './steps/Step3_Smear.js'
import Step4 from './steps/Step4_Fix.js'
import Step5 from './steps/Step5_Stain.js'
import Step6 from './steps/Step6_Microscopy.js'
import Step7 from './steps/Step7_Identify.js'

function startExperiment(mode) {
  document.getElementById('start-screen').classList.add('hidden')

  const engine = new Engine(document.getElementById('scene-container'))
  const interaction = new Interaction(engine)
  const lab = buildLabScene(engine.scene)
  const hud = new Hud()
  const dialog = new Dialog()
  const score = new ScoreManager(mode)
  const state = createExperimentState()
  const caseData = generateCase() // 随机疟疾病例（虫种/虫期/密度）

  const ctx = {
    engine, interaction, lab, hud, dialog, score, state, caseData, mode,
    nextStep: null, // 下方赋值
    onExperimentFinished() {
      hud.setHint('实验结束，正在生成成绩单…')
      showReport(score)
    },
  }

  const steps = [Step1, Step2, Step3, Step4, Step5, Step6, Step7]
  const manager = new StepManager(ctx, steps)
  ctx.manager = manager
  ctx.nextStep = () => {
    hud.updateScore(score.totalScore())
    manager.next()
  }

  hud.show(mode)
  hud.updateScore(score.totalScore())
  manager.start()

  // 开场视角动画
  engine.moveCamera([0, 55, 85], [0, 0, -2], 1.6)

  // 暴露调试句柄（便于自动化测试与排障）
  window.__lab = ctx
}

document.getElementById('btn-teaching').addEventListener('click', () => startExperiment('teaching'))
document.getElementById('btn-exam').addEventListener('click', () => startExperiment('exam'))
