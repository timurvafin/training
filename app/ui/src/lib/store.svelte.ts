// Фасад стора — единая точка импорта для компонентов (`./store.svelte.js`).
// Логика разнесена по доменным модулям store/ (после рефакторинга god-module). Граф ацикличен:
//   appState — ядро: реактивный `app` ($state) + setStatus (лист)
//   persist  — снапшот сессии (save/flushSave/touch) + planName/isLocked (лист поверх appState/storage)
//   loading  — полноэкранный оверлей загрузки
//   restTimer— rest-таймер (по Date.now(), persist, тик)
//   session  — подходы, выбор дня/недели, завершение
//   plan     — загрузка планов и построение сессии
//   sync     — отправка факта, online/visibility-слушатели, derived-статус
//   settings — план/секрет (вынесено из sync, чтобы syncNow не зависел от plan; неделя — в Header)
// Публичный API (то, что импортируют компоненты) — ниже; внутренние связи между модулями
// идут напрямую, не через этот фасад.
export { app, setStatus } from './store/appState.svelte.js'
export { planName, isLocked, touch } from './store/persist.svelte.js'
export { runLoading } from './store/loading.js'
export {
  startRestTimer, pauseTimer, resumeTimer, toggleTimer,
  adjustTimer, skipTimer, timerView, toggleMute,
} from './store/restTimer.js'
export {
  addSet, removeSet, toggleWarmup, toggleDone,
  selectWeek, selectDay, startNew, finish, confirmFinish,
} from './store/session.svelte.js'
export { loadPlan, fetchPlan } from './store/plan.js'
export { syncNow, initOnlineListener, syncStatus } from './store/sync.js'
export { saveSettings } from './store/settings.js'
export { dayDone } from './store/progress.js'
