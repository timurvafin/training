// Загрузка плана: список планов + выбранный план (getPlan отдаёт ВСЕ недели), построение
// сессии из сохранённого снапшота либо новой. Оффлайн — из кэша. Смена недели рефетча не требует
// (см. sync.saveSettings / session.selectWeek) — здесь только первичная загрузка и смена ПЛАНА.
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'
import * as api from '../api.js'
import { findDay } from '../state.js'
import { runLoading, LOAD_FIRST } from './loading.js'
import { clearTimer } from './restTimer.js'
import { save } from './persist.svelte.js'
import { applyPrefs } from './prefs.js'
import { applyProgress, buildForDay, refreshProgress } from './progress.js'

let planReqSeq = 0 // токен против устаревших ответов getPlan

export async function loadPlan(): Promise<void> {
  setStatus('s-sync', 'Загрузка планов…')
  // Загрузка данных (план + построение сессии) как промис — оверлей держится, пока не готово.
  const data = (async () => {
    try {
      // Один round-trip: планы + prefs + план. Hint выбора — последний локально известный план.
      const boot = await api.bootstrap(storage.getPlanName() || undefined)
      app.plans = boot.plans || []
      applyPrefs(boot.prefs) // заполнить prefs-cache ДО initAfterPlan (неделя/день восстанавливаются из него)
      app.muted = storage.getMuted()
      app.plan = boot.plan
      applyProgress(boot.progress) // факт выполненных дней (для read-only)
      if (storage.getPlanName() !== (boot.plan.plan ?? '')) storage.setPlanName(boot.plan.plan ?? '')
      initAfterPlan()
      setStatus('s-idle', 'План «' + boot.plan.plan + '» загружен ✓')
    } catch (e) {
      // Кэша нет (localStorage убран) — без сети не стартуем, просим обновить.
      setStatus('s-err', 'Не удалось загрузить — проверь сеть и обнови страницу')
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
    // Прогресс относится к плану+неделе — догрузим факт для дефолтной недели нового плана.
    const weeks = plan.weeks || []
    const lastWeek = storage.getLastWeek()
    const week = weeks.indexOf(lastWeek) >= 0 ? lastWeek : weeks[weeks.length - 1]
    const progOk = await refreshProgress(week)
    if (seq !== planReqSeq) return
    if (!progOk) applyProgress(null) // факт нового плана не загрузился — не показываем факт старого
    initAfterPlan()
    setStatus(progOk ? 's-idle' : 's-local', 'План «' + plan.plan + '» загружен ✓')
  } catch (e) {
    if (seq !== planReqSeq) return
    setStatus('s-err', 'План не загрузился — проверь сеть')
  }
}

function initAfterPlan(): void {
  const plan = app.plan
  if (!plan) return
  clearTimer() // черновики не храним — всегда свежая сессия (или read-only выполненного дня)
  // Восстанавливаем прошлый выбор недели/дня из серверных prefs; иначе дефолты: последняя неделя / первый день.
  const weeks = plan.weeks || []
  const lastWeek = storage.getLastWeek()
  const week = weeks.indexOf(lastWeek) >= 0 ? lastWeek : weeks[weeks.length - 1]
  const day = findDay(plan, storage.getLastDay()) || plan.days[0]
  app.session = buildForDay(day, week) // выполненный день → read-only факт, иначе пустая форма
  save()
}
