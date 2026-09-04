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
const SHADOW_START  = -120      // стартовая позиция тени (180 - 120 = 60px, видна слева!)
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
  init() {
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

    // ── Препятствия и предметы (ДИНАМИЧЕСКИЕ группы) ─────
    this._obstacles   = this.physics.add.group()
    this._coins_group = this.physics.add.group()
    this._boosters    = this.physics.add.group()

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

    // Тап в любую точку экрана для прыжка
    // ВАЖНО: только когда RUNNING и не в зоне управления (левый джойстик / правые кнопки)
    this.input.on('pointerdown', (pointer) => {
      if (this._state !== 'RUNNING') return  // блокируем во время INTRO / CUTSCENE / диалогов!
      // Исключаем левый нижний (джойстик) и правый нижний (кнопки)
      const inJoystick = pointer.x < 160 && pointer.y > H - 200
      const inButtons  = pointer.x > W - 200 && pointer.y > H - 200
      if (inJoystick || inButtons) return
      this._jump()
    })

    // Свайп вверх тоже делает прыжок (но только в игровой зоне)
    this.input.on('pointerup', (pointer) => {
      if (this._state !== 'RUNNING') return
      const inJoystick = pointer.x < 160 && pointer.y > H - 200
      const inButtons  = pointer.x > W - 200 && pointer.y > H - 200
      if (inJoystick || inButtons) return
      const dy = pointer.upY - pointer.downY
      if (dy < -35) {
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

    // ── Запуск интро ─────────────────────────────────────
    this.cameras.main.setAlpha(0)
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 600,
      onComplete: () => this._startIntro()
    })
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

    // Силуэт города (задний план) — медленный скролл
    this._cityBg = this.add.graphics()
    this._cityBgX = 0
    this._drawCityBackground(this._cityBg, 0)

    // Дорога/тротуар — средний скролл
    this._roadGraphics = this.add.graphics()
    this._roadX = 0
    this._drawRoad(this._roadGraphics, 0)
  }

  // Рисуем силуэты зданий
  _drawCityBackground(g, offsetX) {
    g.clear()
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
      // Дублируем для бесшовного скролла
      { x: 870, w: 80,  h: 140 },
      { x: 970, w: 100, h: 180 },
      { x: 1080, w: 90, h: 160 },
    ]

    const groundY = GROUND_Y - 4
    for (const b of buildings) {
      const bx = ((b.x - offsetX) % (W + 200) + (W + 200)) % (W + 200) - 100
      g.fillRect(bx, groundY - b.h, b.w, b.h)

      // Окна
      g.fillStyle(0x2C2060, 0.7)
      for (let wy = groundY - b.h + 10; wy < groundY - 10; wy += 20) {
        for (let wx = bx + 8; wx < bx + b.w - 8; wx += 16) {
          if (Math.random() > 0.4) {
            g.fillRect(wx, wy, 8, 10)
          }
        }
      }
      g.fillStyle(0x0A0818, 1) // сброс
    }
  }

  // Рисуем дорогу
  _drawRoad(g, offsetX) {
    g.clear()
    // Асфальт
    g.fillStyle(0x1A1A28, 1)
    g.fillRect(0, GROUND_Y - 4, W, H - GROUND_Y + 4)
    // Разметка (прерывистая линия)
    g.fillStyle(0x4A4A60, 0.7)
    const lineY = GROUND_Y + 18
    for (let x = -offsetX % 80; x < W + 80; x += 80) {
      g.fillRect(x, lineY, 50, 4)
    }
    // Бордюр
    g.fillStyle(0x888899, 0.5)
    g.fillRect(0, GROUND_Y - 6, W, 4)
  }

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
    this._shadowAura.clear()
    if (!this._shadow || !this._shadow.active) return
    const sx = this._shadow.x
    const sy = this._shadow.y

    // Ореол темноты и фиолетово-красного свечения
    this._shadowAura.fillStyle(0x7E22CE, 0.22) // фиолетовый туман
    this._shadowAura.fillCircle(sx, sy - 8, 55)
    this._shadowAura.fillStyle(0xDC2626, 0.28) // зловещий алый ореол
    this._shadowAura.fillCircle(sx + 8, sy - 12, 34)
    this._shadowAura.fillStyle(0x050010, 0.5)  // ядро тьмы
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
    if (!this._onGround) return

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

    // Эффект свечения
    this.tweens.add({
      targets:  this._malechka,
      tint:     0x00FFFF,
      duration: 200,
      yoyo: true,
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
    this.cameras.main.shake(250, 0.015)
    this.cameras.main.flash(200, 200, 30, 30, false)

    // Тень совершает резкий рывок вперёд!
    this._shadowDelta += 35

    // Игрок спотыкается и получает кратковременную защиту
    this._stumbleTimer = 1500
    this.tweens.add({
      targets: this._malechka,
      alpha: 0.4,
      tint: 0xFF4444,
      yoyo: true,
      repeat: 3,
      duration: 180,
      onComplete: () => {
        if (this._malechka && !this._dead) {
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
    if (coin._shine) coin._shine.destroy()
    coin.destroy()
    this._coins++
    this._hud.addCoins(1)
    this._hud.coinPopup(malechka.x, malechka.y - 30)
    GSM.addCoins(1)
    Audio.coin()

    // Сбор монет отталкивает тень назад!
    this._shadowDelta = Math.max(this._shadowDelta - 12, SHADOW_START - 20)
  }

  _onBooster(malechka, booster) {
    booster.destroy()
    this._activateBooster()

    // Бустер отталкивает тень далеко назад!
    this._shadowDelta = Math.max(this._shadowDelta - 45, SHADOW_START - 30)
  }

  // ──────────────────────────────────────────────────────────
  // СМЕРТЬ
  // ──────────────────────────────────────────────────────────
  _die() {
    if (this._dead) return
    this._dead = true
    this._state = 'DEAD'

    Audio.death()
    this.cameras.main.shake(400, 0.02)

    // Малечка падает
    this._malechka.setVelocityY(-300)
    this._malechka.setVelocityX(-100)
    this._malechka.setAngularVelocity(300)
    this._malechka.setTint(0xFF4444)

    this._joystick.setVisible(false)
    this._buttons.setVisible(false)

    this.time.delayedCall(1200, () => {
      this.cameras.main.fadeOut(400)
      this.time.delayedCall(400, () => {
        this.scene.start('DeathScene', {
          fromScene: 'Level1Scene',
          levelNum:  1,
          nextScene: 'LevelMapScene',
        })
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
    this.physics.add.existing(obs) // Динамическое тело
    obs.body.setAllowGravity(false)
    obs.body.setImmovable(true)
    obs.body.setVelocityX(-this._worldSpeed)
    // Честный щадящий хитбокс
    obs.body.setSize(template.w * 0.75, template.h * 0.75)
    this._obstacles.add(obs)

    // Переставляем таймер
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
    // Блеск монеты
    const shine = this.add.circle(W + 30 - 3, y - 3, 3, 0xFFFFAA)
    shine.setDepth(18)
    coin._shine = shine

    this.physics.add.existing(coin)
    coin.body.setAllowGravity(false)
    coin.body.setVelocityX(-this._worldSpeed)
    this._coins_group.add(coin)

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
    g.fillStar(0, 0, 5, 12, 6)  // звезда
    g.setPosition(W + 30, y).setDepth(17)

    this.physics.add.existing(g)
    g.body.setAllowGravity(false)
    g.body.setVelocityX(-this._worldSpeed)
    g.body.setSize(24, 24)
    this._boosters.add(g)

    // Пульсация
    this.tweens.add({ targets: g, scaleX: 1.25, scaleY: 1.25, duration: 400, yoyo: true, repeat: -1 })

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
    const bg = this.add.graphics().setDepth(302)
    bg.fillStyle(colorBg, 0.9)
    bg.fillRoundedRect(x - BW / 2, y - BH / 2, BW, BH, 8)
    bg.lineStyle(2, 0xffffff, 0.5)
    bg.strokeRoundedRect(x - BW / 2, y - BH / 2, BW, BH, 8)

    this.add.text(x, y, label, {
      fontFamily: 'Press Start 2P',
      fontSize:   '9px',
      color:      '#ffffff',
    }).setOrigin(0.5).setDepth(303)

    const zone = this.add.zone(x, y, BW, BH).setInteractive({ useHandCursor: true }).setDepth(304)
    zone.on('pointerdown', () => {
      Audio.uiClick()
      onClick()
    })
    zone.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(colorHov, 1)
      bg.fillRoundedRect(x - BW / 2, y - BH / 2, BW, BH, 8)
    })
    zone.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(colorBg, 0.9)
      bg.fillRoundedRect(x - BW / 2, y - BH / 2, BW, BH, 8)
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
  // ──────────────────────────────────────────────────────────
  _showDialogSequence(lines, onComplete) {
    let i = 0

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

    const showLine = () => {
      if (i >= lines.length) {
        box.destroy(); txt.destroy(); hint.destroy()
        onComplete?.()
        return
      }
      txt.setText(lines[i])
      Audio.dialogNext()
      i++
    }

    showLine()
    this.input.on('pointerdown', showLine)

    // Авто-очистка лиснера при уходе со сцены
    this.events.once('shutdown', () => this.input.off('pointerdown', showLine))
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

    // ── Скролл фона ───────────────────────────────────────
    this._cityBgX = (this._cityBgX + currentSpeed * 0.3 * dt) % (W + 200)
    this._roadX   = (this._roadX   + currentSpeed * 1.0 * dt) % 80
    this._drawCityBackground(this._cityBg, this._cityBgX)
    this._drawRoad(this._roadGraphics, this._roadX)

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

    // ── Препятствия и предметы: движение и очистка ────────
    // Используем slice() чтобы не мутировать массив во время итерации!
    const obstacles = this._obstacles.getChildren().slice()
    for (const obs of obstacles) {
      if (!obs.active) continue
      obs.body.setVelocityX(-currentSpeed)
      if (obs.x < -80) obs.destroy()
    }
    const coins = this._coins_group.getChildren().slice()
    for (const coin of coins) {
      if (!coin.active) continue
      coin.body.setVelocityX(-currentSpeed)
      if (coin._shine && coin._shine.active) coin._shine.setPosition(coin.x - 3, coin.y - 3)
      if (coin.x < -40) {
        if (coin._shine && coin._shine.active) coin._shine.destroy()
        coin.destroy()
      }
    }
    const boosters = this._boosters.getChildren().slice()
    for (const b of boosters) {
      if (!b.active) continue
      b.body.setVelocityX(-currentSpeed)
      if (b.x < -40) b.destroy()
    }

    // ── Прыжок (клавиатура Пробел / Вверх / W / джойстик вверх) ──
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
    // Тень плавно сокращает дистанцию
    const shadowGain = (currentSpeed * 0.015 + 1.2) * dt
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
    this._joystick?.destroy()
    this._buttons?.destroy()
    this._hud?.destroy()
    if (this._spawnTimer)     this._spawnTimer.remove()
    if (this._coinTimer)      this._coinTimer.remove()
    if (this._boostSpawnTimer) this._boostSpawnTimer.remove()
    if (this._ambientTimer)   this._ambientTimer.remove()
  }
}
