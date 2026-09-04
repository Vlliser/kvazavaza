// ============================================================
// GameStateManager.js — Менеджер состояния игры
//
// Централизованное хранилище текущего прогресса.
// Все сцены обращаются только через этот менеджер.
// Данные хранятся в localStorage + синхронизируются с Supabase.
// ============================================================

import { loadGameState, saveGameState, DEFAULT_GAME_STATE } from './supabase.js'

// ────────────────────────────────────────────────────────────
// Синглтон — один объект на всю игру
// ────────────────────────────────────────────────────────────
export const GSM = {
  _state: null,
  _initialized: false,

  // ── Инициализация (вызывается в BootScene один раз) ──────
  async init() {
    if (this._initialized) return this._state
    this._state = await loadGameState()
    this._initialized = true
    console.log('[GSM] Состояние загружено:', this._state)
    return this._state
  },

  // ── Получить всё состояние ───────────────────────────────
  getAll() {
    return { ...(this._state || DEFAULT_GAME_STATE) }
  },

  // ── Получить одно поле ───────────────────────────────────
  get(key) {
    return this._state ? this._state[key] : DEFAULT_GAME_STATE[key]
  },

  // ── Обновить поля и сохранить ────────────────────────────
  async update(patch) {
    if (!this._state) this._state = { ...DEFAULT_GAME_STATE }
    Object.assign(this._state, patch)
    await saveGameState(this._state)
    return this._state
  },

  // ── Добавить шакрукханы ──────────────────────────────────
  async addCoins(amount) {
    const current = this.get('shakarukhany') || 0
    return this.update({ shakarukhany: current + amount })
  },

  // ── Снять шакрукханы (возвращает false если не хватает) ──
  async spendCoins(amount) {
    const current = this.get('shakarukhany') || 0
    if (current < amount) return false
    await this.update({ shakarukhany: current - amount })
    return true
  },

  // ── Завершить уровень ────────────────────────────────────
  async completeLevel(levelNum) {
    const currentLevel = this.get('level') || 1
    if (levelNum >= currentLevel) {
      await this.update({ level: levelNum + 1 })
    }
  },

  // ── Получить текущий открытый уровень ────────────────────
  getMaxLevel() {
    return this.get('level') || 1
  },

  // ── Сброс (новая игра) ───────────────────────────────────
  async reset() {
    this._state = { ...DEFAULT_GAME_STATE }
    this._initialized = true
    try {
      localStorage.removeItem('kvazavaza_save')
    } catch (e) {}

    // Фоновая очистка без блокировки старта игры
    import('./supabase.js')
      .then(m => m.wipeGameState && m.wipeGameState())
      .catch(err => console.warn('[GSM] Фоновая очистка Supabase:', err))
  },
}

export default GSM
