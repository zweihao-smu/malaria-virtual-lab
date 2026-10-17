import * as THREE from 'three'

/** 胶头滴管：玻璃细管 + 橡胶吸头 */
export function createPipette() {
  const group = new THREE.Group()
  group.name = 'pipette'
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.1, 6.5, 12),
    new THREE.MeshPhysicalMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.5, roughness: 0.1 })
  )
  group.add(tube)
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 })
  )
  bulb.position.y = 3.8
  bulb.scale.y = 1.25
  group.add(bulb)
  group.rotation.z = Math.PI / 2
  return group
}
