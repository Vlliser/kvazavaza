// ============================================================
// Level1Scene.js — «Холодно зимой одной»
//
// Жанр: авто-раннер с прыжками (как Canabalt)
// Малечка бежит вправо, тень преследует сзади.
// Прыжки через препятствия: брёвна, заборы, снежные горки.
// Собираем шакрукханы и бустеры скорости.
//
// СОСТОЯНИЯ (state machine):
//   INTRO → RUNNING → CUTSCENE_BOX → CUTSCENE_QUAKE → CHOICE → END
// ============================================================

import { DIALOGUES } from '../dialogues.js'
import { GSM }       from '../GameStateManager.js'
import { Audio }     from '../audio/AudioManager.js'
import { VirtualJoystick } from '../ui/VirtualJoystick.js'
import { ActionButtons }   from '../ui/ActionButtons.js'
import { HUD }             from '../ui/HUD.js'

// ── Константы ────────────────────────────────────────────────
const W = 854
const H = 480

const GROUND_Y      = H - 80    // Y поверхности земли (400)
const MALECHKA_X    = 180       // Малечка стоит на одном X (мир скроллится)
const BASE_SPEED    = 220       // начальная скорость мира (px/s)
const SPEED_ACCEL   = 3         // ускорение каждую секунду
const MAX_SPEED     = 360
const SHADOW_START  = -160      // стартовая позиция тени (больше форы для комфортного старта)
const SHADOW_CATCH  = -25       // тень поймала Малечку (180 - 25 = 155px)
const DANGER_DIST   = -65       // порог предупреждения (тень ближе 65px)
const JUMP_VEL      = -520      // скорость прыжка
const BOOSTER_DUR   = 3000      // длительность бустера (мс)
const BOOSTER_SPEED = 100       // бонусная скорость от бустера
const GRACE_MS      = 4000      // мс неуязвимости после конца интро

const LEVEL_END_DIST = 3500     // метров до конца уровня

// Типы препятствий (умеренная высота, чтобы легко перепрыгивать)
const OBSTACLES = [
  { type: 'snow',  w: 46, h: 22, color: 0xC8E6FF, label: 'сугроб',   offsetY: 0 },
  { type: 'log',   w: 36, h: 26, color: 0x7B3F2A, label: 'бревно',   offsetY: 0 },
  { type: 'fence', w: 22, h: 36, color: 0x9B7A55, label: 'заборчик', offsetY: 0 },
]

export default class Level1Scene extends Phaser.Scene {
  constructor() { super('Level1Scene') }

  // ────────────────────────────────────────────────────────
  init(data = {}) {
    this._isRetry     = data?.isRetry || false
    this._state       = 'INTRO'   // текущее состояние
    this._worldSpeed  = BASE_SPEED
    this._distance    = 0         // пройденные пиксели
    this._shadowDelta = SHADOW_START  // визуальная дельта тени (отрицательная = позади)
    this._onGround    = true
    this._boosterActive = false
    this._boosterTimer  = 0
    this._introIndex    = 0
    this._introTexts    = DIALOGUES.level1.intro
    this._coins         = GSM.get('shakarukhany') || 0
    this._dead          = false
    this._levelEnded    = false
    this._graceTimer    = 0      // мс неуязвимости после интро
    this._stumbleTimer  = 0      // мс неуязвимости после спотыкания
  }

  // ────────────────────────────────────────────────────────
  preload() {
    // Нет внешних ресурсов — всё генерируем программно
  }

