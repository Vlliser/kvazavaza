// ============================================================
// HUD.js — Игровой интерфейс (Heads-Up Display)
//
// Отображает: ♥ (1 жизнь хардкор) + шакрукханы (₪) + дистанцию
// Прозрачная полоса поверх игры.
// ============================================================

import { GSM } from '../GameStateManager.js'

export class HUD {
  /**
   * @param {Phaser.Scene} scene
   */
  constructor(scene) {
    this.scene = scene
    this._coins = GSM.get('shakarukhany') || 0
    this._hp    = 1   // хардкор: всегда 1
    this._dist  = 0   // дистанция в метрах (для уровня 1)
    this._shadowWarn = false

    this._create()
  }

  _create() {
    const scene = this.scene
    const DEPTH = 200

    // ── Полупрозрачная полоса сверху ─────────────────────
    this.bg = scene.add.graphics()
    this.bg.fillStyle(0x000000, 0.45)
    this.bg.fillRect(0, 0, scene.scale.width, 34)
    this.bg.setDepth(DEPTH)
    this.bg.setScrollFactor(0)

    // ── Сердечко (жизнь) ─────────────────────────────────
    this.heartGraphic = scene.add.graphics()
    this.heartGraphic.setDepth(DEPTH + 1)
    this.heartGraphic.setScrollFactor(0)
    this._drawHeart(10, 17, true)

    // ── Счётчик шакрукханов ─────────────────────────────
    this.coinsText = scene.add.text(38, 6, `₪ ${this._coins}`, {
      fontFamily: 'Press Start 2P',
      fontSize:   '10px',
      color:      '#F1C40F',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setDepth(DEPTH + 1).setScrollFactor(0)

    // ── Дистанция (центр) ────────────────────────────────
    const cx = scene.scale.width / 2
    this.distText = scene.add.text(cx, 6, '', {
      fontFamily: 'Press Start 2P',
      fontSize:   '8px',
      color:      '#AAAAAA',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(DEPTH + 1).setScrollFactor(0)

    // ── Индикатор опасности (тень близко!) ──────────────
    this.dangerBar = scene.add.graphics()
    this.dangerBar.setDepth(DEPTH + 1)
    this.dangerBar.setScrollFactor(0)
    this.dangerBar.setVisible(false)

    this.dangerText = scene.add.text(scene.scale.width - 8, 17, '⚠ ТЕНЬ БЛИЗКО!', {
      fontFamily: 'Press Start 2P',
      fontSize:   '7px',
      color:      '#FF4444',
      stroke:     '#000000',
      strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(DEPTH + 2).setScrollFactor(0).setVisible(false)

    // Мигание опасности
    this._dangerTween = null
  }

  // ── Нарисовать пиксельное сердечко ───────────────────────
  _drawHeart(x, y, filled) {
    this.heartGraphic.clear()
    const color = filled ? 0xFF4444 : 0x444444
    const s = 3  // размер пикселя

    // Пиксельная форма сердца (7×6 пикселей)
    const pixels = [
      [1,0],[2,0],[4,0],[5,0],
      [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
      [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],
      [1,3],[2,3],[3,3],[4,3],[5,3],
      [2,4],[3,4],[4,4],
      [3,5],
    ]

    this.heartGraphic.fillStyle(color, 1)
    for (const [px, py] of pixels) {
      this.heartGraphic.fillRect(x + px * s, y - 3 * s + py * s, s, s)
    }
  }

  // ── Обновить счётчик монет ────────────────────────────────
  setCoins(n) {
    this._coins = n
    this.coinsText.setText(`₪ ${n}`)
  }

  addCoins(n) { this.setCoins(this._coins + n) }

  // ── Обновить дистанцию ────────────────────────────────────
  setDistance(meters) {
    this._dist = meters
    this.distText.setText(`${meters}м`)
  }

  // ── Показать/скрыть предупреждение тени ──────────────────
  setShadowWarning(active) {
    if (active === this._shadowWarn) return
    this._shadowWarn = active

    this.dangerText.setVisible(active)

    if (active) {
      // Мигаем красной полосой
      this._dangerTween = this.scene.tweens.add({
        targets: this.dangerText,
        alpha:   0.2,
        duration: 300,
        yoyo:    true,
        repeat:  -1,
      })
    } else {
      if (this._dangerTween) {
        this._dangerTween.stop()
        this._dangerTween = null
      }
      this.dangerText.setAlpha(1)
    }
  }

  // ── Анимация получения монеты ─────────────────────────────
  coinPopup(x, y) {
    const pop = this.scene.add.text(x, y, '+₪', {
      fontFamily: 'Press Start 2P',
      fontSize:   '10px',
      color:      '#F1C40F',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(300)

    this.scene.tweens.add({
      targets:  pop,
      y:        y - 40,
      alpha:    0,
      duration: 600,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    })
  }

  // ── Анимация получения бустера ────────────────────────────
  boosterPopup(x, y) {
    const pop = this.scene.add.text(x, y, '⚡ УСКОРЕНИЕ!', {
      fontFamily: 'Press Start 2P',
      fontSize:   '8px',
      color:      '#00FFFF',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(300)

    this.scene.tweens.add({
      targets:  pop,
      y:        y - 50,
      alpha:    0,
      duration: 800,
      ease:     'Power2',
      onComplete: () => pop.destroy(),
    })
  }

  // ── Показать/скрыть весь HUD ─────────────────────────────
  setVisible(v) {
    this.bg.setVisible(v)
    this.heartGraphic.setVisible(v)
    this.coinsText.setVisible(v)
    this.distText.setVisible(v)
  }

  destroy() {
    if (this._dangerTween) this._dangerTween.stop()
    this.bg.destroy()
    this.heartGraphic.destroy()
    this.coinsText.destroy()
    this.distText.destroy()
    this.dangerText.destroy()
    this.dangerBar.destroy()
  }
}

export default HUD
