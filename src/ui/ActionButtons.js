// ============================================================
// ActionButtons.js — 4 кнопки действия (правая сторона)
//
// ПРЫЖОК, ДЕЙСТВИЕ, БЕГ, АТАКА
// Поддерживает мульти-тач одновременно
// ============================================================

export class ActionButtons {
  /**
   * @param {Phaser.Scene} scene
   * @param {Object} callbacks - { onJump, onAction, onRun, onAttack }
   */
  constructor(scene, callbacks = {}) {
    this.scene     = scene
    this.callbacks = callbacks

    const W = scene.scale.width
    const H = scene.scale.height

    // Позиции кнопок (правый нижний угол, PSP-стиль)
    // Кнопка B (Прыжок) — внизу по центру
    // Кнопка A (Действие) — справа
    // Кнопка Y (Бег) — слева
    // Кнопка X (Атака) — вверху
    const CX = W - 90   // центр группы кнопок X
    const CY = H - 80   // центр группы кнопок Y
    const R  = 38       // радиус расположения кнопок
    const BR = 22       // радиус самой кнопки

    this._buttons = [
      { id: 'jump',   label: '●',  x: CX,      y: CY + R,  color: 0xE74C3C, cb: 'onJump',   pressed: false },
      { id: 'action', label: '■',  x: CX + R,  y: CY,      color: 0x27AE60, cb: 'onAction', pressed: false },
      { id: 'run',    label: '▲',  x: CX - R,  y: CY,      color: 0xF39C12, cb: 'onRun',    pressed: false },
      { id: 'attack', label: '✕',  x: CX,      y: CY - R,  color: 0x3498DB, cb: 'onAttack', pressed: false },
    ]

    this._btnRadius = BR
    this._graphics  = []
    this._labels    = []
    this._activeTouches = new Map() // pointerId → buttonId

    this._create()
    this._bindEvents()
  }

  _create() {
    for (const btn of this._buttons) {
      // Фон кнопки
      const g = this.scene.add.graphics()
      g.setDepth(100)
      this._drawButton(g, btn, false)
      this._graphics.push(g)

      // Буква на кнопке
      const lbl = this.scene.add.text(btn.x, btn.y, btn.label, {
        fontFamily: 'Press Start 2P',
        fontSize: '10px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(101)
      this._labels.push(lbl)

      btn._g = g
    }
  }

  _drawButton(g, btn, pressed) {
    g.clear()
    const alpha = pressed ? 0.9 : 0.55
    const r     = pressed ? this._btnRadius - 2 : this._btnRadius
    g.fillStyle(btn.color, alpha)
    g.fillCircle(btn.x, btn.y, r)
    g.lineStyle(2, 0xffffff, pressed ? 0.9 : 0.4)
    g.strokeCircle(btn.x, btn.y, r)
  }

  _bindEvents() {
    this.scene.input.on('pointerdown',      this._onDown, this)
    this.scene.input.on('pointerup',        this._onUp,   this)
    this.scene.input.on('pointerupoutside', this._onUp,   this)
  }

  _onDown(pointer) {
    // Правая половина экрана
    if (pointer.x < this.scene.scale.width * 0.5) return

    for (const btn of this._buttons) {
      const dx = pointer.x - btn.x
      const dy = pointer.y - btn.y
      if (Math.sqrt(dx * dx + dy * dy) <= this._btnRadius + 18) {
        this._activeTouches.set(pointer.id, btn.id)
        btn.pressed = true
        this._drawButton(btn._g, btn, true)
        // Вызываем колбэк
        if (this.callbacks[btn.cb]) this.callbacks[btn.cb]()
        break
      }
    }
  }

  _onUp(pointer) {
    const btnId = this._activeTouches.get(pointer.id)
    if (!btnId) return
    this._activeTouches.delete(pointer.id)

    const btn = this._buttons.find(b => b.id === btnId)
    if (btn) {
      btn.pressed = false
      this._drawButton(btn._g, btn, false)
    }
  }

  // Проверить — зажата ли кнопка прямо сейчас
  isPressed(id) {
    return this._buttons.find(b => b.id === id)?.pressed || false
  }

  setVisible(v) {
    this._graphics.forEach(g => g.setVisible(v))
    this._labels.forEach(l => l.setVisible(v))
  }

  destroy() {
    this.scene.input.off('pointerdown',      this._onDown, this)
    this.scene.input.off('pointerup',        this._onUp,   this)
    this.scene.input.off('pointerupoutside', this._onUp,   this)
    this._graphics.forEach(g => g.destroy())
    this._labels.forEach(l => l.destroy())
  }
}

export default ActionButtons