  // ────────────────────────────────────────────────────────
  create() {
    Audio.resume()

    // ── Физика ───────────────────────────────────────────
    this.physics.world.gravity.y = 900

    // ── Фон (параллакс слои) ─────────────────────────────
    this._createBackground()

    // ── Земля (физический статик) ─────────────────────────
    this._ground = this.physics.add.staticGroup()
    const groundTile = this.add.rectangle(W / 2, GROUND_Y + 20, W * 3, 40, 0x1A1A2E)
    this.physics.add.existing(groundTile, true)
    this._ground.add(groundTile)

    // ── Снег на земле ─────────────────────────────────────
    this._snowLayer = this.add.graphics()
    this._drawSnowGround()

    // ── Малечка ───────────────────────────────────────────
    this._createMalechka()

    // ── Тень ─────────────────────────────────────────────
    this._createShadow()

    // ── Препятствия/предметы — СТАТИЧЕСКИЕ группы (стабильная работа)!
    this._obstacles   = this.physics.add.staticGroup()
    this._coins_group = this.physics.add.staticGroup()
    this._boosters    = this.physics.add.staticGroup()

    // Коллизии
    this.physics.add.collider(this._malechka, this._ground,
      this._onLand, null, this)
    this.physics.add.overlap(this._malechka, this._obstacles,
      this._onHitObstacle, null, this)
    this.physics.add.overlap(this._malechka, this._coins_group,
      this._onCoin, null, this)
    this.physics.add.overlap(this._malechka, this._boosters,
      this._onBooster, null, this)

    // ── HUD ──────────────────────────────────────────────
    this._hud = new HUD(this)
    this._hud.setCoins(this._coins)

    // ── Управление ───────────────────────────────────────
    this._joystick = new VirtualJoystick(this, 75, H - 95, 55)
    this._buttons  = new ActionButtons(this, {
      onJump:   () => this._jump(),
      onRun:    () => this._activateBooster(),
      onAction: () => this._interact(),
      onAttack: () => {},  // будет в уровне 2
    })

    // Клавиатура (Пробел, Стрелка вверх, W)
    this._spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this._upKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP)
    this._wKey     = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W)

    // Тап в экран для прыжка:
    // Работает в любом месте экрана, кроме виртуального джойстика (слева внизу)
    // и кроме кнопки бустера (если игрок нажал именно на бустер)
    this.input.on('pointerdown', (pointer) => {
      if (this._state !== 'RUNNING') return  // блокируем во время INTRO / CUTSCENE / диалогов!

      // Исключаем только зону левого виртуального джойстика
      const inJoystick = pointer.x < 170 && pointer.y > H - 180
      if (inJoystick) return

      // Исключаем только конкретную кнопку бустера (▲ слева от центра кнопок: CX - 38, CY)
      const boosterX = W - 90 - 38
      const boosterY = H - 80
      if (Math.hypot(pointer.x - boosterX, pointer.y - boosterY) < 32) return

      this._jump()
    })

    // Свайп вверх тоже делает прыжок
    this.input.on('pointerup', (pointer) => {
      if (this._state !== 'RUNNING') return
      const inJoystick = pointer.x < 170 && pointer.y > H - 180
      if (inJoystick) return
      const dy = pointer.upY - pointer.downY
      if (dy < -30) {
        this._jump()
      }
    })

    // Скрыть управление во время INTRO
    this._joystick.setVisible(false)
    this._buttons.setVisible(false)

    // ── Снег (частицы) ────────────────────────────────────
    this._snowParticles = []
    this._createSnowParticles()

    // ── Таймеры спавна ────────────────────────────────────
    this._spawnTimer    = null
    this._coinTimer     = null
    this._boostSpawnTimer = null

    // ── Запуск игры (при ретрае сразу бежим без повтора интро!) ──
    this.cameras.main.fadeIn(300)
    if (this._isRetry) {
      this._endIntro()
    } else {
      this._startIntro()
    }
  }

  // ──────────────────────────────────────────────────────────
  // ФОНОВЫЕ СЛОИ (параллакс)
  // ──────────────────────────────────────────────────────────
  _createBackground() {
    // Небо
    const sky = this.add.graphics()
    sky.fillGradientStyle(0x050510, 0x050510, 0x0D0A1E, 0x151028, 1)
    sky.fillRect(0, 0, W, H)

    // Луна
    const moon = this.add.graphics()
    moon.fillStyle(0xE8E8D0, 0.9)
    moon.fillCircle(W - 120, 70, 28)
    moon.fillStyle(0x0D0A1E, 1)
    moon.fillCircle(W - 112, 65, 22)  // вырез для полумесяца
    // Лунное свечение
    moon.fillStyle(0xE8E8D0, 0.05)
    moon.fillCircle(W - 120, 70, 55)

    // Звёзды
    this._stars = []
    for (let i = 0; i < 80; i++) {
      const s = this.add.rectangle(
        Phaser.Math.Between(0, W * 2),
        Phaser.Math.Between(0, H * 0.55),
        Math.random() < 0.2 ? 2 : 1,
        Math.random() < 0.2 ? 2 : 1,
        0xffffff,
        Math.random() * 0.7 + 0.2,
      )
      this._stars.push(s)
    }

    // Силуэт города — запекаем в RenderTexture ОДИН РАЗ, потом двигаем через setX
    this._bakeCityBackground()

    // Дорога/тротуар — тоже запекаем один раз, двигаем через setX
    this._bakeRoad()
  }

  // ── Запекание города в RenderTexture (выполняется один раз при старте) ──
  _bakeCityBackground() {
    // Рисуем 2× ширину для бесшовного скролла
    const BW = W * 2
    const BH = H

    const g = this.add.graphics()
    g.fillStyle(0x0A0818, 1)

    const buildings = [
      { x: 0,   w: 80,  h: 140 },
      { x: 100, w: 60,  h: 100 },
      { x: 170, w: 100, h: 180 },
      { x: 280, w: 50,  h: 120 },
      { x: 340, w: 90,  h: 160 },
      { x: 440, w: 70,  h: 110 },
      { x: 520, w: 110, h: 200 },
      { x: 640, w: 55,  h: 130 },
      { x: 710, w: 85,  h: 150 },
      { x: 800, w: 60,  h: 95  },
      // Повтор для второй половины (бесшовный скролл)
      { x: 900,  w: 80,  h: 140 },
      { x: 1000, w: 60,  h: 100 },
      { x: 1070, w: 100, h: 180 },
      { x: 1180, w: 50,  h: 120 },
      { x: 1240, w: 90,  h: 160 },
      { x: 1340, w: 70,  h: 110 },
      { x: 1420, w: 110, h: 200 },
      { x: 1540, w: 55,  h: 130 },
      { x: 1610, w: 85,  h: 150 },
      { x: 1700, w: 60,  h: 95  },
    ]

    const groundY = GROUND_Y - 4
    // Рисуем здания и окна (фиксированные, без Math.random)
    const windowSeed = 42
    let wsIdx = 0
    const ws = [1,0,1,1,0,1,0,1,1,1,0,1,1,0,0,1,1,0,1,1,0,1,0,1,1,0,1,1,1,0]
    for (const b of buildings) {
      g.fillStyle(0x0A0818, 1)
      g.fillRect(b.x, groundY - b.h, b.w, b.h)
      g.fillStyle(0x2C2060, 0.7)
      for (let wy = groundY - b.h + 10; wy < groundY - 10; wy += 20) {
        for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
          if (ws[wsIdx % ws.length]) {
            g.fillRect(wx, wy, 8, 10)
          }
          wsIdx++
        }
      }
    }

    g.generateTexture('city_bg_tex', BW, BH)
    g.destroy()

    // Два спрайта рядом для бесшовного скролла
    this._cityBgSprite1 = this.add.image(0, 0, 'city_bg_tex').setOrigin(0, 0).setDepth(1)
    this._cityBgSprite2 = this.add.image(BW, 0, 'city_bg_tex').setOrigin(0, 0).setDepth(1)
    this._cityBgScrollX = 0
    this._cityBgWidth = BW
  }

  // ── Запекание дороги в RenderTexture (один раз) ──
  _bakeRoad() {
    // Рисуем дорогу шириной 800px (далее зациклим через setX)
    const g = this.add.graphics()

    // Асфальт
    g.fillStyle(0x1A1A28, 1)
    g.fillRect(0, GROUND_Y - 4, W * 2, H - GROUND_Y + 4)
    // Разметка
    g.fillStyle(0x4A4A60, 0.7)
    const lineY = GROUND_Y + 18
    for (let x = 0; x < W * 2 + 80; x += 80) {
      g.fillRect(x, lineY, 50, 4)
    }
    // Бордюр
    g.fillStyle(0x888899, 0.5)
    g.fillRect(0, GROUND_Y - 6, W * 2, 4)

    g.generateTexture('road_tex', W * 2, H)
    g.destroy()

    this._roadSprite1 = this.add.image(0, 0, 'road_tex').setOrigin(0, 0).setDepth(2)
    this._roadSprite2 = this.add.image(W * 2, 0, 'road_tex').setOrigin(0, 0).setDepth(2)
    this._roadScrollX = 0
    this._roadTexWidth = W * 2
  }

  // (дорога теперь запечена в _bakeRoad — этот метод не нужен)

  // Снег под ногами
  _drawSnowGround() {
    this._snowLayer.clear()
    this._snowLayer.fillStyle(0xD0E8FF, 0.25)
    // Неровная снежная насыпь
    const points = []
    for (let x = 0; x <= W; x += 20) {
      points.push({ x, y: GROUND_Y - 2 - Phaser.Math.Between(2, 8) })
    }
    points.push({ x: W, y: GROUND_Y + 5 })
    points.push({ x: 0, y: GROUND_Y + 5 })
    this._snowLayer.fillPoints(points, true)
  }

  // ──────────────────────────────────────────────────────────
  // СНЕЖНЫЕ ЧАСТИЦЫ
  // ──────────────────────────────────────────────────────────
  _createSnowParticles() {
    for (let i = 0; i < 60; i++) {
      const flake = this.add.rectangle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Phaser.Math.Between(1, 3),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Math.random() * 0.6 + 0.3,
      )
      flake._speed = Math.random() * 40 + 20
      flake._drift = (Math.random() - 0.5) * 20
      this._snowParticles.push(flake)
    }
  }

  _updateSnow(delta) {
    const dt = delta / 1000
    for (const f of this._snowParticles) {
      f.y += f._speed * dt
      f.x += f._drift * dt
      if (f.y > H + 5) {
        f.y = -5
        f.x = Phaser.Math.Between(0, W)
      }
      if (f.x > W + 5)  f.x = -5
      if (f.x < -5)     f.x = W + 5
    }
  }

  // ──────────────────────────────────────────────────────────
  // МАЛЕЧКА
  // ──────────────────────────────────────────────────────────
  _createMalechka() {
    // Генерируем текстуру из Graphics
    this._makeMalechkaTexture()

    this._malechka = this.physics.add.sprite(MALECHKA_X, GROUND_Y - 24, 'malechka_run')
    this._malechka.setCollideWorldBounds(false)
    this._malechka.setDepth(20)
    this._malechka.body.setSize(20, 44)

    // Анимация бега (одна текстура — качаем)
    this._runTween = null
    this._isJumping = false
  }

  _makeMalechkaTexture() {
    if (this.textures.exists('malechka_run')) return

    const g = this.add.graphics()
    const s = 3   // размер одного пикселя

    // Цвета персонажа
    const HAIR  = 0x3D1F00  // тёмно-коричневые волосы
    const SKIN  = 0xF4C59A  // кожа
    const COAT  = 0x8B2FC9  // фиолетовое пальто
    const PANTS = 0x1A1A3A  // тёмные штаны
    const BOOT  = 0x3A2A1A  // коричневые ботинки
    const SCARF = 0xFF7043  // оранжевый шарф
    const EYE   = 0x1A0A2E  // глаза

    // Отрисовка пиксельной Малечки (16×16 клеток × s пикселей)
    // 0,0 = левый верхний угол спрайта
    const P = (col, row, color) => {
      g.fillStyle(color, 1)
      g.fillRect(col * s, row * s, s, s)
    }

    // === Голова (rows 0-5) ===
    // Волосы
    for (let c = 2; c <= 7; c++) P(c, 0, HAIR)
    for (let c = 1; c <= 8; c++) P(c, 1, HAIR)
    P(1, 2, HAIR); P(8, 2, HAIR)
    // Лицо
    for (let c = 2; c <= 7; c++) P(c, 2, SKIN)
    for (let c = 1; c <= 8; c++) P(c, 3, SKIN)
    for (let c = 2; c <= 7; c++) P(c, 4, SKIN)
    // Глаза
    P(3, 3, EYE); P(6, 3, EYE)
    // Рот
    P(4, 4, 0xFF9999); P(5, 4, 0xFF9999)
    // Шарф
    for (let c = 1; c <= 8; c++) P(c, 5, SCARF)

    // === Тело (rows 6-10) ===
    for (let r = 6; r <= 10; r++)
      for (let c = 2; c <= 7; c++) P(c, r, COAT)
    // Рукава
    for (let r = 6; r <= 9; r++) P(1, r, COAT)
    for (let r = 6; r <= 9; r++) P(8, r, COAT)
    // Руки
    P(0, 8, SKIN); P(0, 9, SKIN)
    P(9, 7, SKIN); P(9, 8, SKIN)

    // === Ноги (rows 11-14) ===
    P(2, 11, PANTS); P(3, 11, PANTS); P(5, 11, PANTS); P(6, 11, PANTS)
    P(2, 12, PANTS); P(3, 12, PANTS); P(5, 12, PANTS); P(6, 12, PANTS)
    P(2, 13, PANTS); P(3, 13, PANTS); P(5, 13, PANTS); P(6, 13, PANTS)

    // === Ботинки (rows 14-15) ===
    P(1, 14, BOOT); P(2, 14, BOOT); P(3, 14, BOOT); P(4, 14, BOOT)
    P(5, 14, BOOT); P(6, 14, BOOT); P(7, 14, BOOT); P(8, 14, BOOT)
    P(1, 15, BOOT); P(2, 15, BOOT); P(3, 15, BOOT)
    P(6, 15, BOOT); P(7, 15, BOOT); P(8, 15, BOOT)

    g.generateTexture('malechka_run', 10 * s, 16 * s)
    g.destroy()
  }

  // ──────────────────────────────────────────────────────────
  // ТЕНЬ
  // ──────────────────────────────────────────────────────────
  _createShadow() {
    if (this.textures.exists('shadow_tex')) {
      this.textures.remove('shadow_tex')
    }
    const g = this.add.graphics()
    const sw = 64
    const sh = 80

    // Внешний туман тени
    g.fillStyle(0x3B0764, 0.45)
    g.fillCircle(32, 42, 28)

    // Тело тени (тёмная фигура)
    g.fillStyle(0x090114, 0.95)
    g.fillRoundedRect(16, 20, 32, 44, 8)

    // Голова
    g.fillStyle(0x05000A, 1)
    g.fillCircle(32, 22, 15)

    // Капюшон/рога тени
    g.fillStyle(0x090114, 1)
    g.fillTriangle(20, 18, 25, 6, 29, 18)
    g.fillTriangle(35, 18, 39, 6, 44, 18)

    // Яркие горящие красные глаза (с желтыми зрачками — отчётливо видны издалека!)
    g.fillStyle(0xFF0055, 1)
    g.fillRect(23, 19, 7, 5)
    g.fillRect(35, 19, 7, 5)
    g.fillStyle(0xFFFF55, 1)
    g.fillRect(25, 20, 3, 3)
    g.fillRect(37, 20, 3, 3)

    // Когтистые руки, тянущиеся вперёд (вправо, к Малечке)
    g.fillStyle(0x1F0038, 1)
    g.fillRect(36, 38, 20, 4) // рука
    g.fillRect(48, 35, 8, 3)  // верхний коготь
    g.fillRect(52, 39, 10, 3) // средний коготь
    g.fillRect(48, 43, 8, 3)  // нижний коготь

    // Шлейф тьмы сзади (слева)
    g.fillStyle(0x180026, 0.85)
    g.fillRect(6, 28, 14, 8)
    g.fillRect(2, 40, 16, 7)
    g.fillRect(8, 52, 12, 6)

    g.generateTexture('shadow_tex', sw, sh)
    g.destroy()

    this._shadow = this.add.image(
      MALECHKA_X + this._shadowDelta,
      GROUND_Y - 24,
      'shadow_tex'
    ).setDepth(15)

    // Аура тени
    this._shadowAura = this.add.graphics().setDepth(13)
    this._updateShadowAura()

    // Зловещее дыхание / покачивание тени
    this.tweens.add({
      targets: this._shadow,
      scaleY: 1.06,
      scaleX: 0.95,
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  _updateShadowAura() {
    // Аура обновляется максимум 8 раз в секунду (throttle)
    const now = this.time.now
    if (now - (this._lastAuraUpdate || 0) < 125) return
    this._lastAuraUpdate = now

    this._shadowAura.clear()
    if (!this._shadow || !this._shadow.active) return
    const sx = this._shadow.x
    const sy = this._shadow.y

    // Ореол темноты и фиолетово-красного свечения
    this._shadowAura.fillStyle(0x7E22CE, 0.22)
    this._shadowAura.fillCircle(sx, sy - 8, 55)
    this._shadowAura.fillStyle(0xDC2626, 0.28)
    this._shadowAura.fillCircle(sx + 8, sy - 12, 34)
    this._shadowAura.fillStyle(0x050010, 0.5)
    this._shadowAura.fillCircle(sx, sy, 22)
  }

  // ──────────────────────────────────────────────────────────
  // ИНТРО (текстовые карточки)
  // ──────────────────────────────────────────────────────────
  _startIntro() {
    this._state = 'INTRO'
    this._showIntroCard(0)
  }

  _showIntroCard(index) {
    if (index >= this._introTexts.length) {
      this._endIntro()
      return
    }

    const W2 = this.scale.width
    const H2 = this.scale.height

    // Тёмный оверлей
    if (!this._introOverlay) {
      this._introOverlay = this.add.graphics().setDepth(500)
      this._introOverlay.fillStyle(0x000000, 0.82)
      this._introOverlay.fillRect(0, 0, W2, H2)
    }

    const text = this._introTexts[index]

    // Уберём предыдущий текст
    if (this._introTextObj) {
      this._introTextObj.destroy()
      this._introTextObj = null
    }

    // Подсказка «тап чтобы пропустить»
    if (!this._introHint) {
      this._introHint = this.add.text(W2 / 2, H2 - 28, '— тап чтобы продолжить —', {
        fontFamily: 'VT323',
        fontSize:   '20px',
        color:      '#9B59B6',
        alpha:      0.7,
      }).setOrigin(0.5).setDepth(502)
      this.tweens.add({ targets: this._introHint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 })
    }

    this._introTextObj = this.add.text(W2 / 2, H2 / 2, text, {
      fontFamily: 'Press Start 2P',
      fontSize:   '22px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 6,
      align:      'center',
      wordWrap:   { width: W2 * 0.80 },
      lineSpacing: 10,
    }).setOrigin(0.5).setDepth(501).setAlpha(0)

    this.tweens.add({
      targets: this._introTextObj,
      alpha:   1,
      duration: 600,
      ease: 'Power2',
    })

    // ── Защита от двойного вызова ─────────────────────────────
    let _advanced = false
    const advance = () => {
      if (_advanced) return
      _advanced = true

      // Снимаем слушатель тапа (если вызвано по таймеру)
      this.input.off('pointerdown', advance)

      this.tweens.add({
        targets: this._introTextObj,
        alpha:   0,
        duration: 250,
        onComplete: () => this._showIntroCard(index + 1),
      })
    }

    // Автопереход через 2.5 сек
    this._introTimer = this.time.delayedCall(2500, advance)
    // Тап ускоряет
    this.input.once('pointerdown', advance)
  }

  _endIntro() {
    // Убираем подсказку
    if (this._introHint) {
      this._introHint.destroy()
      this._introHint = null
    }

    // Убираем оверлей
    if (this._introOverlay) {
      this.tweens.add({
        targets:  this._introOverlay,
        alpha:    0,
        duration: 500,
        onComplete: () => {
          if (this._introOverlay) {
            this._introOverlay.destroy()
            this._introOverlay = null
          }
        },
      })
    }
    if (this._introTextObj) {
      this._introTextObj.destroy()
      this._introTextObj = null
    }

    // Показываем управление
    this._joystick.setVisible(true)
    this._buttons.setVisible(true)

    // Показываем подсказку
    this._showHint(DIALOGUES.level1.hintRun)

    // Запускаем игровую логику
    this._state = 'RUNNING'
    this._graceTimer = GRACE_MS   // 3 сек неуязвимости
    this._startSpawnTimers()

    // Фоновая пульсация «музыки» (процедурная)
    this._startAmbient()
  }

  // ──────────────────────────────────────────────────────────
  // УПРАВЛЕНИЕ
  // ──────────────────────────────────────────────────────────
  _jump() {
    if (this._state !== 'RUNNING') return

    // Надёжная многофакторная проверка нахождения на земле
    const body = this._malechka?.body
    const onGround = this._onGround ||
      (body && (body.blocked.down || body.touching.down)) ||
      (this._malechka && this._malechka.y >= GROUND_Y - 28 && (!body || body.velocity.y >= -40))

    if (!onGround) return

    this._malechka.setVelocityY(JUMP_VEL)
    this._onGround = false
    Audio.jump()

    // Визуальный наклон при прыжке
    this.tweens.add({
      targets: this._malechka,
      angle:   -15,
      duration: 150,
      yoyo: true,
    })
  }

  _interact() {
    if (this._state !== 'RUNNING') return
    // Логика взаимодействия — для диалогов в следующих сценах
    Audio.uiClick()
  }

  _activateBooster() {
    if (this._state !== 'RUNNING') return
    if (this._boosterActive) return

    this._boosterActive = true
    this._boosterTimer  = BOOSTER_DUR
    Audio.booster()
    this._hud.boosterPopup(MALECHKA_X, GROUND_Y - 80)

    // Эффект свечения: тинт через setTint (НЕ tween!), анимация через alpha
    this._malechka.setTint(0x00FFFF)
    this.tweens.add({
      targets:  this._malechka,
      alpha:    0.7,
      duration: 120,
      yoyo:     true,
      repeat:   3,
    })
  }

  _onLand() {
    if (!this._onGround) {
      this._onGround = true
      Audio.land()
    }
  }

  // ──────────────────────────────────────────────────────────
  // КОЛЛИЗИИ С ПРЕПЯТСТВИЯМИ / КОЛЛЕКТИБЛАМИ
  // ──────────────────────────────────────────────────────────
  _onHitObstacle(malechka, obstacle) {
    if (this._dead || this._state !== 'RUNNING') return
    if (this._graceTimer > 0 || this._stumbleTimer > 0) return

    Audio.hit()
    this.cameras.main.shake(220, 0.014)

    // Тень совершает рывок вперёд (умеренно, чтобы игрок мог оправиться)
    this._shadowDelta += 26

    // Мигание: тинт ЧЕРЕЗ setTint() — НЕ через tween (tint нельзя тинговать!)
    this._stumbleTimer = 1400
    this._malechka.setTint(0xFF4444)

    // Мигание через alpha tween
    this.tweens.add({
      targets:  this._malechka,
      alpha:    0.35,
      duration: 160,
      yoyo:     true,
      repeat:   4,
      onComplete: () => {
        if (this._malechka?.active && !this._dead) {
          this._malechka.setAlpha(1)
          this._malechka.clearTint()
        }
      },
    })

    // Если тень догнала — гибель
    if (this._shadowDelta >= SHADOW_CATCH) {
      this._die()
    }
  }

  _onCoin(malechka, coin) {
    if (coin._shine) {
      this.tweens.killTweensOf(coin._shine)
      coin._shine.destroy()
    }
    this.tweens.killTweensOf(coin)
    coin.destroy()
    this._coins++
    this._hud.addCoins(1)
    this._hud.coinPopup(malechka.x, malechka.y - 30)
    GSM.addCoins(1)
    Audio.coin()

    // Сбор монет отталкивает тень назад!
    this._shadowDelta = Math.max(this._shadowDelta - 18, SHADOW_START - 20)
  }

  _onBooster(malechka, booster) {
    this.tweens.killTweensOf(booster)
    booster.destroy()
    this._activateBooster()

    // Бустер отталкивает тень далеко назад!
    this._shadowDelta = Math.max(this._shadowDelta - 60, SHADOW_START - 30)
  }

  // ──────────────────────────────────────────────────────────
  // СМЕРТЬ
  // ──────────────────────────────────────────────────────────
  _die() {
    if (this._dead) return
    this._dead = true
    this._state = 'DEAD'

    Audio.death()
    this.cameras.main.shake(350, 0.015)

    // Малечка падает
    this._malechka.setVelocityY(-320)
    this._malechka.setVelocityX(-80)
    this._malechka.setAngularVelocity(250)
    this._malechka.setTint(0xFF4444)

    this._joystick?.setVisible(false)
    this._buttons?.setVisible(false)

    // Плавный переход на экран смерти
    this.time.delayedCall(450, () => {
      this.cameras.main.fadeOut(250)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('DeathScene', {
          fromScene: 'Level1Scene',
          levelNum:  1,
          nextScene: 'LevelMapScene',
        })
      })
      // Гарантированный fallback таймер
      this.time.delayedCall(300, () => {
        if (this.scene.isActive('Level1Scene')) {
          this.scene.start('DeathScene', {
            fromScene: 'Level1Scene',
            levelNum:  1,
            nextScene: 'LevelMapScene',
          })
        }
      })
    })
  }

  // ──────────────────────────────────────────────────────────
  // СПАВН ПРЕПЯТСТВИЙ И КОЛЛЕКТИБЛОВ (ДИНАМИЧЕСКИЕ ОБЪЕКТЫ)
  // ──────────────────────────────────────────────────────────
  _startSpawnTimers() {
    // Первое препятствие через 4.5 секунды — игрок успевает сориентироваться
    this._spawnTimer = this.time.addEvent({
      delay:    4500,
      loop:     false,
      callback: this._spawnObstacle,
      callbackScope: this,
    })

    // Монеты каждые 2.5-4 секунды
    this._coinTimer = this.time.addEvent({
      delay:    2000,
      loop:     false,
      callback: this._spawnCoin,
      callbackScope: this,
    })

    // Бустеры каждые 8-14 секунд
    this._boostSpawnTimer = this.time.addEvent({
      delay:    7500,
      loop:     false,
      callback: this._spawnBoosterPickup,
      callbackScope: this,
    })
  }

  _spawnObstacle() {
    if (this._state !== 'RUNNING') return

    const template = Phaser.Utils.Array.GetRandom(OBSTACLES)
    const y = GROUND_Y - template.h / 2 - (template.offsetY || 0)

    const obs = this.add.rectangle(W + 60, y, template.w, template.h, template.color)
    obs.setDepth(18)
    this.physics.add.existing(obs, true)  // static body — стабильно!
    obs.body.setSize(Math.floor(template.w * 0.72), Math.floor(template.h * 0.72))
    this._obstacles.add(obs)

    // Tween движет объект, onUpdate синхронизирует статик-тело
    this.tweens.add({
      targets:  obs,
      x:        -70,
      duration: (W + 130) / this._worldSpeed * 1000,
      ease:     'Linear',
      onUpdate:   () => { if (obs.body) obs.body.reset(obs.x, obs.y) },
      onComplete: () => { if (obs.active) this._obstacles.remove(obs, true, true) },
    })

    if (this._spawnTimer) {
      this._spawnTimer = this.time.addEvent({
        delay: Phaser.Math.Between(3500, 5500),
        loop: false,
        callback: this._spawnObstacle,
        callbackScope: this,
      })
    }
  }

  _spawnCoin() {
    if (this._state !== 'RUNNING') return

    const y = GROUND_Y - Phaser.Math.Between(45, 110)
    const coin = this.add.circle(W + 30, y, 10, 0xF1C40F)
    coin.setDepth(17)
    const shine = this.add.circle(W + 27, y - 3, 3, 0xFFFFAA)
    shine.setDepth(18)
    coin._shine = shine

    this.physics.add.existing(coin, true)  // static body
    this._coins_group.add(coin)

    const dur = (W + 60) / this._worldSpeed * 1000
    this.tweens.add({
      targets:  [coin, shine],
      x:        '-=' + (W + 60),
      duration: dur,
      ease:     'Linear',
      onUpdate: () => { if (coin.body) coin.body.reset(coin.x, coin.y) },
      onComplete: () => {
        if (coin.active)  this._coins_group.remove(coin, true, true)
        if (shine.active) shine.destroy()
      },
    })

    this._coinTimer = this.time.addEvent({
      delay: Phaser.Math.Between(2500, 4500),
      loop: false,
      callback: this._spawnCoin,
      callbackScope: this,
    })
  }

  _spawnBoosterPickup() {
    if (this._state !== 'RUNNING') return

    const y = GROUND_Y - Phaser.Math.Between(55, 105)
    const g = this.add.graphics()
    g.fillStyle(0x00FFFF, 0.95)
    g.fillStar(0, 0, 5, 12, 6)
    g.setPosition(W + 30, y).setDepth(17)

    this.physics.add.existing(g, true)  // static body
    g.body.setSize(24, 24)
    this._boosters.add(g)

    this.tweens.add({ targets: g, scaleX: 1.3, scaleY: 1.3, duration: 400, yoyo: true, repeat: -1 })

    const dur = (W + 70) / this._worldSpeed * 1000
    this.tweens.add({
      targets:  g,
      x:        -40,
      duration: dur,
      ease:     'Linear',
      onUpdate: () => { if (g.body) g.body.reset(g.x, g.y) },
      onComplete: () => { if (g.active) this._boosters.remove(g, true, true) },
    })

    this._boostSpawnTimer = this.time.addEvent({
      delay: Phaser.Math.Between(8000, 14000),
      loop: false,
      callback: this._spawnBoosterPickup,
      callbackScope: this,
    })
  }

  // ──────────────────────────────────────────────────────────
  // ПОДСКАЗКИ
  // ──────────────────────────────────────────────────────────
  _showHint(text) {
    const hint = this.add.text(W / 2, 75, text, {
      fontFamily: 'VT323',
      fontSize:   '26px',
      color:      '#FFE082',
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(200).setAlpha(0)

    this.tweens.add({ targets: hint, alpha: 1, duration: 400 })
    this.time.delayedCall(3800, () => {
      this.tweens.add({ targets: hint, alpha: 0, duration: 600,
        onComplete: () => hint.destroy() })
    })
  }

  // ──────────────────────────────────────────────────────────
  // АТМОСФЕРНЫЙ ЗВУК (процедурный)
  // ──────────────────────────────────────────────────────────
  _startAmbient() {
    // Тихий "ветер" через низкочастотный сигнал каждые 5с
    this._ambientTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => {
        if (this._state === 'RUNNING') {
          // Тихий звуковой намёк
        }
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // КАТСЦЕНА: ТЕНЬ ОСТАВЛЯЕТ КОРОБКУ
  // ──────────────────────────────────────────────────────────
  _startCutsceneBox() {
    this._state = 'CUTSCENE_BOX'

    this._joystick.setVisible(false)
    this._buttons.setVisible(false)

    // Тень резко останавливается
    this.tweens.add({
      targets: this._shadow,
      x: MALECHKA_X - 80,
      duration: 500,
      ease: 'Power2',
    })

    // Малечка тормозит
    this._worldSpeed = 0

    this._showDialogSequence(DIALOGUES.level1.boxScene, () => {
      this._startCutsceneEarthquake()
    })
  }

  // ──────────────────────────────────────────────────────────
  // КАТСЦЕНА: ЗЕМЛЕТРЯСЕНИЕ И МОНСТР
  // ──────────────────────────────────────────────────────────
  _startCutsceneEarthquake() {
    this._state = 'CUTSCENE_QUAKE'
    Audio.sting()
    this.cameras.main.shake(1000, 0.018)

    this._showDialogSequence(DIALOGUES.level1.earthquake, () => {
      this._startChoice()
    })
  }

  // ──────────────────────────────────────────────────────────
  // ВЫБОР: СБЕЖАТЬ / СРАЗИТЬСЯ
  // ──────────────────────────────────────────────────────────
  _startChoice() {
    this._state = 'CHOICE'

    const cx = W / 2
    const cy = H / 2

    // Оверлей выбора
    const ov = this.add.graphics().setDepth(300)
    ov.fillStyle(0x000000, 0.6)
    ov.fillRect(0, 0, W, H)

    this.add.text(cx, cy - 60, DIALOGUES.level1.choice.question, {
      fontFamily: 'Press Start 2P',
      fontSize:   '14px',
      color:      '#FFEEAA',
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(301)

    // Кнопка СБЕЖАТЬ
    this._choiceButton(cx - 140, cy + 20, DIALOGUES.level1.choice.flee, 0x27AE60, 0x1A6B3A, () => {
      this._endLevelFlee()
    })

    // Кнопка СРАЗИТЬСЯ
    this._choiceButton(cx + 140, cy + 20, DIALOGUES.level1.choice.fight, 0xC0392B, 0x922B21, () => {
      this._endLevelFight()
    })
  }

  _choiceButton(x, y, label, colorBg, colorHov, onClick) {
    const BW = 180; const BH = 48

    // Container-кнопка (надёжнее чем Zone)
    const container = this.add.container(x, y).setDepth(304)

    const bg = this.add.graphics()
    bg.fillStyle(colorBg, 0.9)
    bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 8)
    bg.lineStyle(2, 0xffffff, 0.5)
    bg.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 8)

    const lbl = this.add.text(0, 0, label, {
      fontFamily: 'Press Start 2P',
      fontSize:   '9px',
      color:      '#ffffff',
    }).setOrigin(0.5)

    container.add([bg, lbl])
    container.setSize(BW, BH)
    container.setInteractive(new Phaser.Geom.Rectangle(-BW / 2, -BH / 2, BW, BH), Phaser.Geom.Rectangle.Contains)

    container.on('pointerdown', () => {
      Audio.uiClick()
      onClick()
    })
    container.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(colorHov, 1)
      bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 8)
      this.tweens.add({ targets: container, scaleX: 1.04, scaleY: 1.04, duration: 80 })
    })
    container.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(colorBg, 0.9)
      bg.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 8)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 })
    })
  }

  // ──────────────────────────────────────────────────────────
  // КОНЦОВКИ УРОВНЯ
  // ──────────────────────────────────────────────────────────
  _endLevelFlee() {
    this._showDialogSequence(DIALOGUES.level1.fleeEnding, async () => {
      await GSM.completeLevel(1)
      Audio.levelComplete()
      this.cameras.main.fadeOut(600)
      this.time.delayedCall(600, () => this.scene.start('LevelMapScene'))
    })
  }

  _endLevelFight() {
    // Уровень 2 — «Арена иллюзий»
    this.cameras.main.fadeOut(500)
    this.time.delayedCall(500, () => this.scene.start('LevelMapScene'))
  }

  // ──────────────────────────────────────────────────────────
  // ДИАЛОГОВЫЙ ДВИЖОК (последовательный показ реплик)
  // Защищён от двойного срабатывания (debounce 200мс)
  // ──────────────────────────────────────────────────────────
  _showDialogSequence(lines, onComplete) {
    let i = 0
    let _locked = false  // блокировка между тапами

    // Боксик диалога снизу
    const boxH = 80
    const box  = this.add.graphics().setDepth(400)
    box.fillStyle(0x0D0620, 0.92)
    box.fillRoundedRect(20, H - boxH - 10, W - 40, boxH, 10)
    box.lineStyle(2, 0x9B59B6, 0.8)
    box.strokeRoundedRect(20, H - boxH - 10, W - 40, boxH, 10)

    const txt = this.add.text(40, H - boxH + 5, '', {
      fontFamily: 'VT323',
      fontSize:   '22px',
      color:      '#E8D5FF',
      wordWrap:   { width: W - 80 },
    }).setDepth(401)

    const hint = this.add.text(W - 30, H - 20, '▶ тап', {
      fontFamily: 'VT323',
      fontSize:   '16px',
      color:      '#9B59B6',
    }).setOrigin(1, 1).setDepth(401)

    const advance = () => {
      if (_locked) return
      _locked = true

      if (i >= lines.length) {
        // Все реплики показаны — убираем диалог
        this.input.off('pointerdown', advance)
        if (box.active)  box.destroy()
        if (txt.active)  txt.destroy()
        if (hint.active) hint.destroy()
        onComplete?.()
        return
      }

      txt.setText(lines[i])
      Audio.dialogNext()
      i++

      // Разблокировать следующий тап через 200мс
      this.time.delayedCall(200, () => { _locked = false })
    }

    // Показываем первую реплику сразу
    advance()

    // Постоянный слушатель — убирается когда реплики заканчиваются
    this.input.on('pointerdown', advance)

    // Авто-очистка при уходе со сцены
    this.events.once('shutdown', () => this.input.off('pointerdown', advance))
  }

  // ──────────────────────────────────────────────────────────
  // UPDATE — главный цикл
  // ──────────────────────────────────────────────────────────
  update(time, delta) {
    if (this._dead || this._state === 'INTRO') return
    if (this._state !== 'RUNNING') return

    const dt = delta / 1000

    // ── Скорость мира ─────────────────────────────────────
    const speedMod = this._boosterActive ? BOOSTER_SPEED : 0
    const currentSpeed = Math.min(this._worldSpeed + speedMod, MAX_SPEED)

    // Ускорение со временем
    this._worldSpeed = Math.min(this._worldSpeed + SPEED_ACCEL * dt, MAX_SPEED)

    // ── Дистанция ─────────────────────────────────────────
    this._distance += currentSpeed * dt
    const meters = Math.floor(this._distance / 10)
    this._hud.setDistance(meters)

    // ── Скролл фона (через setX — без перерисовки!) ───────
    this._cityBgScrollX -= currentSpeed * 0.3 * dt
    if (this._cityBgScrollX <= -this._cityBgWidth) this._cityBgScrollX += this._cityBgWidth
    this._cityBgSprite1.setX(this._cityBgScrollX)
    this._cityBgSprite2.setX(this._cityBgScrollX + this._cityBgWidth)

    this._roadScrollX -= currentSpeed * dt
    if (this._roadScrollX <= -this._roadTexWidth) this._roadScrollX += this._roadTexWidth
    this._roadSprite1.setX(this._roadScrollX)
    this._roadSprite2.setX(this._roadScrollX + this._roadTexWidth)

    // ── Снег ──────────────────────────────────────────────
    this._updateSnow(delta)

    // ── Боустер ───────────────────────────────────────────
    if (this._boosterActive) {
      this._boosterTimer -= delta
      if (this._boosterTimer <= 0) {
        this._boosterActive = false
        this._malechka.clearTint()
      }
    }

    // ── Объекты движутся через tween (body.reset в onUpdate) — ничего лишнего здесь! ──


    // ── Проверка нахождения на земле / сброс флага прыжка ──
    if (this._malechka?.body) {
      const b = this._malechka.body
      if (b.blocked.down || b.touching.down || (this._malechka.y >= GROUND_Y - 26 && b.velocity.y >= 0)) {
        if (!this._onGround) {
          this._onGround = true
          Audio.land()
        }
      }
    }

    // ── Прыжок (клавиатура / джойстик вверх) ────────────────
    const jumpNow = Phaser.Input.Keyboard.JustDown(this._spaceKey)
      || Phaser.Input.Keyboard.JustDown(this._upKey)
      || Phaser.Input.Keyboard.JustDown(this._wKey)
      || (this._joystick.up && !this._lastJoyUp)
    this._lastJoyUp = this._joystick.up

    if (jumpNow) this._jump()

    // ── Анимация бега (покачивание) ───────────────────────
    const runCycle = Math.sin(time * 0.012) * 5
    this._malechka.setAngle(runCycle)

    // ── Период неуязвимости (grace & stumble) ──────────────
    if (this._graceTimer > 0) {
      this._graceTimer -= delta
    }
    if (this._stumbleTimer > 0) {
      this._stumbleTimer -= delta
    }

    // ── Тень ─────────────────────────────────────────────
    // Тень плавно сокращает дистанцию (сбалансированная скорость)
    const shadowGain = (currentSpeed * 0.010 + 0.8) * dt
    this._shadowDelta = Math.min(this._shadowDelta + shadowGain, SHADOW_CATCH)

    const sx = MALECHKA_X + this._shadowDelta
    this._shadow.setPosition(sx, GROUND_Y - 24)
    this._updateShadowAura()

    // Предупреждение
    const danger = this._shadowDelta > DANGER_DIST
    this._hud.setShadowWarning(danger)
    if (danger && !this._lastDanger) Audio.danger()
    this._lastDanger = danger

    // Тень поймала! → смерть (только после grace-периода)
    if (this._shadowDelta >= SHADOW_CATCH && this._graceTimer <= 0) {
      this._die()
      return
    }

    // ── Конец уровня ─────────────────────────────────────
    if (this._distance >= LEVEL_END_DIST * 10 && !this._levelEnded) {
      this._levelEnded = true
      this._startCutsceneBox()
    }
  }

  // ──────────────────────────────────────────────────────────
  // SHUTDOWN
  // ──────────────────────────────────────────────────────────
  shutdown() {
    try {
      if (this._spawnTimer)      { this._spawnTimer.remove(); this._spawnTimer = null }
      if (this._coinTimer)       { this._coinTimer.remove(); this._coinTimer = null }
      if (this._boostSpawnTimer) { this._boostSpawnTimer.remove(); this._boostSpawnTimer = null }
      if (this._ambientTimer)    { this._ambientTimer.remove(); this._ambientTimer = null }
      this.time.removeAllEvents()
      this.tweens.killAll()
      this._joystick?.destroy()
      this._buttons?.destroy()
      this._hud?.destroy()
    } catch (e) {
      console.warn('Level1Scene shutdown error:', e)
    }
  }
}
