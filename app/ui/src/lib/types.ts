// Общие типы UI-слоя трекера. Формы взяты по факту из state.ts / store/*.ts /
// timer.ts / logic.ts — не выдуманы. Типы плана (Plan/PlanDay/PlanExercise/PlanSet/Cell),
// payload- и результат-типы — единый источник logic.ts; здесь только re-export, чтобы не дублировать.
export type {
  Cell,
  Plan,
  PlanDay,
  PlanExercise,
  PlanSet,
  SessionPayload,
  CardioPayload,
  ValidationResult,
  SaveResult,
} from '../../../logic.ts'

import type { SessionPayload, CardioPayload } from '../../../logic.ts'

// Замороженный payload к отправке — фактически всегда несёт shared_secret (logic-типы его не описывают,
// поэтому buildPayload() возвращает именно этот тип, без cast'ов в коде и тестах).
export type FrozenPayload = (SessionPayload | CardioPayload) & { shared_secret: string }

// ——— Сессия (STATE), строится buildState() в state.js ———

// Один подход в UI-сессии (силовая). Форма из buildState()/addSet() (state.js, store.svelte.js).
// Отличается от logic.SessionSet (payload-форма): здесь поля рабочего ввода + target_reps/done/rest.
export interface SessionSet {
  reps: string
  weight: string
  rpe: string
  is_warmup: boolean
  rest?: number
  done: boolean
  target_reps: string
  note?: string
}

// Упражнение в UI-сессии (силовая).
export interface SessionExercise {
  exercise_id: string
  name: string
  note: string
  sets: SessionSet[]
}

// Текущая сессия (STATE), строится buildState(). Дискриминированный union по `cardio` —
// TS сужает ветки if (s.cardio) автоматически, без опциональных полей и кастов.
interface SessionCommon {
  session_id: string
  plan: string
  week: string
  day_id: string
  day_name: string
  date: string
  status: string
  synced: boolean
  finalizing: boolean
  payload: FrozenPayload | null
  _submitting: boolean
  _dirty: boolean
  exercises: SessionExercise[]
}

// Силовая: feel — оценка 1–10 (из FinishSheet приходит числом; buildState инициализирует '').
export interface StrengthSession extends SessionCommon {
  cardio: false
  feel: string | number
}

// Кардио: exercises = [] (форма работает с полями ниже, не с подходами).
export interface CardioSession extends SessionCommon {
  cardio: true
  cardio_name: string
  cardio_note: string
  type: string
  duration: string
  hr: string
  rpe: string
}

export type Session = StrengthSession | CardioSession

// ——— Rest-таймер (timer.js): абсолютные моменты времени (ms) ———
export interface TimerState {
  exName: string
  total: number
  startedAt: number
  targetEndAt: number
  pausedAt: number | null
  finished: boolean
  overStartedAt: number | null
}

// Производный вид таймера (timer.derive) — для UI.
export interface TimerView {
  remaining: number
  over: number
  running: boolean
  finished: boolean
  progress: number
}

// ——— Прочее состояние стора ———
export interface Status {
  cls: string
  msg: string
}

export interface LoadingState {
  on: boolean
  label: string
  pct: number
}

// Шаг анимации полноэкранной загрузки (runLoading).
export interface LoadStep {
  label: string
  pct: number
  delayMs?: number
}

// Статус синхронизации для SyncLine.
export type SyncState = 'idle' | 'sync' | 'ok' | 'off'

// Корневой реактивный стор (app в store.svelte.js).
export interface AppState {
  plans: string[]
  plan: import('../../../logic.ts').Plan | null
  session: Session | null
  status: Status
  showRetry: boolean
  showSettings: boolean
  showFinish: boolean
  timer: TimerState | null
  now: number
  loading: LoadingState
  muted: boolean
}
