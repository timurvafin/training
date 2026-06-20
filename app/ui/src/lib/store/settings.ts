// Настройки (план/секрет). Выделены из sync, чтобы sync.syncNow не зависел от plan
// (saveSettings зовёт fetchPlan) — иначе цикл sync↔plan. Граф остаётся ацикличным:
// settings → {persist, plan, loading}, и никто не импортирует settings обратно.
// Неделя выбирается в ШАПКЕ (Header → selectWeek), не здесь — ветка недели удалена.
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'
import * as api from '../api.js'
import { planName } from './persist.svelte.js'
import { fetchPlan } from './plan.js'
import { runLoading, LOAD_RELOAD } from './loading.js'

export function saveSettings(newPlan?: string): void {
  const changingPlan = newPlan && newPlan !== planName()
  // confirm — ДО любых side-effects (модалка/plan_name). Секрет записи теперь серверный, тут не трогаем.
  if (changingPlan && app.session && !app.session.synced && (app.session._dirty || app.session.payload) &&
      !confirm('Сменить план «' + planName() + '» → «' + newPlan + '»? Несохранённый прогресс будет потерян.')) {
    return
  }
  app.showSettings = false
  if (changingPlan) {
    if (api.isAppsScript()) {
      storage.setPlanName(newPlan as string)
      // оверлей держится, пока новый план не загрузится и сессия не пересоберётся (не мигает)
      runLoading(LOAD_RELOAD, fetchPlan(newPlan as string))
    } else {
      setStatus('s-err', 'Сменить план можно только онлайн')
    }
  } else {
    setStatus('s-idle', 'Настройки сохранены ✓')
  }
}
