import * as THREE from 'three'

/**
 * 简化光学显微镜：镜座、镜臂、载物台、物镜转换器（3 个物镜）、粗/细准焦螺旋、目镜。
 * 保留可操作部件的独立 mesh，供点击/旋转动画使用。
 */
export function createMicroscope() {
  const group = new THREE.Group()
  group.name = 'microscope'
  const metal = new THREE.MeshStandardMaterial({ color: 0x2f3b4c, roughness: 0.35, metalness: 0.6 })
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4, metalness: 0.55 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.3, metalness: 0.7 })

  // 镜座（马蹄形底座简化为梯形台）
  const base = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 11), metal)
  base.position.y = 1.2
  base.castShadow = true
  group.add(base)

  // 镜柱
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 6, 16), metal)
  pillar.position.set(0, 5.4, -3.6)
  group.add(pillar)

  // 镜臂（弧形简化为斜梁）
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 14, 2.6), metal)
  arm.position.set(0, 12, -1.8)
  arm.rotation.x = 0.28
  arm.castShadow = true
  group.add(arm)

  // 载物台
  const stage = new THREE.Mesh(new THREE.BoxGeometry(11, 0.9, 10), darkMetal)
  stage.position.set(0, 10.2, 2.2)
  stage.castShadow = true
  group.add(stage)
  // 压片夹
  const clip = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.5), brass)
  clip.position.set(-3.2, 10.85, 1.0)
  group.add(clip)

  // 物镜转换器（可旋转圆盘）
  const turret = new THREE.Group()
  turret.name = 'turret'
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 1.4, 24), darkMetal)
  turret.add(disk)
  // 三个物镜：10×（短）/ 40×（中）/ 100×油镜（长）
  const lensSpecs = [
    { len: 1.6, ring: 0xfacc15, name: '10x' },
    { len: 2.4, ring: 0x60a5fa, name: '40x' },
    { len: 3.1, ring: 0xf8fafc, name: '100x' },
  ]
  lensSpecs.forEach((spec, i) => {
    const a = (i / 3) * Math.PI * 2
    const lens = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, spec.len, 14), brass)
    body.position.y = -spec.len / 2 - 0.6
    lens.add(body)
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.3, 14),
      new THREE.MeshStandardMaterial({ color: spec.ring, roughness: 0.4 }))
    ring.position.y = -0.75
    lens.add(ring)
    lens.position.set(Math.cos(a) * 1.7, 0, Math.sin(a) * 1.7)
    lens.name = `objective_${spec.name}`
    turret.add(lens)
  })
  turret.position.set(0, 13.4, 2.4)
  group.add(turret)

  // 镜筒 + 目镜
  const tubeBody = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 6.5, 16), metal)
  tubeBody.position.set(0, 17.2, 0.9)
  tubeBody.rotation.x = 0.28
  group.add(tubeBody)
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 2.2, 16), darkMetal)
  eyepiece.position.set(0, 21.3, 0.0)
  eyepiece.rotation.x = 0.28
  eyepiece.name = 'eyepiece'
  group.add(eyepiece)

  // 粗/细准焦螺旋（镜臂两侧大/小旋钮）
  const coarse = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.8, 20), darkMetal)
  coarse.rotation.z = Math.PI / 2
  coarse.position.set(2.1, 13.5, -2.2)
  coarse.name = 'coarseKnob'
  group.add(coarse)
  const fine = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.0, 16), brass)
  fine.rotation.z = Math.PI / 2
  fine.position.set(2.2, 12.2, -2.2)
  fine.name = 'fineKnob'
  group.add(fine)

  group.userData = { turret, stage, eyepiece, coarse, fine }
  return group
}
