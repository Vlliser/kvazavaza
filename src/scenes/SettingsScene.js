// ============================================================
// SettingsScene.js — Настройки игры
//
// Тоггеры: МУЗЫКА / ЗВУКИ / ВИБРАЦИЯ
// Настройки хранятся в localStorage
// ============================================================

import { DIALOGUES } from '../dialogues.js'
import { Audio }     from '../audio/AudioManager.js'

const STORAGE_KEY = 'kvazavaza_settings'

// Загрузить / сохранить настройки
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch { return {} }
}
function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export default class SettingsScene extends Phaser.Scene {
  constructor() { super('SettingsScene') }

  init(data) {
    this.fromScene = data?.from || 'MainMenuScene'
  }

  create() {
    const W = this.scale.width
    const H = this.scale.height

    Audio.resume()

    // Загружаем текущие настройки
    const saved = loadSettings()
    this.settings = {
      music:     saved.music     !== false,
      sfx:       saved.sfx      !== false,
      vibration: saved.vibration !== false,
    }

    // ── Фон ─────────────────────────────────────────────
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0D0620, 0x0D0620, 0x1A0A2E, 0x2C1654, 1)
    bg.fillRect(0, 0, W, H)

    // Звёзды
    for (let i = 0; i < 40; i++) {
      this.add.rectangle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(0, H),
        Math.random() < 0.3 ? 2 : 1,
        Math.random() < 0.3 ? 2 : 1,
        0xffffff,
        Math.random() * 0.5 + 0.1,
      )
    }

    // ── Заголовок ────────────────────────────────────────
    this.add.text(W / 2, 50, DIALOGUES.settings.title, {
      fontFamily: 'Press Start 2P',
      fontSize:   '18px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5)

    // ── Тоггеры ──────────────────────────────────────────
    const toggles = [
      { key: 'music',     label: DIALOGUES.settings.music },
      { key: 'sfx',       label: DIALOGUES.settings.sfx },
      { key: 'vibration', label: DIALOGUES.settings.vibration },
    ]

    this._toggleObjects = {}

    toggles.forEach((t, i) => {
      const y = H / 2 - 50 + i * 90
      this._createToggle(W / 2, y, t.label, t.key)
    })

    // ── Кнопка назад ─────────────────────────────────────
    this._makeBackButton(W, H)

    // Плавное появление
    this.cameras.main.setAlpha(0)
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 400 })
  }

  _createToggle(x, y, label, key) {
    const ON  = 0x27AE60
    const OFF = 0x555566
    const val = this.settings[key]

    // Фоновая панель
    const panel = this.add.graphics()
    panel.fillStyle(0x1A0A2E, 0.7)
    panel.fillRoundedRect(x - 200, y - 24, 400, 48, 10)
    panel.lineStyle(1, 0x9B59B6, 0.5)
    panel.strokeRoundedRect(x - 200, y - 24, 400, 48, 10)

    // Лейбл
    this.add.text(x - 140, y, label, {
      fontFamily: 'Press Start 2P',
      fontSize:   '11px',
      color:      '#D7BDE2',
    }).setOrigin(0, 0.5)

    // Кнопка-тоггер (pill)
    const pillBg = this.add.graphics()
    const pillW  = 80
    const pillH  = 30
    const px     = x + 120
    const py     = y

    const drawPill = (isOn) => {
      pillBg.clear()
      pillBg.fillStyle(isOn ? ON : OFF, 1)
      pillBg.fillRoundedRect(px - pillW / 2, py - pillH / 2, pillW, pillH, pillH / 2)
    }

    drawPill(val)

    // Текст ON/OFF
    const pillTxt = this.add.text(px, py,
      val ? DIALOGUES.settings.on : DIALOGUES.settings.off, {
        fontFamily: 'Press Start 2P',
        fontSize:   '9px',
        color:      '#ffffff',
      }).setOrigin(0.5)

    // Интерактивная зона
    const zone = this.add.zone(px, py, pillW + 20, pillH + 20)
      .setInteractive({ useHandCursor: true })

    zone.on('pointerdown', () => {
      this.settings[key] = !this.settings[key]
      drawPill(this.settings[key])
      pillTxt.setText(this.settings[key] ? DIALOGUES.settings.on : DIALOGUES.settings.off)
      saveSettings(this.settings)
      if (this.settings.sfx) Audio.uiClick()
    })

    this._toggleObjects[key] = { pill: pillBg, txt: pillTxt }
  }

  _makeBackButton(W, H) {
    const by = H - 50

    const bg = this.add.graphics()
    bg.fillStyle(0x6C3483, 0.85)
    bg.fillRoundedRect(W / 2 - 100, by - 20, 200, 40, 8)
    bg.lineStyle(2, 0xffffff, 0.4)
    bg.strokeRoundedRect(W / 2 - 100, by - 20, 200, 40, 8)

    const txt = this.add.text(W / 2, by, DIALOGUES.settings.back, {
      fontFamily: 'Press Start 2P',
      fontSize:   '11px',
      color:      '#ffffff',
    }).setOrigin(0.5)

    const zone = this.add.zone(W / 2, by, 200, 40).setInteractive({ useHandCursor: true })
    zone.on('pointerdown', () => {
      Audio.uiClick()
      this.cameras.main.fadeOut(300)
      this.time.delayedCall(300, () => {
        this.scene.start(this.fromScene)
      })
    })
    zone.on('pointerover', () => {
      bg.clear()
      bg.fillStyle(0x9B59B6, 0.95)
      bg.fillRoundedRect(W / 2 - 100, by - 20, 200, 40, 8)
    })
    zone.on('pointerout', () => {
      bg.clear()
      bg.fillStyle(0x6C3483, 0.85)
      bg.fillRoundedRect(W / 2 - 100, by - 20, 200, 40, 8)
    })
  }
}
