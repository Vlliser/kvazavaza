// ============================================================
// main.js — Точка входа: инициализация Phaser
// БЛОК 2: Landscape 854×480, все сцены подключены
// ============================================================

import Phaser from 'phaser'

// Сцены
import BootScene      from './scenes/BootScene.js'
import IntroScene     from './scenes/IntroScene.js'
import MainMenuScene  from './scenes/MainMenuScene.js'
import LevelMapScene  from './scenes/LevelMapScene.js'
import DeathScene     from './scenes/DeathScene.js'
import SettingsScene  from './scenes/SettingsScene.js'
import Level1Scene    from './scenes/Level1Scene.js'

// ────────────────────────────────────────────────────────────
// КОНФИГУРАЦИЯ PHASER
// Landscape: 854×480 (соотношение 16:9 горизонтально)
// ────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO,

  // LANDSCAPE: ширина > высоты (как PSP/Nintendo DS)
  width:  854,
  height: 480,

  backgroundColor: '#1A0A2E',

  // Pixel Art — без размытия
  pixelArt:    true,
  roundPixels: true,

  // Масштабирование
  scale: {
    mode:       Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent:     'game-container',
    width:      854,
    height:     480,
  },

  // Ввод
  input: {
    touch: true,
    mouse: true,
  },

  // Физика Arcade — для платформера
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 900 },
      debug: false, // включи true для отладки хитбоксов
    },
  },

  // Порядок сцен (первая запускается автоматически)
  scene: [
    BootScene,      // Блок 1: SW + шрифты
    IntroScene,     // Блок 1: заставка
    MainMenuScene,  // Блок 1: главное меню
    LevelMapScene,  // Блок 2: карта уровней
    DeathScene,     // Блок 2: экран смерти
    SettingsScene,  // Блок 2: настройки
    Level1Scene,    // Блок 2: уровень 1 — «Холодно зимой одной»
  ],
}

const game = new Phaser.Game(config)

// Гарантируем пересчёт масштаба при повороте устройства и изменении размера окна
function refreshGameScale() {
  if (game && game.scale) {
    game.scale.refresh()
  }
}

window.addEventListener('resize', () => {
  refreshGameScale()
  setTimeout(refreshGameScale, 150)
  setTimeout(refreshGameScale, 400)
})

window.addEventListener('orientationchange', () => {
  refreshGameScale()
  setTimeout(refreshGameScale, 150)
  setTimeout(refreshGameScale, 400)
})

if (screen.orientation && screen.orientation.addEventListener) {
  screen.orientation.addEventListener('change', () => {
    refreshGameScale()
    setTimeout(refreshGameScale, 150)
    setTimeout(refreshGameScale, 400)
  })
}

export default game
