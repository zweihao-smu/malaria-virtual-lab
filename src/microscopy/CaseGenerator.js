/**
 * 病例生成器：随机确定虫种、感染密度、虫期分布，
 * 并在虚拟血膜坐标系中布设虫体位置（供镜检"寻找虫体"）。
 *
 * 血膜坐标系：宽 FILM_W、高 FILM_H 的连续平面（单位约等于 1μm 尺度感即可）。
 */
export const FILM_W = 4000
export const FILM_H = 2200

/** 简单可播种伪随机（mulberry32），保证同一病例形态可复现 */
export function seededRandom(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 教学范围只含两种最常见虫种：间日疟、恶性疟
const SPECIES_POOL = ['vivax', 'falciparum']
const STAGES_BY_SPECIES = {
  vivax: ['ring', 'trophozoite', 'schizont', 'gametocyte'],
  falciparum: ['ring', 'gametocyte'], // 外周血常见环状体与配子体
  malariae: ['ring', 'trophozoite', 'schizont'],
  ovale: ['ring', 'trophozoite', 'schizont', 'gametocyte'],
}

export function generateCase() {
  const seed = Math.floor(Math.random() * 1e9)
  const rand = seededRandom(seed)
  const species = SPECIES_POOL[Math.floor(rand() * SPECIES_POOL.length)]
  const density = 0.6 + rand() * 1.6 // 平均每个油镜视野虫体数
  const stages = STAGES_BY_SPECIES[species]

  // 在血膜上布设约 100 个虫体：保证 100× 视野平移 2–3 次即可遇到虫体（镜检目标从中选取）
  const parasites = []
  for (let i = 0; i < 100; i++) {
    parasites.push({
      id: i,
      x: 200 + rand() * (FILM_W - 400),
      y: 200 + rand() * (FILM_H - 400),
      stage: stages[Math.floor(rand() * stages.length)],
      found: false,
    })
  }
  return { seed, species, density, parasites }
}
