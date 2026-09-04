// ============================================================
// AudioManager.js — Процедурные звуки через Web Audio API
//
// Никаких mp3/ogg файлов — всё генерируется математически.
// Звуки: прыжок, монета, смерть, победа, удар, кнопка UI
// ============================================================

// ────────────────────────────────────────────────────────────
// Синглтон AudioContext
// ────────────────────────────────────────────────────────────
let _ctx = null

function getCtx() {
  if (!_ctx) {
    _ctx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Возобновить после авто-паузы браузера (требует пользовательского жеста)
  if (_ctx.state === 'suspended') {
    _ctx.resume()
  }
  return _ctx
}

// ────────────────────────────────────────────────────────────
// Базовый генератор тона
// ────────────────────────────────────────────────────────────
function playTone({
  frequency = 440,
  type = 'square',      // 'sine' | 'square' | 'sawtooth' | 'triangle'
  duration = 0.15,
  volume = 0.3,
  startFreq = null,     // для эффекта slide
  endFreq = null,
  delay = 0,
}) {
  try {
    const ctx = getCtx()
    const t = ctx.currentTime + delay

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.type = type
    osc.frequency.setValueAtTime(startFreq || frequency, t)
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration)
    }

    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)

    osc.start(t)
    osc.stop(t + duration + 0.01)
  } catch (e) {
    // Тихо игнорируем — звук не критичен
  }
}

// ────────────────────────────────────────────────────────────
// БИБЛИОТЕКА ЗВУКОВ
// ────────────────────────────────────────────────────────────
export const Audio = {

  // Пользователь нажал кнопку UI
  uiClick() {
    playTone({ frequency: 880, type: 'square', duration: 0.05, volume: 0.2 })
  },

  // Прыжок Малечки (нарастающий свист)
  jump() {
    playTone({ type: 'square', startFreq: 300, endFreq: 600,
               duration: 0.15, volume: 0.25 })
  },

  // Приземление после прыжка
  land() {
    playTone({ type: 'square', startFreq: 200, endFreq: 100,
               duration: 0.08, volume: 0.15 })
  },

  // Подобрала монетку (шакрукхан)
  coin() {
    playTone({ frequency: 660, type: 'square', duration: 0.05, volume: 0.2 })
    playTone({ frequency: 880, type: 'square', duration: 0.05, volume: 0.2, delay: 0.06 })
  },

  // Бустер скорости
  booster() {
    [523, 659, 784, 1047].forEach((f, i) => {
      playTone({ frequency: f, type: 'square', duration: 0.08, volume: 0.2, delay: i * 0.06 })
    })
  },

  // Смерть / Экран поражения
  death() {
    playTone({ type: 'sawtooth', startFreq: 440, endFreq: 55,
               duration: 0.6, volume: 0.3 })
  },

  // Удар / попадание тени
  hit() {
    playTone({ type: 'sawtooth', startFreq: 200, endFreq: 80,
               duration: 0.2, volume: 0.3 })
  },

  // Победа (завершение уровня)
  levelComplete() {
    const melody = [523, 659, 784, 1047, 1175]
    melody.forEach((f, i) => {
      playTone({ frequency: f, type: 'square', duration: 0.12, volume: 0.25, delay: i * 0.1 })
    })
  },

  // Диалог — следующая реплика
  dialogNext() {
    playTone({ frequency: 440, type: 'square', duration: 0.04, volume: 0.15 })
  },

  // Тревога — тень близко!
  danger() {
    playTone({ frequency: 330, type: 'sawtooth', duration: 0.1, volume: 0.2 })
    playTone({ frequency: 280, type: 'sawtooth', duration: 0.1, volume: 0.2, delay: 0.15 })
  },

  // Катсцена / важный момент
  sting() {
    playTone({ frequency: 110, type: 'sawtooth', duration: 0.3, volume: 0.35 })
    playTone({ frequency: 880, type: 'square',   duration: 0.15, volume: 0.2, delay: 0.2 })
  },

  // Возобновить контекст (вызвать при первом тапе пользователя)
  resume() {
    getCtx()
  },
}

export default Audio
