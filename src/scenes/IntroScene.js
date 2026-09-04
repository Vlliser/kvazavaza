// ============================================================
// IntroScene.js — Анимация-заставка в стиле Marvel
//
// ЗАГЛУШКА: когда будет готов intro.mp4 — замени содержимое
// метода showVideoIntro() на <video> элемент.
//
// Сейчас реализовано через Phaser:
// 1. Фаза 1: Быстрые вспышки "комикс-панелей" (как Marvel)
// 2. Фаза 2: Появление логотипа KVAZAVAZA с эффектами
// 3. Тап в любое место = пропустить
// ============================================================

import DIALOGUES from '../dialogues.js'

// Цвета "комикс-панелей" для фазы вспышек
const PANEL_COLORS = [
  0xffffff, 0xf5c518, 0xff6b35, 0x4ecdc4,
  0xff1744, 0x9c27b0, 0x2196f3, 0xff9800,
  0x00bcd4, 0xe91e63,
]

class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' })
    this._skipped = false
  }

  // ────────────────────────────────────────────
  create(data) {
    this._skipped = false
    const { width, height } = this.cameras.main

    // Чёрный фон
    this.bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000)
      .setDepth(0)

    // "Панель" для вспышек
    this.panel = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(1)

    // Текст на панели
    this.panelText = this.add
      .text(width / 2, height / 2, '', {
        fontFamily: '"Press Start 2P"',
        fontSize:   '26px',
        color:      '#000000',
        align:      'center',
        wordWrap:   { width: width - 40 },
      })
      .setOrigin(0.5)
      .setDepth(2)

    // "Тап, чтобы пропустить" — мигает снизу
    this.skipText = this.add
      .text(width / 2, height - 50, DIALOGUES.system.tapToSkip, {
        fontFamily: '"Press Start 2P"',
        fontSize:   '10px',
        color:      '#ffffff',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(10)

    // Fade-in для текста "пропустить"
    this.time.delayedCall(800, () => {
      this.tweens.add({
        targets:  this.skipText,
        alpha:    0.7,
        duration: 400,
      })
    })

    // ── Невидимая кнопка "ПРОПУСТИТЬ" на весь экран
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive({ cursor: 'pointer' })
      .setDepth(9)
      .on('pointerdown', () => this.skipIntro())

    // ── Запускаем анимацию
    this.runMarvelAnimation()
  }

  // ────────────────────────────────────────────
  // ФАЗА 1: Быстрые вспышки комикс-панелей
  // ────────────────────────────────────────────
  runMarvelAnimation() {
    const FLASH_COUNT  = 22  // кол-во вспышек
    const FLASH_DELAY  = 75  // ms между вспышками

    let count = 0

    this.flashTimer = this.time.addEvent({
      delay:    FLASH_DELAY,
      repeat:   FLASH_COUNT - 1,
      callback: () => {
        if (this._skipped) return
        count++

        const color = PANEL_COLORS[count % PANEL_COLORS.length]
        this.panel.setFillStyle(color, 1)

        // Каждые 3 вспышки показываем текст
        if (count % 3 === 0 && count < FLASH_COUNT - 3) {
          this.panelText.setText('KVAZAVAZA')
          this.panelText.setColor(count % 6 === 0 ? '#000000' : '#ffffff')
          // Случайный поворот для динамики
          this.panelText.setAngle(Phaser.Math.Between(-5, 5))
        } else {
          this.panelText.setText('')
        }

        // Последние 2 вспышки — гасим
        if (count >= FLASH_COUNT - 2) {
          this.panel.setFillStyle(0x000000, 1)
          this.panelText.setText('')
          this.panelText.setAngle(0)
        }
      },
      callbackScope: this,
    })

    // После вспышек — показываем логотип
    this.time.delayedCall(FLASH_COUNT * FLASH_DELAY + 300, () => {
      if (!this._skipped) this.showLogo()
    })
  }

  // ────────────────────────────────────────────
  // ФАЗА 2: Логотип KVAZAVAZA
  // ────────────────────────────────────────────
  showLogo() {
    const { width, height } = this.cameras.main

    // Гасим панель
    this.panel.setFillStyle(0x000000, 0)

    // ── Фиолетовый glow-фон (несколько прямоугольников)
    this.createGlowBackground(width, height)

    // ── Основной заголовок
    const title = this.add
      .text(width / 2, height / 2 - 60, 'KVAZAVAZA', {
        fontFamily: '"Press Start 2P"',
        fontSize:   '28px',
        color:      '#FF80FF',
        stroke:     '#4A0E8F',
        strokeThickness: 6,
        shadow: {
          offsetX: 0,
          offsetY: 0,
          color:   '#E040FB',
          blur:    30,
          fill:    true,
        },
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(5)

    // ── Подзаголовок
    const subtitle = this.add
      .text(width / 2, height / 2 + 20, 'Пиксельное приключение\nна Годовщину', {
        fontFamily: 'VT323',
        fontSize:   '32px',
        color:      '#CE93D8',
        align:      'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(5)

    // ── Сердечко снизу
    const heart = this.add
      .text(width / 2, height / 2 + 110, '💜', {
        fontSize: '40px',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(5)

    // ── Анимация появления
    this.tweens.add({
      targets:  title,
      alpha:    1,
      y:        height / 2 - 70,
      duration: 900,
      ease:     'Power3',
      onComplete: () => {
        // Пульсация заголовка
        this.tweens.add({
          targets:  title,
          scaleX:   1.04,
          scaleY:   1.04,
          duration: 1200,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        })

        // Появление подзаголовка
        this.tweens.add({
          targets:  subtitle,
          alpha:    1,
          y:        height / 2 + 10,
          duration: 700,
          ease:     'Power2',
          delay:    200,
        })

        // Появление сердца
        this.tweens.add({
          targets:  heart,
          alpha:    1,
          scaleX:   1.2,
          scaleY:   1.2,
          duration: 500,
          delay:    700,
          yoyo:     true,
          onComplete: () => {
            this.tweens.add({
              targets:  heart,
              alpha:    { from: 0.6, to: 1 },
              duration: 800,
              yoyo:     true,
              repeat:   -1,
            })
          },
        })
      },
    })

    // ── Звёзды-частицы
    this.spawnStars(width, height)

    // ── Автопереход через 4 секунды
    this.time.delayedCall(4000, () => {
      if (!this._skipped) this.transitionToMenu()
    })
  }

  // ────────────────────────────────────────────
  // Фиолетовый glow-фон из прямоугольников
  // ────────────────────────────────────────────
  createGlowBackground(width, height) {
    // Центральное свечение (несколько полупрозрачных кругов)
    const glowLayers = [
      { size: 320, alpha: 0.08 },
      { size: 220, alpha: 0.12 },
      { size: 140, alpha: 0.18 },
    ]

    glowLayers.forEach(({ size, alpha }) => {
      this.add
        .rectangle(width / 2, height / 2, size, size, 0x9c27b0, alpha)
        .setDepth(3)
    })
  }

  // ────────────────────────────────────────────
  // Анимированные пиксельные звёзды
  // ────────────────────────────────────────────
  spawnStars(width, height) {
    for (let i = 0; i < 25; i++) {
      const x    = Phaser.Math.Between(10, width - 10)
      const y    = Phaser.Math.Between(10, height - 10)
      const size = Phaser.Math.Between(2, 5)

      const star = this.add
        .rectangle(x, y, size, size, 0xe040fb, 0)
        .setDepth(4)

      this.time.delayedCall(Phaser.Math.Between(0, 2000), () => {
        this.tweens.add({
          targets:  star,
          alpha:    { from: 0, to: Phaser.Math.FloatBetween(0.5, 1) },
          duration: Phaser.Math.Between(400, 900),
          yoyo:     true,
          repeat:   -1,
          delay:    Phaser.Math.Between(0, 500),
          ease:     'Sine.easeInOut',
        })
      })
    }
  }

  // ────────────────────────────────────────────
  // Пропуск интро (тап)
  // ────────────────────────────────────────────
  skipIntro() {
    if (this._skipped) return
    this._skipped = true

    if (this.flashTimer) this.flashTimer.remove()

    this.transitionToMenu()
  }

  // ────────────────────────────────────────────
  // Плавный переход в главное меню
  // ────────────────────────────────────────────
  transitionToMenu() {
    if (this._transitioning) return
    this._transitioning = true

    this.cameras.main.fade(700, 0, 0, 0)
    this.time.delayedCall(700, () => {
      this.scene.start('MainMenuScene')
    })
  }
}

export default IntroScene

// ============================================================
// КАК ЗАМЕНИТЬ НА НАСТОЯЩЕЕ ВИДЕО (mp4):
//
// 1. Положи файл intro.mp4 в папку public/
// 2. В методе create() удали вызов this.runMarvelAnimation()
// 3. Добавь вместо него:
//
//    const video = document.createElement('video')
//    video.src = '/intro.mp4'
//    video.autoplay = true
//    video.muted = true          // Обязательно для autoplay
//    video.playsInline = true    // Обязательно для iOS
//    video.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:999'
//    document.body.appendChild(video)
//    video.play()
//    video.onended = () => {
//      document.body.removeChild(video)
//      this.transitionToMenu()
//    }
//    // "Тап для пропуска" уже есть выше — просто удали video
//
// ============================================================
