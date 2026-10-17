import * as THREE from 'three'

/**
 * 手指模型（采血用）：胶囊形指身 + 指甲，放置于垫枕上。
 * 指腹处设采血锚点，采血后在此显示血滴。
 */
export function createFinger() {
  const group = new THREE.Group()
  group.name = 'finger'
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8a8, roughness: 0.65 })

  // 垫枕
  const rest = new THREE.Mesh(
    new THREE.BoxGeometry(6, 1.6, 14),
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.8 })
  )
  rest.position.y = 0.8
  rest.castShadow = true
  group.add(rest)

  // 指身：胶囊，沿 z 轴横放
  const finger = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 9, 8, 16), skin)
  finger.rotation.x = Math.PI / 2
  finger.position.set(0, 2.9, 0.5)
  finger.castShadow = true
  group.add(finger)

  // 指甲
  const nail = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.8),
    new THREE.MeshStandardMaterial({ color: 0xfde8e0, roughness: 0.35 })
  )
  nail.rotation.x = -0.35
  nail.position.set(0, 3.6, -4.6)
  group.add(nail)

  // 采血锚点：无名指指腹侧面（指尖稍后、略偏侧）
  group.userData.punctureAnchor = new THREE.Vector3(0.9, 3.4, -3.2)
  return group
}
