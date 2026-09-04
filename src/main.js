// ============================================================
// main.js — Точка входа: инициализация Phaser
// ============================================================

import Phaser from 'phaser'

// Сцены (порядок = порядок запуска)
import BootScene     from './scenes/BootScene.js'
import IntroScene    from './scenes/IntroScene.js'
import MainMenuScene from './scenes/MainMenuScene.js'

// ────────────────────────────────────────────────────────────
// КОНФИГУРАЦИЯ PHASER
// ────────────────────────────────────────────────────────────
const config = {
  type: Phaser.AUTO, // Автовыбор: WebGL (быстро) или Canvas (фолбэк)

  // Базовое разрешение 9:16 для мобильного портрета
  width:  480,
  height: 854,

  // Цвет фона (видно только в letterbox-полосах)
  backgroundColor: '#1A0A2E',

  // ── Pixel Art настройки
  pixelArt:    true,  // Отключает сглаживание спрайтов
  roundPixels: true,  // Позиции объектов — только целые числа

  // ── Масштабирование под экран
  scale: {
    mode:       Phaser.Scale.FIT,          // Вписать с сохранением пропорций
    autoCenter: Phaser.Scale.CENTER_BOTH,  // По центру
    parent:     'game-container',          // В наш div
  },

  // ── Мобильный ввод
  input: {
    touch: true,   // Тач-события
    mouse: true,   // Мышь (для разработки на ПК)
  },

  // ── Физика (будет нужна с Блока 3)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 800 },
      debug: false, // Включи true, чтобы видеть хитбоксы при отладке
    },
  },

  // ── Порядок сцен
  // Первая сцена в массиве запускается автоматически
  scene: [
    BootScene,      // Блок 1: регистрация SW, загрузка шрифтов
    IntroScene,     // Блок 1: заставка Marvel-style
    MainMenuScene,  // Блок 1: главное меню (заглушка)

    // Блок 2: LevelMapScene, SettingsScene, DeathScene
    // Блок 3: Level1Scene, Level2Scene
    // Блок 4: Level3Scene, Level4Scene
    // Блок 5: Level5Scene, CreditsScene
    // Блок 6: BonusShopScene
  ],
}

// Запускаем игру!
const game = new Phaser.Game(config)

// Экспортируем для возможного доступа из других модулей
export default game
