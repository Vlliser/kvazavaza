// ============================================================
// DeathScene.js — Экран поражения (смерти)
//
// «Ты можешь сдаться, но стоит ли?»
// Кнопки: ПОПРОБОВАТЬ СНОВА | ПРОПУСТИТЬ | НА КАРТУ
// ============================================================

import { DIALOGUES }  from '../dialogues.js'
import { GSM }        from '../GameStateManager.js'
import { Audio }      from '../audio/AudioManager.js'

const SKIP_COST = 20  // стоимость пропуска уровня в шакрукханах

export default class DeathScene extends Phaser.Scene {
  constructor() { super('DeathScene') }

  // ── init: принимаем данные от предыдущей сцены ───────────
  init(data) {
    this.fromScene  = data?.fromScene  || 'Level1Scene'
    this.levelNum   = data?.levelNum   || 1
    this.nextScene  = data?.nextScene  || 'LevelMapScene'
  }

  // ── create ──────────────────────────────────────────────
  create() {
    const W = this.scale.width
    const H = this.scale.height

    Audio.death()

    // ── Плавное появление экрана смерти ────────────────
    this.cameras.main.fadeIn(300)
    this.cameras.main.shake(400, 0.012)

    // ── Тёмный фон с виньеткой ─────────────────────────
    const bg = this.add.graphics().setDepth(1)
    bg.fillGradientStyle(0x05000A, 0x05000A, 0x1A0520, 0x0A0012, 1)
    bg.fillRect(0, 0, W, H)

    // Красные частицы-капли (эффект смерти)
    this._spawnParticles(W, H)

    // ── Силуэт "Тени" сверху ────────────────────────────
    const shadow = this.add.graphics().setDepth(2)
    shadow.fillStyle(0x000000, 0.85)
    shadow.fillRect(0, 0, W, H / 3)
    // Глаза тени
    shadow.fillStyle(0xFF0000, 0.9)
    shadow.fillCircle(W / 2 - 30, H / 6, 8)
    shadow.fillCircle(W / 2 + 30, H / 6, 8)
    shadow.fillStyle(0xFF4444, 0.5)
    shadow.fillCircle(W / 2 - 30, H / 6, 14)
    shadow.fillCircle(W / 2 + 30, H / 6, 14)

    // ── Основной текст ───────────────────────────────────
    const msg = this.add.text(W / 2, H * 0.44, DIALOGUES.death.message, {
      fontFamily: 'Press Start 2P',
      fontSize:   '13px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 5,
      align:      'center',
      wordWrap:   { width: W - 80 },
    }).setOrigin(0.5).setDepth(10)

    this.tweens.add({
      targets: msg,
      alpha:   { from: 0, to: 1 },
      duration: 350,
      ease: 'Power2',
    })

    // ── Кнопки (появляются сразу, с плавной анимацией) ──
    this._createButtons(W, H)
  }

  // ── Кнопки действия ──────────────────────────────────────
  _createButtons(W, H) {
    const coins = GSM.get('shakarukhany') || 0
    const canSkip = coins >= SKIP_COST

    // ── ПОПРОБОВАТЬ СНОВА ────────────────────────────────
    const retryBtn = this._makeButton(
      W / 2, H * 0.62,
      DIALOGUES.death.retry,
      0x8E44AD, 0x9B59B6,
      () => {
        Audio.uiClick()
        this.cameras.main.fadeOut(250)
        this.time.delayedCall(250, () => {
          this.scene.start(this.fromScene, { isRetry: true })
        })
      }
    )

    // ── ПРОПУСТИТЬ (за монеты) ───────────────────────────
    const skipLabel = DIALOGUES.death.skip(SKIP_COST)
    const skipColor = canSkip ? 0x1A6B3A : 0x2A2A3A
    const skipHover = canSkip ? 0x27AE60 : 0x3A3A4A

    const skipBtn = this._makeButton(
      W / 2, H * 0.75,
      skipLabel,
      skipColor, skipHover,
      async () => {
        if (!canSkip) {
          this._showMessage(DIALOGUES.death.notEnoughCoins, '#FF5555')
          return
        }
        Audio.uiClick()
        await GSM.spendCoins(SKIP_COST)
        this.cameras.main.fadeOut(250)
        this.time.delayedCall(250, () => {
          this.scene.start(this.nextScene)
        })
      }
    )

    // ── ВЕРНУТЬСЯ НА КАРТУ ───────────────────────────────
    const mapBtn = this._makeButton(
      W / 2, H * 0.88,
      '◀ НА КАРТУ',
      0x1E1035, 0x331855,
      () => {
        Audio.uiClick()
        this.cameras.main.fadeOut(250)
        this.time.delayedCall(250, () => {
          this.scene.start('LevelMapScene')
        })
      }
    )

    // Подпись о стоимости
    if (!canSkip) {
      this.add.text(W / 2, H * 0.75 + 24, `Нужно: ${SKIP_COST} ₪  |  У тебя: ${coins} ₪`, {
        fontFamily: 'VT323',
        fontSize:   '15px',
        color:      '#FF7777',
      }).setOrigin(0.5).setDepth(20)
    }

    // Быстрое и плавное появление кнопок
    ;[retryBtn, skipBtn, mapBtn].forEach((btn, i) => {
      btn.setAlpha(0)
      this.tweens.add({
        targets:  btn,
        alpha:    1,
        duration: 250,
        delay:    i * 60,
      })
    })

    // Текстовая подсказка внизу экрана для мобильных
    const bottomHint = this.add.text(W / 2, H - 18, '— Тапни по кнопке или экрану для ретрая —', {
      fontFamily: 'VT323',
      fontSize:   '16px',
      color:      '#9B59B6',
    }).setOrigin(0.5).setDepth(20)
    this.tweens.add({ targets: bottomHint, alpha: 0.4, duration: 800, yoyo: true, repeat: -1 })

    // Горячие клавиши: Пробел или Enter для быстрого ретрая
    this.input.keyboard?.once('keydown-SPACE', () => {
      retryBtn.emit('pointerdown')
    })
    this.input.keyboard?.once('keydown-ENTER', () => {
      retryBtn.emit('pointerdown')
    })
  }

