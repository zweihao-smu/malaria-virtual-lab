import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/**
 * 渲染引擎封装：渲染器、相机、灯光、主循环、相机位移动画。
 * 坐标约定：1 单位 = 1cm，实验台面为 y=0 平面。
 */
export class Engine {
  constructor(container) {
    this.container = container

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x25304a)

    // 初始机位：正对实验台略俯视
    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.5, 1000)
    this.camera.position.set(0, 62, 92)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(0, 0, 0)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.minDistance = 25
    this.controls.maxDistance = 220
    this.controls.maxPolarAngle = Math.PI / 2.05 // 不允许钻到台面以下

    this._setupLights()

    this.clock = new THREE.Clock()
    this._updateFns = []
    this._cameraTween = null

    window.addEventListener('resize', () => this._onResize())
    this.renderer.setAnimationLoop(() => this.tick())
  }

  _setupLights() {
    // 环境光 + 主平行光（模拟实验室顶灯）+ 补光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55))

    const main = new THREE.DirectionalLight(0xfff5e6, 1.6)
    main.position.set(40, 90, 50)
    main.castShadow = true
    main.shadow.mapSize.set(2048, 2048)
    main.shadow.camera.left = -120
    main.shadow.camera.right = 120
    main.shadow.camera.top = 120
    main.shadow.camera.bottom = -120
    this.scene.add(main)

    const fill = new THREE.DirectionalLight(0xdbeafe, 0.5)
    fill.position.set(-50, 40, -40)
    this.scene.add(fill)
  }

  /** 注册每帧更新函数 fn(dt, elapsed) */
  onUpdate(fn) { this._updateFns.push(fn) }

  /**
   * 相机平移动画到指定机位（用于步骤切换时的视角引导）
   * @returns {Promise} 动画完成后 resolve
   */
  moveCamera(position, target, duration = 1.2) {
    return new Promise((resolve) => {
      this._cameraTween = {
        fromPos: this.camera.position.clone(),
        toPos: new THREE.Vector3(...position),
        fromTarget: this.controls.target.clone(),
        toTarget: new THREE.Vector3(...target),
        t: 0, duration, resolve,
      }
    })
  }

  /** 驱动一帧（公开此方法以便在 RAF 被节流的测试环境中手动推进画面） */
  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1)
    const elapsed = this.clock.elapsedTime

    // 相机补间（ease-in-out）
    if (this._cameraTween) {
      const tw = this._cameraTween
      tw.t += dt
      const k = Math.min(tw.t / tw.duration, 1)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.camera.position.lerpVectors(tw.fromPos, tw.toPos, e)
      this.controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e)
      if (k >= 1) { this._cameraTween = null; tw.resolve() }
    }

    for (const fn of this._updateFns) fn(dt, elapsed)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }
}
