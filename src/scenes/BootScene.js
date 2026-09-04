// ============================================================
// BootScene.js — Первая сцена: регистрация PWA и загрузка
// ============================================================
// Что делает эта сцена:
// 1. Показывает минимальный экран загрузки
// 2. Регистрирует Service Worker (PWA / fullscreen)
// 3. Ждёт загрузки шрифтов Google Fonts
// 4. Переходит в IntroScene (или MainMenuScene если есть сохранение)
// ============================================================

import { hasSavedGame } from '../supabase.js'
import DIALOGUES from '../dialogues.js'

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  // preload() запускается автоматически Phaser'ом
  // Здесь загружаем минимальные ресурсы
  preload() {
    const { width, height } = this.cameras.main

    // Фон загрузки
    this.add.rectangle(width / 2, height / 2, width, height, 0x2c1654)

    // Текст загрузки по центру
    this.loadingText = this.add
      .text(width / 2, height / 2, DIALOGUES.system.loading, {
        fontFamily: '"Press Start 2P"',
        fontSize:   '14px',
        color:      '#E040FB',
      })
      .setOrigin(0.5)

    // Анимация мигания текста
    this.tweens.add({
      targets:  this.loadingText,
      alpha:    0.2,
      duration: 600,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    })
  }

  // create() вызывается после preload()
  async create() {
    // Регистрируем Service Worker для PWA
    await this.registerServiceWorker()

    // Ждём загрузки шрифтов
    await this.waitForFonts()

    // Проверяем: есть ли сохранённая игра?
    const savedGame = hasSavedGame()

    // Плавный fade-out и переход
    this.cameras.main.fade(500, 0, 0, 0)
    this.time.delayedCall(500, () => {
      // Если сохранение есть — показываем интро всё равно
      // (главное меню предложит "Продолжить")
      this.scene.start('IntroScene', { hasSave: savedGame })
    })
  }

  // ────────────────────────────────────────────
  // Регистрация Service Worker
  // ────────────────────────────────────────────
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.log('[SW] Service Worker не поддерживается в этом браузере.')
      return
    }

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      console.log('[SW] Зарегистрирован:', reg.scope)
    } catch (err) {
      console.warn('[SW] Ошибка регистрации:', err)
    }
  }

  // ────────────────────────────────────────────
  // Ожидание загрузки Google Fonts
  // Без этого Phaser может нарисовать текст стандартным шрифтом
  // ────────────────────────────────────────────
  async waitForFonts() {
    try {
      // Ждём загрузки всех шрифтов, но не более 3 секунд
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 3000)),
      ])
      console.log('[Fonts] Шрифты загружены.')
    } catch {
      console.warn('[Fonts] Не удалось дождаться шрифтов.')
    }
  }
}

export default BootScene
