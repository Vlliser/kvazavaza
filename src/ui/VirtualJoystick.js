// ============================================================
// VirtualJoystick.js — Виртуальный джойстик для тача
//
// Отображается в левой половине экрана.
// Возвращает dx/dy от -1 до 1.
// Поддерживает мульти-тач (не блокирует правую часть).
// ============================================================

export class VirtualJoystick {
  /**
   * @param {Phaser.Scene} scene - сцена Phaser
   * @param {number} x - центр базы X
   * @param {number} y - центр базы Y
   * @param {number} radius - радиус базы (default 50)
   */
  constructor(scene, x, y, radius = 50) {
    this.scene      = scene
    this.baseX      = x
    this.baseY      = y
    this.radius     = radius
    this.thumbR     = Math.round(radius * 0.45)
    this.maxDist    = radius - this.thumbR

    // Текущие значения оси (от -1 до 1)
    this.dx = 0
    this.dy = 0

    this._active   = false
    this._touchId  = null

    this._createGraphics()
    this._bindEvents()
  }

  // ── Рисуем базу и большой палец ──────────────────────────
  _createGraphics() {
    // База (статичная полупрозрачная окружность)
    this.gBase = this.scene.add.graphics()
    this.gBase.setDepth(100)
    this._drawBase()

    // Палец (перемещаемый кружок)
    this.gThumb = this.scene.add.graphics()
    this.gThumb.setDepth(101)
    this._drawThumb()

    // Начальные позиции
    this.gBase.setPosition(this.baseX, this.baseY)
    this.gThumb.setPosition(this.baseX, this.baseY)
  }

  _drawBase() {
    this.gBase.clear()
    // Внешний круг
    this.gBase.lineStyle(2, 0xffffff, 0.35)
    this.gBase.strokeCircle(0, 0, this.radius)
    // Внутренний заливка
    this.gBase.fillStyle(0xffffff, 0.08)
    this.gBase.fillCircle(0, 0, this.radius)
    // Крестик-ориентир
    this.gBase.lineStyle(1, 0xffffff, 0.2)
    this.gBase.lineBetween(-this.radius * 0.6, 0, this.radius * 0.6, 0)
    this.gBase.lineBetween(0, -this.radius * 0.6, 0, this.radius * 0.6)
  }

  _drawThumb() {
    this.gThumb.clear()
    this.gThumb.fillStyle(0xffffff, 0.5)
    this.gThumb.fillCircle(0, 0, this.thumbR)
    this.gThumb.lineStyle(2, 0xffffff, 0.8)
    this.gThumb.strokeCircle(0, 0, this.thumbR)
  }

  // ── Привязка событий тача/мыши ───────────────────────────
  _bindEvents() {
    this.scene.input.on('pointerdown',       this._onDown, this)
    this.scene.input.on('pointermove',       this._onMove, this)
    this.scene.input.on('pointerup',         this._onUp,   this)
    this.scene.input.on('pointerupoutside',  this._onUp,   this)
  }

  _onDown(pointer) {
    // Активируем только если тап в ЛЕВОЙ половине экрана
    if (pointer.x < this.scene.scale.width * 0.45 && !this._active) {
      this._active  = true
      this._touchId = pointer.id
      this._update(pointer)
    }
  }

  _onMove(pointer) {
    if (!this._active || pointer.id !== this._touchId) return
    this._update(pointer)
  }

  _onUp(pointer) {
    if (!this._active || pointer.id !== this._touchId) return
    this._active  = false
    this._touchId = null
    this.dx = 0
    this.dy = 0
    this.gThumb.setPosition(this.baseX, this.baseY)
  }

  _update(pointer) {
    const rawDx = pointer.x - this.baseX
    const rawDy = pointer.y - this.baseY
    const dist  = Math.sqrt(rawDx * rawDx + rawDy * rawDy)

    if (dist === 0) {
      this.dx = 0
      this.dy = 0
      this.gThumb.setPosition(this.baseX, this.baseY)
      return
    }

    // Ограничиваем движение пальца радиусом
    const clamp = Math.min(dist, this.maxDist)
    const nx = rawDx / dist  // нормализованный вектор
    const ny = rawDy / dist

    this.dx = nx * (clamp / this.maxDist)
    this.dy = ny * (clamp / this.maxDist)

    this.gThumb.setPosition(
      this.baseX + nx * clamp,
      this.baseY + ny * clamp,
    )
  }

  // ── Геттеры для игровой логики ───────────────────────────
  get left()  { return this.dx < -0.3 }
  get right() { return this.dx >  0.3 }
  get up()    { return this.dy < -0.3 }
  get down()  { return this.dy >  0.3 }
  get isActive() { return this._active }

  // ── Показать / скрыть ────────────────────────────────────
  setVisible(v) {
    this.gBase.setVisible(v)
    this.gThumb.setVisible(v)
  }

  // ── Очистка при уничтожении сцены ────────────────────────
  destroy() {
    this.scene.input.off('pointerdown',      this._onDown, this)
    this.scene.input.off('pointermove',      this._onMove, this)
    this.scene.input.off('pointerup',        this._onUp,   this)
    this.scene.input.off('pointerupoutside', this._onUp,   this)
    this.gBase.destroy()
    this.gThumb.destroy()
  }
}

export default VirtualJoystick
