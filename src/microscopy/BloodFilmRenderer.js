import { drawInfectedCell } from './ParasiteShapes.js'
import { seededRandom, FILM_W, FILM_H } from './CaseGenerator.js'

const TILE = 260          // 背景红细胞按瓦片生成，保证跨视野位置一致
const RBC_R = 14          // 红细胞半径（血膜坐标单位）
const VIEW = 720          // 视野画布像素

/**
 * 血膜渲染器：把"虚拟血膜"的任意区域画到视野画布上。
 * - 背景红细胞按瓦片种子生成，移动视野时位置稳定
 * - 疟原虫叠加在病例给定的坐标上
 * - focus 偏离最佳焦距 → 高斯模糊
 */
export class BloodFilmRenderer {
  constructor(caseData) {
    this.caseData = caseData
    this.offscreen = document.createElement('canvas')
    this.offscreen.width = VIEW
    this.offscreen.height = VIEW
    this.offCtx = this.offscreen.getContext('2d')
  }

  /** 某物镜下视野直径（血膜坐标） */
  viewDiameter(objective) {
    // 10× 看大范围，100× 油镜看细节
    return { 10: 780, 40: 320, 100: 170 }[objective]
  }

  /**
   * 绘制一帧视野
   * @param {CanvasRenderingContext2D} ctx 目标画布
   * @param {number} cx 视野中心 x（血膜坐标）
   * @param {number} cy 视野中心 y
   * @param {number} objective 10/40/100
   * @param {number} focusError 焦距偏差 0~1（0 = 最清晰）
   */
  render(ctx, cx, cy, objective, focusError) {
    const off = this.offCtx
    const d = this.viewDiameter(objective)
    const scale = VIEW / d // 血膜坐标 -> 像素

    // 背景（血浆）
    off.fillStyle = '#f7ede4'
    off.fillRect(0, 0, VIEW, VIEW)

    const half = d / 2
    const toPx = (wx, wy) => [(wx - (cx - half)) * scale, (wy - (cy - half)) * scale]

    // ---- 背景红细胞（瓦片化） ----
    const pad = RBC_R * 1.6
    const t0x = Math.floor((cx - half - pad) / TILE)
    const t1x = Math.floor((cx + half + pad) / TILE)
    const t0y = Math.floor((cy - half - pad) / TILE)
    const t1y = Math.floor((cy + half + pad) / TILE)
    const rbcPx = RBC_R * scale
    const density = 48 // 每瓦片红细胞数：保证各倍数下血膜饱满

    for (let tx = t0x; tx <= t1x; tx++) {
      for (let ty = t0y; ty <= t1y; ty++) {
        const rand = seededRandom((tx * 73856093) ^ (ty * 19349663) ^ this.caseData.seed)
        for (let i = 0; i < density; i++) {
          const wx = tx * TILE + rand() * TILE
          const wy = ty * TILE + rand() * TILE
          if (wx < 0 || wx > FILM_W || wy < 0 || wy > FILM_H) continue
          const [px, py] = toPx(wx, wy)
          if (px < -rbcPx || px > VIEW + rbcPx || py < -rbcPx || py > VIEW + rbcPx) continue
          // 正常红细胞
          off.beginPath()
          off.arc(px, py, rbcPx, 0, Math.PI * 2)
          off.fillStyle = 'rgba(240, 199, 192, 0.92)'
          off.fill()
          off.beginPath()
          off.arc(px, py, rbcPx * 0.45, 0, Math.PI * 2)
          off.fillStyle = 'rgba(250, 231, 226, 0.8)'
          off.fill()
        }
        // 偶尔一个白细胞（紫核）
        if (rand() > 0.82) {
          const wx = tx * TILE + rand() * TILE
          const wy = ty * TILE + rand() * TILE
          const [px, py] = toPx(wx, wy)
          off.beginPath()
          off.arc(px, py, rbcPx * 1.5, 0, Math.PI * 2)
          off.fillStyle = 'rgba(228, 220, 245, 0.95)'
          off.fill()
          off.beginPath()
          off.arc(px, py, rbcPx * 0.85, 0, Math.PI * 2)
          off.fillStyle = 'rgba(109, 40, 217, 0.85)'
          off.fill()
        }
      }
    }

    // ---- 疟原虫 ----
    for (const p of this.caseData.parasites) {
      const [px, py] = toPx(p.x, p.y)
      if (px < -rbcPx * 2 || px > VIEW + rbcPx * 2 || py < -rbcPx * 2 || py > VIEW + rbcPx * 2) continue
      const rand = seededRandom(this.caseData.seed + p.id * 97)
      drawInfectedCell(off, px, py, rbcPx, this.caseData.species, p.stage, rand)
      // 已标记虫体画绿色圈
      if (p.found) {
        off.strokeStyle = 'rgba(34, 197, 94, 0.9)'
        off.lineWidth = Math.max(2, VIEW / 240)
        off.beginPath()
        off.arc(px, py, rbcPx * 1.8, 0, Math.PI * 2)
        off.stroke()
      }
    }

    // ---- 焦距模糊：先离屏清晰绘制，再带滤镜贴上 ----
    ctx.clearRect(0, 0, VIEW, VIEW)
    ctx.save()
    const blurPx = focusError * (VIEW / 60)
    ctx.filter = blurPx > 0.3 ? `blur(${blurPx.toFixed(1)}px)` : 'none'
    ctx.drawImage(this.offscreen, 0, 0)
    ctx.restore()
  }

  /**
   * 将视野像素坐标转换为血膜坐标（用于点击标记虫体）
   */
  pxToFilm(px, py, cx, cy, objective) {
    const d = this.viewDiameter(objective)
    const half = d / 2
    return [cx - half + (px / VIEW) * d, cy - half + (py / VIEW) * d]
  }

  /** 为鉴定题渲染某个虫体的高倍特写（返回 dataURL）；数码放大让形态细节更清晰 */
  snapshot(parasite, objective = 100) {
    const c = document.createElement('canvas')
    c.width = 360
    c.height = 360
    const ctx = c.getContext('2d')
    const zoom = 3 // 在油镜基础上再放大 3 倍，便于辨认形态
    const d = this.viewDiameter(objective) / zoom
    const scale = 360 / d
    const rbcPx = 14 * scale
    const rand0 = seededRandom(this.caseData.seed + 7)
    ctx.fillStyle = '#f7ede4'
    ctx.fillRect(0, 0, 360, 360)
    for (let i = 0; i < 12; i++) {
      const px = rand0() * 360
      const py = rand0() * 360
      ctx.beginPath(); ctx.arc(px, py, rbcPx, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(240, 199, 192, 0.92)'; ctx.fill()
      ctx.beginPath(); ctx.arc(px, py, rbcPx * 0.45, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(250, 231, 226, 0.8)'; ctx.fill()
    }
    const rand = seededRandom(this.caseData.seed + parasite.id * 97)
    drawInfectedCell(ctx, 180, 180, rbcPx, this.caseData.species, parasite.stage, rand)
    return c.toDataURL('image/png')
  }
}
