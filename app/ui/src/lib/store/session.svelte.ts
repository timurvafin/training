// Сессия: правки подходов, выбор дня/недели, завершение. Работает над app.session.
// Низкоуровневый персист (save/flushSave/touch/planName) — в persist.svelte.ts (разрыв циклов).
import { app, setStatus } from './appState.svelte.js'
import * as storage from '../storage.js'
import { buildState, buildPayload, findDay, collectSets, DEFAULT_REST } from '../state.js'
import { startRestTimer, clearTimer } from './restTimer.js'
import { syncNow } from './sync.js'
import { save, flushSave, touch, planName } from './persist.svelte.js'
import { buildForDay, refreshProgress } from './progress.js'
import type { SessionExercise, SessionSet } from '../types.ts'

// ——— подходы ———
// Структурные изменения (добавить/удалить подход, тоггл done/warmup) сохраняем надёжно:
// touch() обновит _dirty/сбросит payload, flushSave() сразу запишет снапшот (не дебаунсим).
export function addSet(ex: SessionExercise): void {
  ex.sets.push({ reps: '', weight: '', rpe: '', is_warmup: false, done: false, target_reps: '', note: '' })
  touch(); flushSave()
}
export function removeSet(ex: SessionExercise): void {
  if (ex.sets.length <= 1) return
  const last = ex.sets[ex.sets.length - 1]
  if ((last.done || last.reps || last.rpe) && !confirm('Удалить заполненный последний подход?')) return
  ex.sets.pop()
  touch(); flushSave()
}
export function toggleWarmup(set: SessionSet): void { set.is_warmup = !set.is_warmup; touch(); flushSave() }
export function toggleDone(set: SessionSet): void {
  const becoming = !set.done // переход «в done» (для авто-старта таймера)
  set.done = !set.done
  // Авто-старт rest-таймера при отметке ✓ — для ЛЮБОГО подхода, включая разминку:
  // у разминок в плане тоже своя длительность отдыха (отсчёт от set.rest, иначе дефолт).
  if (becoming) {
    startRestTimer(exNameOfSet(set), set.rest ?? DEFAULT_REST)
  }
  touch(); flushSave()
}

// Имя упражнения, которому принадлежит данный set (по ссылке) — для подписи таймера.
function exNameOfSet(set: SessionSet): string {
  const exs = (app.session && app.session.exercises) || []
  for (const ex of exs) {
    if (ex.sets && ex.sets.indexOf(set) >= 0) return ex.name || ''
  }
  return ''
}

// ——— выбор недели/дня ———
// Есть что терять, если сессия не отправлена и в ней либо ручной прогресс, либо замороженный payload.
function guardUnsynced(): boolean {
  const s = app.session
  if (s && !s.synced && (s._dirty || s.payload)) {
    return !confirm('Сменить день/неделю? Несохранённый прогресс текущей тренировки будет потерян.')
  }
  return false
}
// Смена недели/дня строит НОВУЮ сессию. Это допустимо даже когда текущая залочена
// (synced/finalizing): завершённый день уже отправлен на сервер, а переход на другой
// день/неделю — это начало отдельной сессии (она не залочена). От потери прогресса
// защищает guardUnsynced(): при synced терять нечего, подтверждение не всплывает.
export async function selectWeek(week: string): Promise<void> {
  if (!app.session || !app.plan) return
  if (week === app.session.week) return // та же неделя — не пересобираем (сохраняем locked-вид)
  if (guardUnsynced()) return
  const dayId = app.session.day_id
  const day = findDay(app.plan, dayId) || app.plan.days[0]
  // Блокирующе грузим факт ДО показа дня — иначе выполненный день мелькнёт editable (риск дубля).
  // Лёгкий оверлей на контенте, пока ждём факт (round-trip ~1с).
  setStatus('s-sync', 'Загрузка недели…')
  app.weekLoading = true
  try {
    const ok = await refreshProgress(week)
    if (!ok) { setStatus('s-err', 'Нет сети — неделя не переключена'); return }
    clearTimer() // переключаемся — таймер прошлой сессии больше не релевантен
    storage.setLastWeek(week) // запомнить выбор недели для следующего запуска
    app.session = buildForDay(day, week) // read-only, если день этой недели выполнен
    save()
    setStatus('s-idle', 'Неделя «' + week + '»')
  } finally {
    app.weekLoading = false
  }
}
export function selectDay(dayId: string): void {
  if (!app.session || !app.plan) return
  if (dayId === app.session.day_id) return // тот же день — не пересобираем (сохраняем locked-вид)
  // Несуществующий день отсекаем ДО guardUnsynced — иначе пользователь зря подтвердит потерю прогресса.
  const day = findDay(app.plan, dayId)
  if (!day) return
  if (guardUnsynced()) return
  clearTimer() // смена дня — таймер прошлого упражнения больше не релевантен
  storage.setLastDay(dayId) // запомнить выбор дня для следующего запуска
  app.session = buildForDay(day, app.session.week) // выполненный день → read-only факт
  save()
}

// ——— завершение ———
export function startNew(): void {
  if (!app.session || !app.plan) return
  if (app.session._submitting) return
  clearTimer() // новая попытка — без остатков таймера прошлой
  const day = findDay(app.plan, app.session.day_id) || app.plan.days[0]
  app.session = buildState(day, app.session.week, planName())
  app.showRetry = false // убрать залипший ↻ от прошлой попытки
  save()
}
export function finish(): void {
  const s = app.session
  if (!s) return
  if (s.synced) { setStatus('s-ok', 'Уже отправлено ✓'); return }
  if (s.cardio) {
    if (!s.duration) { setStatus('s-err', 'Укажи длительность'); return }
    if (!confirm('Завершить кардио «' + s.day_name + '» (' + s.week + ')?\n\nПосле отправки запись закрывается.')) return
    clearTimer() // тренировка завершается — таймер больше не нужен
    s.payload = buildPayload(s, storage.getSecret())
    s.finalizing = true
    save()
    syncNow()
    return
  }
  if (!collectSets(s.exercises).length) { setStatus('s-err', 'Нет заполненных подходов — отметь ✓ или впиши повторы'); return }
  app.showFinish = true
}
export function confirmFinish(feel: number): void {
  const s = app.session
  if (!s || s.cardio) return // FinishSheet (оценка) — только для силовой; кардио идёт через finish()
  s.feel = feel
  app.showFinish = false
  clearTimer() // тренировка завершается — таймер больше не нужен
  // фиксируем (замораживаем) payload и блокируем UI на время финализации
  s.payload = buildPayload(s, storage.getSecret())
  s.finalizing = true
  save()
  syncNow()
}
