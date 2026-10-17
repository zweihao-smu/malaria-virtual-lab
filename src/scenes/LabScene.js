import * as THREE from 'three'
import { createSlide, createPusher } from '../models/Slide.js'
import { createLancet, createCottonJar } from '../models/Lancet.js'
import { createPipette } from '../models/Pipette.js'
import { createReagentBottle } from '../models/StainBottle.js'
import { createMicroscope } from '../models/Microscope.js'
import { createFinger } from '../models/FingerModel.js'

/**
 * 实验室主场景：实验台 + 全部器材摆位。
 * 布局（台面 y=0，单位 cm）：
 *   左侧 x≈-45：采血区（手指、采血针、酒精棉球罐）
 *   中央 x≈0：推片区（载玻片 A/B、推片、滴管）
 *   右侧 x≈+38：试剂区（甲醇/吉姆萨/缓冲液/蒸馏水/香柏油）
 *   右后 x≈+62：显微镜；前景杂物：酒精灯、培养皿（步骤1的干扰项）
 */
export function buildLabScene(scene) {
  // 地面与墙面
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshStandardMaterial({ color: 0x3b4759, roughness: 0.95 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -78
  floor.receiveShadow = true
  scene.add(floor)

  // 实验台面
  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(170, 3, 80),
    new THREE.MeshStandardMaterial({ color: 0xd6cfc4, roughness: 0.6 })
  )
  bench.position.y = -1.5
  bench.receiveShadow = true
  bench.castShadow = true
  scene.add(bench)
  // 台架腿
  const legMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.5, metalness: 0.4 })
  for (const [x, z] of [[-78, -33], [78, -33], [-78, 33], [78, 33]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 76, 4), legMat)
    leg.position.set(x, -39.5, z)
    scene.add(leg)
  }

  const refs = {}

  // ===== 采血区 =====
  refs.finger = createFinger()
  refs.finger.position.set(-52, 0, 8)
  scene.add(refs.finger)

  refs.lancet = createLancet()
  refs.lancet.position.set(-40, 0.5, 20)
  scene.add(refs.lancet)

  refs.cottonJar = createCottonJar()
  refs.cottonJar.position.set(-64, 0, -6)
  scene.add(refs.cottonJar)

  // 采血区小物件的隐形拾取代理（采血针/滴管太细，扩大可点区域）
  const addHitProxy = (obj, size) => {
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshBasicMaterial({ visible: false })
    )
    proxy.name = 'hitProxy'
    obj.add(proxy)
  }
  addHitProxy(refs.lancet, [1.6, 4.5, 1.6]) // 局部 y 轴沿针身（模型已旋转躺平）

  // ===== 推片区 =====
  refs.slideA = createSlide('A') // 厚血膜
  refs.slideA.position.set(-9, 0.1, 2)
  scene.add(refs.slideA)

  refs.slideB = createSlide('B') // 薄血膜
  refs.slideB.position.set(3, 0.1, 2)
  scene.add(refs.slideB)

  refs.pusher = createPusher()
  refs.pusher.position.set(-3, 0.1, -8)
  refs.pusher.rotation.y = 0.15
  scene.add(refs.pusher)

  refs.pipette = createPipette()
  refs.pipette.position.set(12, 0.4, -8)
  scene.add(refs.pipette)
  addHitProxy(refs.pipette, [1.8, 8.5, 1.8]) // 局部 y 轴沿管身

  // ===== 试剂区 =====
  const bottleSpecs = [
    { key: 'methanol', name: '甲醇', liquidColor: 0xdbeafe, pos: [30, 0, -18] },
    { key: 'giemsa', name: '吉姆萨染液', liquidColor: 0x7c3aed, pos: [39, 0, -18] },
    { key: 'buffer', name: '缓冲液', liquidColor: 0xbbf7d0, pos: [48, 0, -18] },
    { key: 'water', name: '蒸馏水', liquidColor: 0xe0f2fe, pos: [57, 0, -18] },
    { key: 'cedarOil', name: '香柏油', liquidColor: 0xfde68a, pos: [66, 0, -18], radius: 1.5, height: 6 },
  ]
  for (const spec of bottleSpecs) {
    const bottle = createReagentBottle(spec)
    bottle.position.set(...spec.pos)
    scene.add(bottle)
    refs[spec.key] = bottle
  }

  // ===== 染色缸（用于放置染色中的玻片） =====
  const stainRack = new THREE.Mesh(
    new THREE.BoxGeometry(20, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5 })
  )
  stainRack.position.set(43, 0.6, -4)
  stainRack.castShadow = true
  scene.add(stainRack)
  refs.stainRack = stainRack

  // ===== 显微镜 =====
  refs.microscope = createMicroscope()
  refs.microscope.position.set(58, 0, 12)
  refs.microscope.rotation.y = -0.5
  scene.add(refs.microscope)

  // ===== 干扰项器材（步骤 1 考核用）：酒精灯、培养皿 =====
  const lamp = new THREE.Group()
  lamp.name = 'alcoholLamp'
  const lampBody = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 18, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xfef3c7, transparent: true, opacity: 0.5 })
  )
  lampBody.position.y = 2
  lamp.add(lampBody)
  const lampCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.7, 0.9, 1.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af })
  )
  lampCap.position.y = 4
  lamp.add(lampCap)
  lamp.position.set(-30, 0, -22)
  scene.add(lamp)
  refs.alcoholLamp = lamp

  const dish = new THREE.Group()
  dish.name = 'petriDish'
  const dishGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.9, 28),
    new THREE.MeshPhysicalMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.35, roughness: 0.1 })
  )
  dishGlass.position.y = 0.45
  dish.add(dishGlass)
  dish.position.set(-14, 0, -20)
  scene.add(dish)
  refs.petriDish = dish

  // 废液缸
  const waste = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 2.2, 5, 18),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 })
  )
  waste.position.set(20, 2.5, 18)
  waste.castShadow = true
  scene.add(waste)
  refs.waste = waste

  return refs
}
