import * as THREE from 'three'

/**
 * 试剂瓶工厂：瓶身 + 瓶盖 + 中文标签（CanvasTexture 绘制文字）。
 * 用 canvas 画标签可避免加载外部字体/图片资源。
 */
export function createReagentBottle({ name, liquidColor, capColor = 0x374151, radius = 2.2, height = 9 }) {
  const group = new THREE.Group()
  group.name = `bottle_${name}`

  // 瓶身（玻璃）
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 1.05, height, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.08 })
  )
  body.position.y = height / 2
  body.castShadow = true
  group.add(body)

  // 瓶内液体
  const liquid = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.88, radius * 0.92, height * 0.62, 24),
    new THREE.MeshStandardMaterial({ color: liquidColor, roughness: 0.3 })
  )
  liquid.position.y = height * 0.34
  group.add(liquid)

  // 瓶盖
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.6, radius * 0.6, height * 0.2, 20),
    new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.6 })
  )
  cap.position.y = height + height * 0.1
  cap.castShadow = true
  group.add(cap)

  // 中文标签：canvas 文字贴图
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, 256, 128)
  ctx.strokeStyle = '#94a3b8'
  ctx.strokeRect(4, 4, 248, 120)
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 40px "Microsoft YaHei", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 长名称自动缩小字号
  if (name.length > 4) ctx.font = 'bold 30px "Microsoft YaHei", sans-serif'
  ctx.fillText(name, 128, 64)

  const labelTex = new THREE.CanvasTexture(canvas)
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 1.7, radius * 0.85),
    new THREE.MeshBasicMaterial({ map: labelTex })
  )
  label.position.set(0, height * 0.55, radius * 1.06)
  group.add(label)

  group.userData.label = name
  return group
}
