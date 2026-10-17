/**
 * 实验全局状态：各步骤共享的"物证"记录。
 * 步骤通过读写此对象感知彼此的结果（如推片质量影响镜检难度）。
 */
export function createExperimentState() {
  return {
    // 步骤1
    identified: new Set(),      // 已认知/已选取的器材名
    // 步骤2
    disinfected: false,         // 已消毒
    alcoholDry: false,          // 酒精已挥发
    punctured: false,           // 已刺血
    firstDropWiped: false,      // 已擦去第一滴血
    dropsTaken: 0,              // 已取血滴数
    // 步骤3
    thickFilmQuality: null,     // 'good' | 'thick' | 'broken'
    thinFilmQuality: null,
    filmDry: false,
    // 步骤4
    thinFixed: false,
    thickLyzed: false,          // 厚血膜溶血
    // 步骤5
    stained: false,
    washed: false,
    // 步骤6
    oiled: false,
    foundCount: 0,
    usedOilObjective: false,
  }
}
