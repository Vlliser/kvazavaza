// ============================================================
// supabase.js — Клиент Supabase + система сохранений
//
// Стратегия: "LocalStorage First"
// 1. Сохраняем СРАЗУ в localStorage (быстро, оффлайн)
// 2. Синхронизируем с Supabase в фоне (медленно, надёжно)
// ============================================================

import { createClient } from '@supabase/supabase-js'

// Ключи берутся из .env файла (VITE_ префикс обязателен)
const rawUrl           = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_URL     = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Инициализируем клиент Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ────────────────────────────────────────────────────────────
// СОСТОЯНИЕ ИГРЫ ПО УМОЛЧАНИЮ (новая игра)
// ────────────────────────────────────────────────────────────
export const DEFAULT_GAME_STATE = {
  level:        1,          // Текущий уровень
  shakarukhany: 0,          // Валюта
  lives:        2,          // Жизни (максимум 2)
  inventory:    [],         // Предметы в рюкзаке (массив id)
  achievements: [],         // Ачивки
  finalChoice:  null,       // Финальный выбор (moon / only / no)
  shopCart:     {},         // Корзина магазина
  checkpoints:  {},         // Чекпоинты внутри уровней
  playTime:     0,          // Время игры в секундах
}

// ────────────────────────────────────────────────────────────
// КЛЮЧИ В LOCALSTORAGE
// ────────────────────────────────────────────────────────────
const LS_SESSION = 'kvazavaza_session_id'
const LS_SAVE    = 'kvazavaza_save'

// ────────────────────────────────────────────────────────────
// SESSION ID — уникальный ID игрока (хранится в localStorage)
// Позволяет идентифицировать игрока в Supabase без авторизации
// ────────────────────────────────────────────────────────────
export function getSessionId() {
  let id = localStorage.getItem(LS_SESSION)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(LS_SESSION, id)
  }
  return id
}

// ────────────────────────────────────────────────────────────
// СОХРАНИТЬ ИГРУ
// ────────────────────────────────────────────────────────────
export async function saveGameState(state) {
  const sessionId = getSessionId()
  const toSave    = { ...state, sessionId, savedAt: Date.now() }

  // Шаг 1: Мгновенно в localStorage
  localStorage.setItem(LS_SAVE, JSON.stringify(toSave))

  // Шаг 2: Фоновая синхронизация с Supabase
  try {
    const { error } = await supabase
      .from('game_saves')
      .upsert(
        {
          session_id:   sessionId,
          level:        state.level,
          shakarukhany: state.shakarukhany,
          lives:        state.lives,
          inventory:    state.inventory,
          achievements: state.achievements,
          final_choice: state.finalChoice,
          shop_cart:    state.shopCart,
          checkpoints:  state.checkpoints,
          play_time:    state.playTime,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'session_id' }
      )

    if (error) {
      console.warn('[Supabase] Ошибка сохранения:', error.message)
    }
  } catch (err) {
    // Оффлайн — ничего страшного, localStorage уже сохранён
    console.warn('[Supabase] Недоступен, сохранено только локально.')
  }
}

// ────────────────────────────────────────────────────────────
// ЗАГРУЗИТЬ ИГРУ
// ────────────────────────────────────────────────────────────
export async function loadGameState() {
  const sessionId = getSessionId()

  // Шаг 1: Пробуем localStorage (работает оффлайн)
  const localRaw = localStorage.getItem(LS_SAVE)
  if (localRaw) {
    try {
      const parsed = JSON.parse(localRaw)
      // Убеждаемся, что это сохранение этого игрока
      if (parsed.sessionId === sessionId) {
        return { ...DEFAULT_GAME_STATE, ...parsed }
      }
    } catch {
      localStorage.removeItem(LS_SAVE)
    }
  }

  // Шаг 2: Пробуем Supabase (если localStorage пуст)
  try {
    const { data, error } = await supabase
      .from('game_saves')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (data && !error) {
      const state = {
        ...DEFAULT_GAME_STATE,
        level:        data.level,
        shakarukhany: data.shakarukhany,
        lives:        data.lives,
        inventory:    data.inventory  ?? [],
        achievements: data.achievements ?? [],
        finalChoice:  data.final_choice,
        shopCart:     data.shop_cart  ?? {},
        checkpoints:  data.checkpoints ?? {},
        playTime:     data.play_time  ?? 0,
      }
      // Кэшируем в localStorage
      localStorage.setItem(LS_SAVE, JSON.stringify({ ...state, sessionId }))
      return state
    }
  } catch (err) {
    console.warn('[Supabase] Не удалось загрузить:', err.message)
  }

  // Шаг 3: Новая игра
  return { ...DEFAULT_GAME_STATE }
}

// ────────────────────────────────────────────────────────────
// СТЕРЕТЬ ВСЁ (используется в концовке "Нет" на Уровне 5)
// ────────────────────────────────────────────────────────────
export async function wipeGameState() {
  const sessionId = getSessionId()

  // Удаляем из localStorage
  localStorage.removeItem(LS_SAVE)
  localStorage.removeItem(LS_SESSION)

  // Удаляем из Supabase
  try {
    await supabase
      .from('game_saves')
      .delete()
      .eq('session_id', sessionId)
  } catch {
    console.warn('[Supabase] Не удалось удалить из облака.')
  }
}

// ────────────────────────────────────────────────────────────
// ПРОВЕРИТЬ: есть ли сохранённая игра?
// ────────────────────────────────────────────────────────────
export function hasSavedGame() {
  return localStorage.getItem(LS_SAVE) !== null
}

// ────────────────────────────────────────────────────────────
// ОТПРАВИТЬ ВЫБОР В МАГАЗИНЕ (Блок 6)
// ────────────────────────────────────────────────────────────
export async function submitShopOrder(order) {
  const sessionId = getSessionId()
  try {
    const { error } = await supabase
      .from('shop_orders')
      .insert({
        session_id: sessionId,
        day_choice:     order.day,
        evening_choice: order.evening,
        created_at:     new Date().toISOString(),
      })
    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error('[Supabase] Ошибка заказа:', err.message)
    return { success: false, error: err.message }
  }
}
