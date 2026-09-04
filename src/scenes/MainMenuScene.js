// ============================================================
// MainMenuScene.js — Главное меню (ЗАГЛУШКА для Блока 1)
//
// Полная реализация с джойстиком, Картой уровней и
// системой жизней будет в Блоке 2.
//
// Сейчас реализовано:
// - Анимированный фон (звёздное небо из прямоугольников)
// - Логотип с эффектом свечения
// - Кнопки: Продолжить / Новая игра / Настройки
// - Определение: показывать ли "Продолжить"
// ============================================================

import { DIALOGUES } from '../dialogues.js'
import { hasSavedGame, loadGameState, DEFAULT_GAME_STATE, saveGameState } from '../supabase.js'
import { GSM } from '../GameStateManager.js'
import { Audio } from '../audio/AudioManager.js'

// ── Цветовая палитра (тёмная фиолетовая тема)
const COLORS = {
  bg:          0x1a0a2e,  // тёмный фон
  bgTop:       0x2c1654,  // верх градиента
  accent:      0xe040fb,  // фиолетовый акцент
  accentDark:  0x7b1fa2,
  btnFill:     0x4a0e8f,  // кнопка (нормальная)
  btnHover:    0x7c43bd,  // кнопка (при нажатии)
  btnBorder:   0xe040fb,
  textMain:    '#FF80FF',
  textSub:     '#CE93D8',
  textBtn:     '#ffffff',
  star:        0xce93d8,
}

