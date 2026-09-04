// ============================================================
// LevelMapScene.js — Карта уровней
//
// Линейная «нитка с бусинами»: 5 уровней слева направо.
// Кузя-кот сидит рядом и говорит подсказки.
// Уровни открываются последовательно по прохождении.
// ============================================================

import { DIALOGUES } from '../dialogues.js'
import { GSM }       from '../GameStateManager.js'
import { Audio }     from '../audio/AudioManager.js'

// Данные уровней
const LEVELS = [
  { num: 1, name: 'Холодно\nзимой одной', icon: '❄',  x: 120,  y: 240, scene: 'Level1Scene' },
  { num: 2, name: 'Арена\nиллюзий',       icon: '⚡', x: 260,  y: 200, scene: 'Level2Scene' },
  { num: 3, name: 'Башня\nветров',         icon: '🌪', x: 400,  y: 240, scene: 'Level3Scene' },
  { num: 4, name: 'Железная\nмногоножка', icon: '🚂', x: 540,  y: 200, scene: 'Level4Scene' },
  { num: 5, name: 'Финал',                icon: '💜', x: 680,  y: 240, scene: 'Level5Scene' },
]

export default class LevelMapScene extends Phaser.Scene {
  constructor() { super('LevelMapScene') }

  // ── create ──────────────────────────────────────────────
  create() {
    const W = this.scale.width   // 854
    const H = this.scale.height  // 480

    Audio.resume()

    // Инициализируем состояние
    const maxLevel = GSM.getMaxLevel()

    // ── Фон ─────────────────────────────────────────────
    this._createBackground(W, H)

    // ── Заголовок ────────────────────────────────────────
    this.add.text(W / 2, 30, DIALOGUES.levelMap.title, {
      fontFamily: 'Press Start 2P',
      fontSize:   '14px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0.5).setDepth(10)

    // ── Нитка-дорожка ────────────────────────────────────
    this._drawPath(W, H)

    // ── Узлы уровней ─────────────────────────────────────
    this._drawLevels(maxLevel)

    // ── Кузя-кот (проводник) ─────────────────────────────
    this._createKuzya(W, H, maxLevel)

    // ── Кнопка назад ─────────────────────────────────────
    const back = this.add.text(40, H - 25, '◀ МЕНЮ', {
      fontFamily: 'Press Start 2P',
      fontSize:   '9px',
      color:      '#9B59B6',
      stroke:     '#000000',
      strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(10).setInteractive({ useHandCursor: true })

    back.on('pointerdown', () => {
      Audio.uiClick()
      this.scene.start('MainMenuScene')
    })
    back.on('pointerover', () => back.setColor('#D7BDE2'))
    back.on('pointerout',  () => back.setColor('#9B59B6'))

    // Появление сцены
    this.cameras.main.setAlpha(0)
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 400 })
  }

  // ── Фон со звёздами ──────────────────────────────────────
  _createBackground(W, H) {
    // Градиент
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0D0620, 0x0D0620, 0x1A0A2E, 0x2C1654, 1)
    bg.fillRect(0, 0, W, H)

    // Звёзды
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, W)
      const y = Phaser.Math.Between(0, H)
      const s = Math.random() < 0.3 ? 2 : 1
      this.add.rectangle(x, y, s, s, 0xffffff, Math.random() * 0.6 + 0.2)
    }
  }

  // ── Нитка-дорожка между уровнями ─────────────────────────
  _drawPath(W, H) {
    const g = this.add.graphics()
    const maxLevel = GSM.getMaxLevel()

    for (let i = 0; i < LEVELS.length - 1; i++) {
      const a = LEVELS[i]
      const b = LEVELS[i + 1]
      const unlocked = (i + 1) < maxLevel  // соединение разблокировано

      // Пунктирная или сплошная линия
      g.lineStyle(3, unlocked ? 0x9B59B6 : 0x333355, unlocked ? 0.8 : 0.4)
      g.beginPath()
      g.moveTo(a.x, a.y)

      // Кривая Безье для красивого изгиба
      const mx = (a.x + b.x) / 2
      g.lineTo(mx, (a.y + b.y) / 2 - 20)
      g.lineTo(b.x, b.y)
      g.strokePath()
    }

    g.setDepth(5)
  }

  // ── Узлы уровней ─────────────────────────────────────────
  _drawLevels(maxLevel) {
    for (const lvl of LEVELS) {
      const unlocked = lvl.num <= maxLevel
      const current  = lvl.num === maxLevel

      // Кружок
      const circle = this.add.graphics()
      circle.setDepth(6)

      if (unlocked) {
        circle.fillStyle(current ? 0x9B59B6 : 0x6C3483, 1)
        circle.lineStyle(3, current ? 0xE8D5FF : 0x9B59B6, 1)
      } else {
        circle.fillStyle(0x1C1C3A, 1)
        circle.lineStyle(2, 0x333355, 0.6)
      }
      circle.fillCircle(lvl.x, lvl.y, 28)
      circle.strokeCircle(lvl.x, lvl.y, 28)

      // Иконка или замок
      const icon = this.add.text(lvl.x, lvl.y - 4, unlocked ? lvl.icon : '🔒', {
        fontSize: '18px',
      }).setOrigin(0.5).setDepth(7)

      // Номер уровня
      this.add.text(lvl.x, lvl.y + 14, `${lvl.num}`, {
        fontFamily: 'Press Start 2P',
        fontSize:   '8px',
        color:      unlocked ? '#ffffff' : '#555577',
      }).setOrigin(0.5).setDepth(7)

      // Название под кружком
      this.add.text(lvl.x, lvl.y + 44, unlocked ? lvl.name : DIALOGUES.levelMap.locked, {
        fontFamily: 'VT323',
        fontSize:   '16px',
        color:      unlocked ? '#D7BDE2' : '#444466',
        align:      'center',
      }).setOrigin(0.5, 0).setDepth(7)

      // Пульсирующий эффект для текущего уровня
      if (current) {
        this.tweens.add({
          targets:  circle,
          scaleX:   1.08,
          scaleY:   1.08,
          duration: 800,
          yoyo:     true,
          repeat:   -1,
          ease:     'Sine.easeInOut',
        })
      }

      // Кнопка (только для разблокированных)
      if (unlocked) {
        const zone = this.add.zone(lvl.x, lvl.y, 70, 70)
          .setInteractive({ useHandCursor: true })
          .setDepth(8)

        zone.on('pointerdown', () => {
          Audio.uiClick()
          if (this.scene.get(lvl.scene)) {
            this.cameras.main.fadeOut(300)
            this.time.delayedCall(300, () => {
              this.scene.start(lvl.scene)
            })
          } else {
            // Сцена ещё не реализована
            this._showComingSoon(lvl.name)
          }
        })

        zone.on('pointerover', () => {
          this.tweens.add({ targets: circle, scaleX: 1.1, scaleY: 1.1, duration: 100 })
        })
        zone.on('pointerout', () => {
          this.tweens.add({ targets: circle, scaleX: 1, scaleY: 1, duration: 100 })
        })
      }
    }
  }

  // ── Кузя-кот ─────────────────────────────────────────────
  _createKuzya(W, H, maxLevel) {
    // Кузя сидит рядом с текущим уровнем
    const currentLvl = LEVELS.find(l => l.num === maxLevel) || LEVELS[0]
    const kx = currentLvl.x - 60
    const ky = currentLvl.y + 20

    // Тело кота из прямоугольников
    const g = this.add.graphics()
    g.setDepth(9)
    this._drawKuzya(g, kx, ky)

    // Диалоговый пузырь
    const phrases = DIALOGUES.levelMap.kuzya
    const phrase  = Phaser.Utils.Array.GetRandom(phrases)

    const bubbleBg = this.add.graphics().setDepth(10)
    const bubbleW  = 160
    const bubbleH  = 44
    const bx = kx + 30
    const by = ky - 55

    bubbleBg.fillStyle(0x1A0A2E, 0.9)
    bubbleBg.fillRoundedRect(bx - bubbleW / 2, by - bubbleH / 2, bubbleW, bubbleH, 8)
    bubbleBg.lineStyle(2, 0x9B59B6, 0.8)
    bubbleBg.strokeRoundedRect(bx - bubbleW / 2, by - bubbleH / 2, bubbleW, bubbleH, 8)
    // Хвостик пузыря
    bubbleBg.fillStyle(0x1A0A2E, 0.9)
    bubbleBg.fillTriangle(bx - 10, by + bubbleH / 2, bx, by + bubbleH / 2 + 10, bx + 10, by + bubbleH / 2)

    this.add.text(bx, by, phrase, {
      fontFamily: 'VT323',
      fontSize:   '16px',
      color:      '#E8D5FF',
      align:      'center',
      wordWrap:   { width: bubbleW - 16 },
    }).setOrigin(0.5).setDepth(11)

    // Кузя качается
    this.tweens.add({
      targets:  g,
      y:        '+= 4',
      duration: 1200,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })
  }

  // ── Пиксельный кот Кузя ──────────────────────────────────
  _drawKuzya(g, x, y) {
    const s = 3  // размер пикселя
    const P = (px, py, color) => {
      g.fillStyle(color, 1)
      g.fillRect(x + px * s, y + py * s, s, s)
    }

    // Тело (оранжево-рыжий)
    const body = 0xE67E22
    const dark  = 0xC0392B
    const eye   = 0x27AE60  // зелёные глаза (у кота Кузи)
    const white = 0xF5CBA7

    // Уши
    P(-2, -6, body); P(-1, -7, body); P(2, -6, body); P(3, -7, body)
    // Голова
    for (let row = -5; row <= -2; row++)
      for (let col = -2; col <= 3; col++) P(col, row, body)
    // Глаза
    P(-1, -4, eye); P(2, -4, eye)
    // Нос
    P(0, -3, 0xFF9999); P(1, -3, 0xFF9999)
    // Полоски
    P(-1, -5, dark); P(1, -5, dark); P(3, -5, dark)
    // Тело
    for (let row = -1; row <= 2; row++)
      for (let col = -2; col <= 3; col++) P(col, row, body)
    // Живот
    P(0, 0, white); P(1, 0, white); P(0, 1, white); P(1, 1, white)
    // Хвост
    P(4, -1, body); P(5, -2, body); P(5, -3, body); P(4, -4, body)
    // Лапы
    P(-2, 3, body); P(-1, 3, body); P(2, 3, body); P(3, 3, body)
  }

  // ── Сцена ещё не готова ───────────────────────────────────
  _showComingSoon(name) {
    const W = this.scale.width
    const H = this.scale.height
    const pop = this.add.text(W / 2, H / 2, `${name}\nскоро...`, {
      fontFamily: 'Press Start 2P',
      fontSize:   '12px',
      color:      '#E8D5FF',
      stroke:     '#000000',
      strokeThickness: 4,
      align:      'center',
    }).setOrigin(0.5).setDepth(999)

    this.tweens.add({
      targets: pop, alpha: 0, duration: 2000,
      delay: 1000, onComplete: () => pop.destroy(),
    })
  }
}
