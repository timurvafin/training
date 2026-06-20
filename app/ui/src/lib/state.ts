// Чистые трансформы состояния сессии. collectSets — из канонического logic.ts
// (app/logic.ts — единый источник; серверный logic.gs генерируется из него); зеркало удалено.
import { collectSets } from '../../../logic.ts'
import type { Plan, PlanDay, PlanExercise, PlanSet, Cell, Session, SessionExercise, SessionSet, FrozenPayload, ProgressDay } from './types.ts'

export { collectSets }

// Дефолтная длительность отдыха (сек), если у подхода нет своего rest.
export const DEFAULT_REST = 90

export function uuid(): string {
  try {
    return crypto.randomUUID()
  } catch (e) {
    return 'sess-' + Date.now() + '-' + Math.floor(Math.random() * 1e9)
  }
}

export function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => (n < 10 ? '0' : '') + n
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}

// День — кардио, если его id/имя начинается с «Кардио».
export function isCardio(day: PlanDay): boolean {
  return String((day && (day.day_id || day.day_name)) || '').toLowerCase().indexOf('кардио') === 0
}

export function findDay(plan: Plan, dayId: string): PlanDay | undefined {
  return (plan?.days || []).find((d) => d.day_id === dayId)
}

// Построить пустую сессию для дня+недели. Форма STATE как в vanilla index.html.
export function buildState(day: PlanDay, week: string, planNm: string): Session {
  if (isCardio(day)) {
    const cex = (day.exercises[0] || {}) as Partial<PlanExercise>
    const cs = ((cex.sets && cex.sets[0]) || {}) as Partial<PlanSet>
    const t = ((cs.byWeek && cs.byWeek[week]) || {}) as Partial<Cell>
    const dur = (String(t.reps || '').match(/\d+/) || [''])[0] // «40 мин» → «40»
    return {
      session_id: uuid(), plan: planNm, week, day_id: day.day_id, day_name: day.day_name, date: todayLocal(),
      cardio: true, cardio_name: cex.name || 'Кардио', cardio_note: cex.note || '',
      type: 'Ходьба с уклоном', duration: dur, hr: '', rpe: '',
      status: 'completed', synced: false, finalizing: false, payload: null, _submitting: false, _dirty: false, exercises: [],
    }
  }
  return {
    session_id: uuid(), plan: planNm, week, day_id: day.day_id, day_name: day.day_name, date: todayLocal(),
    cardio: false, status: 'completed', feel: '', synced: false, finalizing: false, payload: null, _submitting: false, _dirty: false,
    exercises: day.exercises
      .map((ex): SessionExercise => ({
        exercise_id: ex.exercise_id, name: ex.name, note: ex.note || '',
        sets: ex.sets
          .filter((s) => s.byWeek && s.byWeek[week])
          .map((s): SessionSet => {
            const t = s.byWeek[week]
            return { reps: '', weight: t.weight || '', rpe: '', is_warmup: !!s.is_warmup, rest: s.rest ?? DEFAULT_REST, done: false, target_reps: t.reps || '' }
          }),
      }))
      .filter((ex) => ex.sets.length),
  }
}

// Построить READ-ONLY сессию из факта (progress) — просмотр выполненного дня.
// synced=true → isLocked() → весь UI заблокирован (инпуты disabled, «Завершить» скрыт). day — из плана (для имени/кардио-заметки).
export function buildStateFromProgress(day: PlanDay, week: string, planNm: string, prog: ProgressDay): Session {
  const base = {
    session_id: prog.session_id || uuid(), plan: planNm, week, day_id: day.day_id, day_name: day.day_name,
    date: prog.date || todayLocal(), status: prog.status || 'completed',
    synced: true, finalizing: false, payload: null as FrozenPayload | null, _submitting: false, _dirty: false,
  }
  if (prog.cardio || isCardio(day)) {
    const cex = (day.exercises[0] || {}) as Partial<PlanExercise>
    return {
      ...base, cardio: true, cardio_name: cex.name || 'Кардио', cardio_note: cex.note || '',
      type: prog.type || '', duration: prog.duration || '', hr: prog.hr || '', rpe: prog.rpe || '', exercises: [],
    }
  }
  // Силовая: группируем факт по упражнению (в порядке появления); note берём из плана, если есть.
  const noteByName: Record<string, string> = {}
  ;(day.exercises || []).forEach((ex) => { noteByName[ex.name] = ex.note || '' })
  const exMap: Record<string, SessionExercise> = {}
  const order: string[] = []
  ;(prog.sets || []).forEach((s) => {
    if (!exMap[s.exercise]) {
      exMap[s.exercise] = { exercise_id: s.exercise, name: s.exercise, note: noteByName[s.exercise] || '', sets: [] }
      order.push(s.exercise)
    }
    exMap[s.exercise].sets.push({
      reps: s.reps || '', weight: s.weight || '', rpe: s.rpe || '', is_warmup: !!s.is_warmup,
      done: true, target_reps: '', note: s.note || '',
    })
  })
  return { ...base, cardio: false, feel: prog.feel || '', exercises: order.map((n) => exMap[n]) }
}

// Заморозить снимок для отправки. Кардио → лист «Кардио», иначе → «Сессии».
// Возвращает FrozenPayload (несёт shared_secret). feel сериализуем в строку (в сессии — число из FinishSheet).
export function buildPayload(state: Session, secret: string): FrozenPayload | null {
  if (state.cardio) {
    if (!state.duration) return null
    return {
      shared_secret: secret || '', session_id: state.session_id,
      plan: state.plan, week: state.week, date: state.date || todayLocal(), day: state.day_name,
      type: state.type, duration: state.duration, hr: state.hr || '', rpe: state.rpe || '', note: '',
    }
  }
  const sets = collectSets(state.exercises)
  if (!sets.length) return null
  return {
    shared_secret: secret || '', session_id: state.session_id,
    plan: state.plan, week: state.week, date: state.date || todayLocal(),
    day: state.day_name, status: state.status, feel: state.feel == null ? '' : String(state.feel), sets,
  }
}
