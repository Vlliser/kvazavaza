// ============================================================
// DeathScene.js — Экран поражения (смерти)
//
// «Ты можешь сдаться, но стоит ли?»
// Кнопки: ПОПРОБОВАТЬ СНОВА | ПРОПУСТИТЬ (за шакрукханы)
// ============================================================

import { DIALOGUES }  from '../dialogues.js'
import { GSM }        from '../GameStateManager.js'
import { Audio }      from '../audio/AudioManager.js'

const SKIP_COST = 20  // стоимость пропуска уровня в шакрукханах

export default class DeathScene extends Phaser.Scene {
  constructor() { super('DeathScene') }

  // ── init: принимаем данные от предыдущей сцены ───────────
  init(data) {
    this.fromScene  = data.fromScene  || 'Level1Scene'
    this.levelNum   = data.levelNum   || 1
    this.nextScene  = data.nextScene  || 'LevelMapScene'
  }

  // ── create ──────────────────────────────────────────────
  create() {
    const W = this.scale.width
    const H = this.scale.height

    Audio.death()

    // ── Тёмный фон с виньеткой ─────────────────────────
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x000000, 0x000000, 0x1A0520, 0x000000, 1)
    bg.fillRect(0, 0, W, H)

    // Красные частицы-капли (эффект смерти)
    this._spawnParticles(W, H)

    // ── Силуэт "Тени" сверху ────────────────────────────
    const shadow = this.add.graphics()
    shadow.fillStyle(0x000000, 0.8)
    shadow.fillRect(0, 0, W, H / 3)
    // Глаза тени
    shadow.fillStyle(0xFF0000, 0.9)
    shadow.fillCircle(W / 2 - 30, H / 6, 8)
    shadow.fillCircle(W / 2 + 30, H / 6, 8)
    shadow.fillStyle(0xFF4444, 0.5)
    shadow.fillCircle(W / 2 - 30, H / 6, 14)
    shadow.fillCircle(W / 2 + 30, H / 6, 14)

    // ── Основной текст ───────────────────────────────────
    const msg = this.add.text(W / 2, H * 0.46, DIALOGUES.death.message, {
      fontFamily: 'Press Start 2P',
      fontSize:   '13px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 5,
      align:      'center',
      wordWrap:   { width: W - 80 },
    }).setOrigin(0.5).setAlpha(0)

    // Анимация появления текста
    this.tweens.add({
      targets: msg, alpha: 1, duration: 800,
      ease: 'Power2', delay: 400,
    })

    // Трясём камеру при входе
    this.cameras.main.shake(600, 0.012)

    // ── Кнопки (появляются с задержкой) ─────────────────
    this.time.delayedCall(1200, () => this._createButtons(W, H))
  }

  // ── Кнопки действия ──────────────────────────────────────
  _createButtons(W, H) {
    const coins = GSM.get('shakarukhany') || 0
    const canSkip = coins >= SKIP_COST

    // ── ПОПРОБОВАТЬ СНОВА ────────────────────────────────
    const retryBtn = this._makeButton(
      W / 2, H * 0.65,
      DIALOGUES.death.retry,
      0x8E44AD, 0xA855F7,
      () => {
        Audio.uiClick()
        this.cameras.main.fadeOut(300)
        this.time.delayedCall(300, () => {
          this.scene.start(this.fromScene)
        })
      }
    )

    // ── ПРОПУСТИТЬ (за монеты) ───────────────────────────
    const skipLabel = DIALOGUES.death.skip(SKIP_COST)
    const skipColor = canSkip ? 0x1A6B3A : 0x333333
    const skipHover = canSkip ? 0x27AE60 : 0x333333

    const skipBtn = this._makeButton(
      W / 2, H * 0.80,
      skipLabel,
      skipColor, skipHover,
      async () => {
        if (!canSkip) {
          this._showMessage(DIALOGUES.death.notEnoughCoins, '#FF4444')
          return
        }
        Audio.uiClick()
        await GSM.spendCoins(SKIP_COST)
        this.cameras.main.fadeOut(300)
        this.time.delayedCall(300, () => {
          // Переходим на следующую сцену после пропуска
          this.scene.start(this.nextScene)
        })
      }
    )

    // Подпись о стоимости
    if (!canSkip) {
      this.add.text(W / 2, H * 0.80 + 28, `Нужно: ${SKIP_COST} ₪  |  У тебя: ${coins} ₪`, {
        fontFamily: 'VT323',
        fontSize:   '16px',
        color:      '#FF4444',
      }).setOrigin(0.5)
    }

    // Анимация появления кнопок
    ;[retryBtn, skipBtn].forEach((btn, i) => {
      btn.forEach(o => {
        o.setAlpha(0)
        this.tweens.add({ targets: o, alpha: 1, duration: 400, delay: i * 150 })
      })
    })
  }

  // ── Фабрика кнопки ───────────────────────────────────────
  _makeButton(x, y, label, colorNorm, colorHover, onClick) {
    const W = 280
    const H = 36

    const bg = this.add.graphics()
    bg.fillStyle(colorNorm, 0.85)
    bg.fillRoundedRect(x - W / 2, y - H / 2, W, H, 6)
    bg.lineStyle(2, 0xffffff, 0.4)
    bg.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 6)

    const txt = this.add.text(x, y, label, {
      fontFamily: 'Press Start 2P',
      fontSize:   '9px',
      color:      '#ffffff',
      align:      'center',
    }).setOrigin(0.5)

    const zone = this.add.zone(x, y, W, H).setInteractive({ useHandCursor: true })
    zone.on('pointerdown', onClick)
    zone.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(colorHover, 0.95)
      bg.fillRoundedRect(x - W / 2, y - H / 2, W, H, 6)
      bg.lineStyle(2, 0xffffff, 0.7)
      bg.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 6)
    })
    zone.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(colorNorm, 0.85)
      bg.fillRoundedRect(x - W / 2, y - H / 2, W, H, 6)
      bg.lineStyle(2, 0xffffff, 0.4)
      bg.strokeRoundedRect(x - W / 2, y - H / 2, W, H, 6)
    })

    return [bg, txt, zone]
  }

  // ── Сообщение (ошибка/инфо) ──────────────────────────────
  _showMessage(text, color = '#ffffff') {
    const W = this.scale.width
    const H = this.scale.height
    const msg = this.add.text(W / 2, H * 0.92, text, {
      fontFamily: 'Press Start 2P',
      fontSize:   '8px',
      color,
    }).setOrigin(0.5)
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
      const dot = this.add.rectangle(x, y, size, size, 0x8E44AD, 0.6)

      this.tweens.add({
        targets:  dot,
        y:        y - Phaser.Math.Between(50, 200),
        alpha:    0,
        duration: Phaser.Math.Between(1000, 3000),
        delay:    Phaser.Math.Between(0, 800),
        repeat:   -1,
        onRepeat: () => {
          dot.x = Phaser.Math.Between(0, W)
          dot.y = y
          dot.alpha = 0.6
        },
      })
    }
  }
}
