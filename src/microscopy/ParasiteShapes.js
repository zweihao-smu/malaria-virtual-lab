/**
 * 疟原虫形态绘制（Canvas 2D，吉姆萨染色风格）：
 * 细胞质蓝紫色、染色质红点、疟色素棕黄颗粒。
 * 覆盖 4 种人体疟原虫的典型发育期形态。
 *
 * 所有绘制函数签名：fn(ctx, x, y, r, rand)
 *   r = 宿主红细胞半径；rand = 确定性伪随机函数（同一虫体形态稳定）
 */

// ---- 基础画笔 ----
function drawRBC(ctx, x, y, r, { enlarged = false, oval = false } = {}) {
  const rr = enlarged ? r * 1.3 : r
  ctx.save()
  ctx.translate(x, y)
  if (oval) ctx.scale(1.25, 0.9)
  // 红细胞：淡粉圆盘，中央略浅
  ctx.beginPath()
  ctx.arc(0, 0, rr, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(242, 205, 200, 0.9)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, 0, rr * 0.45, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(250, 232, 228, 0.75)'
  ctx.fill()
  if (oval) { // 卵形疟红细胞边缘锯齿感
    ctx.strokeStyle = 'rgba(200, 140, 130, 0.8)'
    ctx.setLineDash([2, 3])
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
}

function drawSchuffnerDots(ctx, x, y, r, rand, count = 14) {
  ctx.fillStyle = 'rgba(214, 69, 65, 0.55)'
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * r * 0.9
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.035, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPigment(ctx, x, y, rand, spread, count, size = 1.6) {
  ctx.fillStyle = 'rgba(94, 64, 28, 0.85)'
  for (let i = 0; i < count; i++) {
    ctx.beginPath()
    ctx.arc(x + (rand() - 0.5) * spread, y + (rand() - 0.5) * spread, size * (0.6 + rand() * 0.7), 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 环状体：蓝色细环 + 红色染色质点 */
function drawRing(ctx, x, y, r, rand, { double = false, small = false } = {}) {
  const rr = small ? r * 0.32 : r * 0.45
  ctx.strokeStyle = 'rgba(59, 89, 199, 0.95)'
  ctx.lineWidth = Math.max(1.2, r * 0.09)
  ctx.beginPath()
  ctx.arc(x, y, rr, 0, Math.PI * 2)
  ctx.stroke()
  // 染色质点（恶性疟常见双核）
  ctx.fillStyle = '#c0392b'
  ctx.beginPath()
  ctx.arc(x + rr, y, r * 0.09, 0, Math.PI * 2)
  ctx.fill()
  if (double) {
    ctx.beginPath()
    ctx.arc(x + rr * 0.7, y + rr * 0.7, r * 0.08, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** 阿米巴样大滋养体（间日疟） */
function drawAmoeboid(ctx, x, y, r, rand) {
  ctx.beginPath()
  const n = 9
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const d = r * (0.45 + rand() * 0.4)
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    if (i === 0) ctx.moveTo(px, py)
    else ctx.quadraticCurveTo(x + Math.cos(a - 0.3) * d * 1.3, y + Math.sin(a - 0.3) * d * 1.3, px, py)
  }
  ctx.closePath()
  ctx.fillStyle = 'rgba(86, 116, 214, 0.75)'
  ctx.fill()
  ctx.fillStyle = '#c0392b'
  ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.1, r * 0.13, 0, Math.PI * 2); ctx.fill()
  drawPigment(ctx, x, y, rand, r * 0.8, 6)
}

/** 裂殖体：裂殖子成团 + 疟色素聚集 */
function drawSchizont(ctx, x, y, r, rand, merozoites = 14) {
  for (let i = 0; i < merozoites; i++) {
    const a = (i / merozoites) * Math.PI * 2 + rand() * 0.5
    const d = r * 0.42 * (0.5 + rand() * 0.5)
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    ctx.beginPath()
    ctx.arc(px, py, r * 0.15, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(86, 116, 214, 0.9)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px, py, r * 0.06, 0, Math.PI * 2)
    ctx.fillStyle = '#c0392b'
    ctx.fill()
  }
  drawPigment(ctx, x, y, rand, r * 0.3, 8, 2)
}

/** 配子体 */
function drawGametocyte(ctx, x, y, r, rand, { crescent = false } = {}) {
  if (crescent) {
    // 恶性疟：新月/香蕉形
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rand() * Math.PI)
    ctx.beginPath()
    ctx.ellipse(0, 0, r * 1.05, r * 0.38, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(86, 116, 214, 0.85)'
    ctx.fill()
    ctx.fillStyle = '#c0392b'
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill()
    drawPigment(ctx, 0, 0, rand, r * 0.5, 10, 1.8)
    ctx.restore()
  } else {
    // 间日疟等：圆形，几乎充满红细胞
    ctx.beginPath()
    ctx.arc(x, y, r * 0.85, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(86, 116, 214, 0.7)'
    ctx.fill()
    ctx.fillStyle = '#c0392b'
    ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill()
    drawPigment(ctx, x, y, rand, r * 1.1, 9)
  }
}

// ---- 虫种 × 虫期 组合出口 ----
export const SPECIES_NAMES = {
  vivax: '间日疟原虫',
  falciparum: '恶性疟原虫',
  malariae: '三日疟原虫',
  ovale: '卵形疟原虫',
}
export const STAGE_NAMES = {
  ring: '环状体',
  trophozoite: '大滋养体',
  schizont: '裂殖体',
  gametocyte: '配子体',
}

/**
 * 在 (x,y) 处绘制一个感染红细胞（含虫体）
 * @param {string} species vivax/falciparum/malariae/ovale
 * @param {string} stage ring/trophozoite/schizont/gametocyte
 */
export function drawInfectedCell(ctx, x, y, r, species, stage, rand) {
  const opt = {
    enlarged: species === 'vivax',
    oval: species === 'ovale',
  }
  drawRBC(ctx, x, y, r, opt)
  const rr = opt.enlarged ? r * 1.3 : r

  if (species === 'vivax') {
    drawSchuffnerDots(ctx, x, y, rr, rand)
    if (stage === 'ring') drawRing(ctx, x, y, rr, rand)
    else if (stage === 'trophozoite') drawAmoeboid(ctx, x, y, rr, rand)
    else if (stage === 'schizont') drawSchizont(ctx, x, y, rr, rand, 15)
    else drawGametocyte(ctx, x, y, rr, rand)
  } else if (species === 'falciparum') {
    if (stage === 'ring') drawRing(ctx, x, y, r, rand, { double: rand() > 0.5, small: true })
    else if (stage === 'gametocyte') drawGametocyte(ctx, x, y, r, rand, { crescent: true })
    else if (stage === 'trophozoite') drawRing(ctx, x, y, r, rand, { double: true }) // 外周血少见，以小环状体代替教学
    else drawSchizont(ctx, x, y, r, rand, 10)
  } else if (species === 'malariae') {
    if (stage === 'ring') drawRing(ctx, x, y, r, rand)
    else if (stage === 'trophozoite') {
      // 三日疟特征：带状体横贯红细胞
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rand() * Math.PI)
      ctx.fillStyle = 'rgba(86, 116, 214, 0.85)'
      ctx.fillRect(-r * 0.9, -r * 0.18, r * 1.8, r * 0.36)
      ctx.fillStyle = '#c0392b'
      ctx.beginPath(); ctx.arc(0, 0, r * 0.11, 0, Math.PI * 2); ctx.fill()
      drawPigment(ctx, 0, 0, rand, r, 7)
      ctx.restore()
    } else if (stage === 'schizont') drawSchizont(ctx, x, y, r, rand, 8) // 菊花头状
    else drawGametocyte(ctx, x, y, r, rand)
  } else { // ovale
    drawSchuffnerDots(ctx, x, y, rr, rand, 10)
    if (stage === 'ring') drawRing(ctx, x, y, rr, rand)
    else if (stage === 'trophozoite') drawAmoeboid(ctx, x, y, rr * 0.9, rand)
    else if (stage === 'schizont') drawSchizont(ctx, x, y, rr, rand, 10)
    else drawGametocyte(ctx, x, y, rr, rand)
  }
}