  // ── Фабрика надёжной кнопки (Container + Rectangle HitArea) ─
  _makeButton(x, y, label, colorNorm, colorHover, onClick) {
    const W = 300
    const H = 40

    const container = this.add.container(x, y).setDepth(20)

    // Фоновый прямоугольник
    const bg = this.add.rectangle(0, 0, W, H, colorNorm, 0.9)

    // Рамка кнопки
    const border = this.add.graphics()
    border.lineStyle(2, 0xffffff, 0.4)
    border.strokeRoundedRect(-W / 2, -H / 2, W, H, 6)

    // Текст
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Press Start 2P',
      fontSize:   '10px',
      color:      '#ffffff',
      align:      'center',
    }).setOrigin(0.5)

    container.add([bg, border, txt])
    container.setSize(W, H)

    // Точный центрированный хитбокс от -W/2 до +W/2
    const hitRect = new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H)
    container.setInteractive(hitRect, Phaser.Geom.Rectangle.Contains)

    let clicked = false
    const trigger = () => {
      if (clicked) return
      clicked = true
      bg.setFillStyle(colorHover, 1)
      this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: 60, yoyo: true })
      onClick()
    }

    container.on('pointerdown', trigger)

    // Также делаем сам прямоугольник фона интерактивным для 100% надёжности
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', trigger)

    container.on('pointerover', () => {
      bg.setFillStyle(colorHover, 1)
      border.clear()
      border.lineStyle(2, 0xffffff, 0.85)
      border.strokeRoundedRect(-W / 2, -H / 2, W, H, 6)
      this.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 80 })
    })

    container.on('pointerout', () => {
      bg.setFillStyle(colorNorm, 0.9)
      border.clear()
      border.lineStyle(2, 0xffffff, 0.4)
      border.strokeRoundedRect(-W / 2, -H / 2, W, H, 6)
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80 })
    })

    return container
  }

  // ── Сообщение (ошибка/инфо) ──────────────────────────────
  _showMessage(text, color = '#ffffff') {
    const W = this.scale.width
    const H = this.scale.height
    const msg = this.add.text(W / 2, H * 0.96, text, {
      fontFamily: 'Press Start 2P',
      fontSize:   '8px',
      color,
    }).setOrigin(0.5).setDepth(25)
    this.tweens.add({
      targets: msg, alpha: 0, duration: 1500,
      delay: 1000, onComplete: () => msg.destroy(),
    })
  }

  // ── Частицы смерти ───────────────────────────────────────
  _spawnParticles(W, H) {
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, W)
      const y = Phaser.Math.Between(H / 3, H)
      const size = Phaser.Math.Between(2, 5)
      const dot = this.add.rectangle(x, y, size, size, 0x8E44AD, 0.6).setDepth(3)

      this.tweens.add({
        targets:  dot,
        y:        y - Phaser.Math.Between(50, 200),
        alpha:    0,
        duration: Phaser.Math.Between(1000, 3000),
        delay:    Phaser.Math.Between(0, 800),
        repeat:   -1,
        onRepeat: () => {
          if (dot?.active) {
            dot.x = Phaser.Math.Between(0, W)
            dot.y = y
            dot.alpha = 0.6
          }
        },
      })
    }
  }

  // ── SHUTDOWN: очистка всех таймеров и твинов ─────────────
  shutdown() {
    this.tweens.killAll()
    this.time.removeAllEvents()
  }
}