class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' })
  }

  // ────────────────────────────────────────────
  create() {
    const { width, height } = this.cameras.main
    this.W = width
    this.H = height

    // Загружаем состояние игры
    this._savedGame = hasSavedGame()

    // Строим сцену
    this.createBackground()
    this.createStars()
    this.createLogo()
    this.createButtons()
    this.createKuzya()
    this.createVersion()

    // Камера появляется плавно
    this.cameras.main.fadeIn(600, 0, 0, 0)
  }

  // ────────────────────────────────────────────
  // Фон: двухцветный вертикальный градиент через Phaser Graphics
  // ────────────────────────────────────────────
  createBackground() {
    const { W, H } = this
    const STEPS = 40

    for (let i = 0; i < STEPS; i++) {
      const t      = i / STEPS
      const r      = Math.round(Phaser.Math.Linear(0x2c, 0x0d, t))
      const g      = Math.round(Phaser.Math.Linear(0x16, 0x00, t))
      const b      = Math.round(Phaser.Math.Linear(0x54, 0x18, t))
      const color  = (r << 16) | (g << 8) | b
      const sliceH = Math.ceil(H / STEPS)
      const y      = i * sliceH

      this.add.rectangle(W / 2, y + sliceH / 2, W, sliceH + 1, color).setDepth(0)
    }
  }

  // ────────────────────────────────────────────
  // Анимированные звёзды (пиксельные прямоугольники)
  // ────────────────────────────────────────────
  createStars() {
    const { W, H } = this

    for (let i = 0; i < 60; i++) {
      const x    = Phaser.Math.Between(5, W - 5)
      const y    = Phaser.Math.Between(5, H - 5)
      const size = Phaser.Math.Between(1, 3)
      const alpha = Phaser.Math.FloatBetween(0.2, 0.8)

      const star = this.add
        .rectangle(x, y, size, size, COLORS.star, alpha)
        .setDepth(1)

      // Мигание
      this.tweens.add({
        targets:  star,
        alpha:    { from: alpha * 0.2, to: alpha },
        duration: Phaser.Math.Between(1000, 3000),
        yoyo:     true,
        repeat:   -1,
        delay:    Phaser.Math.Between(0, 2000),
        ease:     'Sine.easeInOut',
      })
    }
  }

  // ────────────────────────────────────────────
  // Логотип KVAZAVAZA
  // ────────────────────────────────────────────
  createLogo() {
    const { W, H } = this

    // Верхняя секция — 35% экрана
    const centerY = H * 0.22

    // Свечение под заголовком
    this.add
      .rectangle(W / 2, centerY, 340, 70, 0x9c27b0, 0.15)
      .setDepth(2)

    // Заголовок
    const title = this.add
      .text(W / 2, centerY - 10, DIALOGUES.mainMenu.title, {
        fontFamily: '"Press Start 2P"',
        fontSize:   '26px',
        color:      COLORS.textMain,
        stroke:     '#4A0E8F',
        strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 0, color: '#E040FB', blur: 20, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(3)

    // Подзаголовок
    this.add
      .text(W / 2, centerY + 44, DIALOGUES.mainMenu.subtitle, {
        fontFamily: 'VT323',
        fontSize:   '24px',
        color:      COLORS.textSub,
        align:      'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(3)

    // Пульсация заголовка
    this.tweens.add({
      targets:  title,
      scaleX:   1.03,
      scaleY:   1.03,
      duration: 1800,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })
  }

  // ────────────────────────────────────────────
  // Кнопки меню
  // ────────────────────────────────────────────
  createButtons() {
    const { W, H } = this
    const BTN_W = 270
    const BTN_H = 50
    const GAP   = 22

    // Определяем набор кнопок
    const buttons = []

    // "Продолжить" — только если есть сохранение
    if (this._savedGame) {
      buttons.push({
        label:    DIALOGUES.mainMenu.continueGame,
        callback: () => this.onContinue(),
      })
    }

    buttons.push(
      { label: DIALOGUES.mainMenu.newGame, callback: () => this.onNewGame() },
      { label: DIALOGUES.mainMenu.settings, callback: () => this.onSettings() }
    )

    // Центрируем блок кнопок по вертикали
    const totalH = buttons.length * BTN_H + (buttons.length - 1) * GAP
    let startY   = H * 0.58 - totalH / 2

    buttons.forEach(({ label, callback }) => {
      this.createButton(W / 2, startY + BTN_H / 2, BTN_W, BTN_H, label, callback)
      startY += BTN_H + GAP
    })
  }

  // ── Фабрика одной кнопки
  createButton(x, y, w, h, label, callback) {
    const container = this.add.container(x, y).setDepth(5)

    // Тень (смещение вниз-вправо)
    const shadow = this.add
      .rectangle(3, 3, w, h, 0x000000, 0.4)

    // Основная заливка
    const bg = this.add
      .rectangle(0, 0, w, h, COLORS.btnFill)

    // Рамка (сверху и снизу)
    const border = this.add.graphics()
    border.lineStyle(2, COLORS.btnBorder, 1)
    border.strokeRect(-w / 2, -h / 2, w, h)

    // Маленькие пиксельные уголки
    const corner = this.add.graphics()
    corner.fillStyle(COLORS.btnBorder, 1)
    const cs = 4
    ;[[-w / 2, -h / 2], [w / 2 - cs, -h / 2], [-w / 2, h / 2 - cs], [w / 2 - cs, h / 2 - cs]].forEach(
      ([cx, cy]) => corner.fillRect(cx, cy, cs, cs)
    )

    // Текст кнопки
    const text = this.add
      .text(0, 0, label, {
        fontFamily: '"Press Start 2P"',
        fontSize:   '11px',
        color:      COLORS.textBtn,
      })
      .setOrigin(0.5)

    container.add([shadow, bg, border, corner, text])

    // Интерактивность
    bg.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains
    )

    bg.on('pointerover', () => {
      bg.setFillStyle(COLORS.btnHover)
      text.setColor('#FFD6FF')
      this.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 120 })
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(COLORS.btnFill)
      text.setColor(COLORS.textBtn)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 })
    })

    bg.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.96, scaleY: 0.96, duration: 80, yoyo: true })
    })

    bg.on('pointerup', () => {
      callback()
    })

    return container
  }

  // ────────────────────────────────────────────
  // Кузя в углу (пиксельная кошка-заглушка)
  // ────────────────────────────────────────────
  createKuzya() {
    const { W, H } = this
    const x = W - 60
    const y = H - 80

    // Тело кошки из прямоугольников (placeholder)
    const g = this.add.graphics().setDepth(4)

    // Тело
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(x - 18, y - 20, 36, 30)
    // Голова
    g.fillRect(x - 14, y - 40, 28, 24)
    // Уши
    g.fillTriangle(x - 14, y - 40, x - 6, y - 55, x + 2, y - 40)
    g.fillTriangle(x + 14, y - 40, x + 6, y - 55, x - 2, y - 40)
    // Глаза (фиолетовые)
    g.fillStyle(0x9c27b0, 1)
    g.fillRect(x - 8, y - 32, 5, 5)
    g.fillRect(x + 3, y - 32, 5, 5)
    // Нос
    g.fillStyle(0xff80ab, 1)
    g.fillRect(x - 1, y - 24, 3, 2)
    // Хвост
    g.fillStyle(0xffffff, 0.9)
    g.fillRect(x + 14, y, 6, 20)
    g.fillRect(x + 8, y + 18, 14, 6)

    // Мягкая вертикальная пульсация (дыхание)
    this.tweens.add({
      targets:  g,
      y:        '-=4',
      duration: 1200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })

    // Реплика Кузи
    const quotes = DIALOGUES.levelMap.kuzya
    const quote  = quotes[Phaser.Math.Between(0, quotes.length - 1)]

    const bubble = this.add
      .text(x - 30, y - 70, quote, {
        fontFamily: 'VT323',
        fontSize:   '18px',
        color:      '#ffffff',
        backgroundColor: '#2c1654dd',
        padding:    { x: 8, y: 4 },
        wordWrap:   { width: 160 },
        align:      'right',
      })
      .setOrigin(1, 1)
      .setAlpha(0)
      .setDepth(6)

    // Появление реплики через 2 сек
    this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: bubble, alpha: 1, duration: 400 })
      // Пропадает через 4 сек
      this.time.delayedCall(4000, () => {
        this.tweens.add({ targets: bubble, alpha: 0, duration: 600 })
      })
    })
  }

  // ────────────────────────────────────────────
  // Версия игры (маленький текст снизу слева)
  // ────────────────────────────────────────────
  createVersion() {
    this.add
      .text(10, this.H - 16, 'v0.2.0 • БЛОК 2', {
        fontFamily: 'VT323',
        fontSize:   '16px',
        color:      '#6a4f8c',
      })
      .setDepth(4)
  }

  // ────────────────────────────────────────────
  // ДЕЙСТВИЯ КНОПОК
  // ────────────────────────────────────────────
  async onContinue() {
    Audio.uiClick()
    this.fadeToScene('LevelMapScene')
  }

  onNewGame() {
    if (this._savedGame) {
      // TODO Блок 2: диалог подтверждения
      this.showConfirmNewGame()
    } else {
      this.startNewGame()
    }
  }

  async startNewGame() {
    await GSM.reset()
    this.fadeToScene('Level1Scene')
  }

  showConfirmNewGame() {
    const { W, H } = this

    // Затемнение
    const overlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.7)
      .setDepth(20)
      .setInteractive()

    // Диалог
    const dialog = this.add.container(W / 2, H / 2).setDepth(21)

    const dialogBg = this.add.rectangle(0, 0, 280, 160, 0x2c1654)
    const dialogBorder = this.add.graphics()
    dialogBorder.lineStyle(2, 0xe040fb, 1)
    dialogBorder.strokeRect(-140, -80, 280, 160)

    const msg = this.add
      .text(0, -30, DIALOGUES.mainMenu.newGameConfirm, {
        fontFamily: '"Press Start 2P"',
        fontSize:   '9px',
        color:      '#ffffff',
        align:      'center',
        wordWrap:   { width: 240 },
        lineSpacing: 8,
      })
      .setOrigin(0.5)

    dialog.add([dialogBg, dialogBorder, msg])

    // Кнопка "ДА"
    this.createButton(W / 2 - 70, H / 2 + 45, 100, 36, DIALOGUES.mainMenu.yes, () => {
      overlay.destroy()
      dialog.destroy()
      this.startNewGame()
    })

    // Кнопка "НЕТ"
    this.createButton(W / 2 + 70, H / 2 + 45, 100, 36, DIALOGUES.mainMenu.no, () => {
      overlay.destroy()
      dialog.destroy()
    })
  }

  onSettings() {
    Audio.uiClick()
    this.scene.start('SettingsScene', { from: 'MainMenuScene' })
  }

  // ────────────────────────────────────────────
  // Плавный переход на другую сцену
  // ────────────────────────────────────────────
  fadeToScene(sceneKey) {
    this.cameras.main.fade(500, 0, 0, 0)
    this.time.delayedCall(500, () => {
      this.scene.start(sceneKey)
    })
  }
}

export default MainMenuScene
