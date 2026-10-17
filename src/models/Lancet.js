import * as THREE from 'three'

/** 一次性采血针：针帽 + 针身 */
export function createLancet() {
  const group = new THREE.Group()
  group.name = 'lancet'
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 3.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xe8ecf1, roughness: 0.4 })
  )
  body.castShadow = true
  group.add(body)
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.1, 16),
    new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.5 })
  )
  cap.position.y = 2.0
  cap.castShadow = true
  group.add(cap)
  group.rotation.z = Math.PI / 2 // 平放在台面
  return group
}

/** 酒精棉球罐（含棉球） */
export function createCottonJar() {
  const group = new THREE.Group()
  group.name = 'cottonJar'
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.4, 2.4, 3.6, 24),
    new THREE.MeshPhysicalMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.4, roughness: 0.1 })
  )
  jar.position.y = 1.8
  group.add(jar)
  // 罐内棉球
  for (let i = 0; i < 5; i++) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.75, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })
    )
    const a = (i / 5) * Math.PI * 2
    ball.position.set(Math.cos(a) * 1.0, 0.8 + (i % 2) * 0.9, Math.sin(a) * 1.0)
    group.add(ball)
  }
  // 罐身标签：75%酒精棉球
  group.userData.label = '75%酒精棉球'
  return group
}
