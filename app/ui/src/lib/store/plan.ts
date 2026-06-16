// Загрузка плана: список планов + выбранный план (getPlan отдаёт ВСЕ недели), построение
// сессии из сохранённого снапшота либо новой. Оффлайн — из кэша. Смена недели рефетча не требует
// (см. sync.saveSettings / session.selectWeek) — здесь только первичная загрузка и смена ПЛАНА.
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'
import * as api from '../api.js'
import { buildState, findDay } from '../state.js'
import { runLoading, LOAD_FIRST } from './loading.js'
import { restoreTimer, clearTimer } from './restTimer.js'
import { save, planName } from './persist.svelte.js'
import { syncNow } from './sync.js'

let planReqSeq = 0 // токен против устаревших ответов getPlan

export async function loadPlan(): Promise<void> {
  setStatus('s-sync', 'Загрузка планов…')
  // Загрузка данных (план + построение сессии) как промис — оверлей держится, пока не готово.
  const data = (async () => {
    try {
      const plans = await api.listPlans()
      app.plans = plans || []
      storage.savePlansCache(app.plans)
      let sel = storage.getPlanName()
      if (!sel || app.plans.indexOf(sel) < 0) sel = app.plans[0]
      await fetchPlan(sel)
    } catch (e) {
      useCache(api.isAppsScript() ? 'Онлайн недоступен' : 'Оффлайн-режим')
    }
  })()
  runLoading(LOAD_FIRST, data) // оверлей гаснет по max(анимация, данные готовы) — без пустого экрана
  await data
}

export async function fetchPlan(name: string): Promise<void> {
  const seq = ++planReqSeq
  setStatus('s-sync', 'Загрузка плана…')
  try {
    const plan = await api.getPlan(name)
    if (seq !== planReqSeq) return // устаревший ответ — игнор
    app.plan = plan
    storage.setPlanName(plan.plan ?? '')
    storage.cachePlan(plan)
    initAfterPlan()
    setStatus('s-idle', 'План «' + plan.plan + '» загружен ✓')
  } catch (e) {
    if (seq !== planReqSeq) return
    useCache('План не загрузился')
  }
}

function useCache(msg: string): void {
  app.plans = storage.loadPlansCache()
  const sel = storage.getPlanName() || app.plans[0]
  const p = storage.loadCachedPlan(sel)
  if (!p || !p.days || !p.days.length || !p.weeks || !p.weeks.length) {
    setStatus('s-err', 'Нет плана и нет кэша — открой при наличии сети')
    return
  }
  app.plan = p
  initAfterPlan()
  setStatus('s-local', msg + ' — план из кэша')
}

function initAfterPlan(): void {
  const plan = app.plan
  if (!plan) return
  const saved = storage.loadSessionState()
  const weeks = plan.weeks || []
  // Резюмируем сохранённую сессию по идентичности (план/неделя/день), а не по числу подходов —
  // иначе кардио-сессия (пустой exercises) теряется. Силовая резюмится только если есть упражнения.
  const matches =
    saved &&
    saved.plan === plan.plan &&
    weeks.indexOf(saved.week) >= 0 &&
    findDay(plan, saved.day_id) &&
    (saved.cardio || (saved.exercises && saved.exercises.length))
  if (matches && saved) {
    saved._submitting = false // не залипает после перезагрузки
    app.session = saved
    save() // зафиксировать нормализованный _submitting=false сразу
    restoreTimer() // rest-таймер доезжает после reload (моменты те же, now актуальный)
    if (!saved.synced && saved.payload) {
      app.showRetry = true
      if (navigator.onLine) syncNow()
      else setStatus('s-local', 'Есть несинхронизированная тренировка — нажми ↻')
    }
    return
  }
  clearTimer() // новая сессия — старый таймер не относится к ней
  // Восстанавливаем прошлый выбор недели/дня, если он валиден для текущего плана;
  // иначе дефолты: последняя неделя / первый день.
  const lastWeek = storage.getLastWeek()
  const week = weeks.indexOf(lastWeek) >= 0 ? lastWeek : weeks[weeks.length - 1]
  const day = findDay(plan, storage.getLastDay()) || plan.days[0]
  app.session = buildState(day, week, planName())
  save()
}
