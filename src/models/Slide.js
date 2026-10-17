import * as THREE from 'three'

/**
 * 载玻片：玻璃片身 + 磨砂标签端。
 * bloodAnchor 标记滴血位置（slide 局部坐标），供推片逻辑使用。
 */
export function createSlide(label = '') {
  const group = new THREE.Group()
  group.name = `slide_${label}`

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.12, 2.6),
    new THREE.MeshPhysicalMaterial({
      color: 0xdfeefc, transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0,
    })
  )
  glass.position.y = 0.06
  glass.castShadow = true
  group.add(glass)

  // 磨砂标签端
  const labelZone = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.14, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 })
  )
  labelZone.position.set(-3.0, 0.07, 0)
  group.add(labelZone)

  // 滴血锚点：距右端 2.2cm 处（薄血膜标准位置）
  group.userData.bloodAnchor = new THREE.Vector3(1.6, 0.15, 0)
  group.userData.label = label
  return group
}

/** 推片：边缘光滑的载玻片，用于推制血膜 */
export function createPusher() {
  const group = new THREE.Group()
  group.name = 'pusher'
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.12, 2.6),
    new THREE.MeshPhysicalMaterial({ color: 0xeef6ff, transparent: true, opacity: 0.45, roughness: 0.08 })
  )
  glass.position.y = 0.06
  glass.castShadow = true
  group.add(glass)
  // 边缘标记条，便于学生辨认推片的"工作边"
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.16, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x60a5fa })
  )
  edge.position.set(-3.8, 0.08, 0)
  group.add(edge)
  return group
}

/** 血滴 */
export function createBloodDrop(radius = 0.45) {
  const drop = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6),
    new THREE.MeshStandardMaterial({ color: 0xa11818, roughness: 0.25 })
  )
  drop.scale.y = 0.55
  drop.name = 'bloodDrop'
  return drop
}

/** 厚血膜：直径约 1cm 的圆形血膜 */
export function createThickFilm() {
  const film = new THREE.Mesh(
    new THREE.CylinderGeometry(1.0, 1.0, 0.05, 32),
    new THREE.MeshStandardMaterial({ color: 0x8f1d1d, roughness: 0.5 })
  )
  film.name = 'thickFilm'
  return film
}

/** 薄血膜：舌状（泪滴形），用 Shape 拉伸实现 */
export function createThinFilm(quality = 'good') {
  const shape = new THREE.Shape()
  // 舌状：宽头渐窄收尾；质量差时做断裂/波纹
  shape.moveTo(0, -1.1)
  shape.bezierCurveTo(1.1, -1.1, 1.15, -0.3, 1.05, 0.4)
  shape.bezierCurveTo(0.95, 1.0, 0.4, 2.6, 0, 3.4)
  shape.bezierCurveTo(-0.4, 2.6, -0.95, 1.0, -1.05, 0.4)
  shape.bezierCurveTo(-1.15, -0.3, -1.1, -1.1, 0, -1.1)

  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  const color = quality === 'good' ? 0xb8402f : 0x9c4a3d
  const film = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }))
  film.name = 'thinFilm'
  return film
}
