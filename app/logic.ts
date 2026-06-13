/**
 * Чистая логика трекера тренировок (без SpreadsheetApp / DOM / сети).
 * ЕДИНЫЙ ИСТОЧНИК для трёх потребителей:
 *  - Клиент (Vite/Svelte): импортирует этот файл напрямую (ESM .ts).
 *  - Node-тесты: tests/logic.test.ts импортирует напрямую (Node strip-types).
 *  - Apps Script сервер: `logic.gs` ГЕНЕРИРУЕТСЯ из этого файла (ui/gen-gs.mjs:
 *    esbuild снимает типы + убираются `export` → функции становятся глобальными). Не править logic.gs руками.
 *
 * Контракт данных — DATA-CONTRACT.md. Ключи везде на английском.
 */

export interface Cell {
  reps: string
  weight: string
}

// Дискриминированный по литералу `ok` — TS сужает ветки if (res.ok) без кастов.
export interface ValidationError {
  ok: false
  code: string
  error: string
}
export type ValidationResult = { ok: true } | ValidationError

// Результат saveSession/saveCardio (server.ts saveRowsIdempotent): успех либо ошибка валидации/записи.
// Единый источник для сервера (server.ts) и клиента (ui/types.ts реэкспортит) — не дублировать.
export type SaveResult = { ok: true; written: number; duplicate?: boolean } | ValidationError

export interface PlanSet {
  is_warmup: boolean
  rest?: number
  byWeek: Record<string, Cell>
}

export interface PlanExercise {
  exercise_id: string
  name: string
  note: string
  sets: PlanSet[]
}

export interface PlanDay {
  day_id: string
  day_name: string
  exercises: PlanExercise[]
}

export interface Plan {
  weeks: string[]
  days: PlanDay[]
  plan?: string
}

export interface SessionSet {
  name?: string
  exercise_id?: string
  set_index?: number | string
  is_warmup?: boolean
  reps?: string
  weight?: string
  rpe?: string
  note?: string
  done?: boolean
}

export interface SessionPayload {
  session_id: string
  plan?: string
  week?: string
  date?: string
  day?: string
  status?: string
  feel?: string
  sets: SessionSet[]
}

export interface CardioPayload {
  session_id: string
  plan?: string
  week?: string
  date?: string
  day?: string
  type?: string
  duration?: string
  hr?: string
  rpe?: string
  note?: string
}

// Тип строки листа (значения ячеек).
export type SheetRow = (string | number)[]

// Флаг разминки: "yes"/"да"/"true"/"1" → true.
export function truthyFlag(v: unknown): boolean {
  const s = String(v == null ? '' : v).trim().toLowerCase()
  return s === 'yes' || s === 'да' || s === 'true' || s === '1'
}

// Разбор ячейки «повт×вес» → {reps, weight}. Разделитель × / x / *  (только первый).
// "8×190"→{8,190}, "10"→{10,''}, "12×90lbs"→{12,90lbs}, "8-10×190"→{8-10,190}, "10×тонк"→{10,тонк}.
export function parseCell(cell: unknown): Cell | null {
  const s = String(cell == null ? '' : cell).trim()
  if (!s || s === '—' || s === '–' || s === '-') return null // подхода в эту неделю не было
  const i = s.search(/[×xX*]/)
  if (i < 0) return { reps: s, weight: '' }
  return { reps: s.slice(0, i).trim(), weight: s.slice(i + 1).trim() }
}

// Заголовок колонки D — опциональный «Отдых» (rest, секунды)? Авто-детект backward-compat.
// Старые планы без этой колонки: header[3] — первая неделя → недели с col 3.
// Новые планы: header[3] ∈ {«отдых», «rest», «отдых, с», …} → rest-колонка (col 3), недели с col 4.
function isRestHeader(h: unknown): boolean {
  const s = String(h == null ? '' : h).trim().toLowerCase()
  if (!s) return false
  return s === 'отдых' || s === 'rest' || s.indexOf('отдых') === 0 || s.indexOf('rest') === 0
}

// Парсинг ячейки отдыха → число секунд или undefined (пусто/нечисловое/вне диапазона).
// «90»/«90с»/«90 sec» → 90; «1:30» (мм:сс) → 90; «2 мин»/«2 min» → 120.
// Диапазон: 0 < n ≤ 3600, иначе undefined. «—»/пусто → undefined.
function parseRest(v: unknown): number | undefined {
  const s = String(v == null ? '' : v).trim()
  if (!s) return undefined
  let n: number
  const mmss = s.match(/^(\d+):(\d{1,2})$/) // мм:сс
  if (mmss) {
    n = Number(mmss[1]) * 60 + Number(mmss[2])
  } else {
    const m = s.match(/\d+(?:[.,]\d+)?/)
    if (!m) return undefined
    n = Number(m[0].replace(',', '.'))
    if (/мин|min/i.test(s)) n *= 60 // минуты → секунды (мин/min)
  }
  if (!Number.isFinite(n) || !(n > 0 && n <= 3600)) return undefined
  return n
}

// values — 2D массив широкой вкладки «План» (по подходам).
// Старый формат: A=день(номер) | B=name (он же ключ) | C=warmup(да/пусто) | D+=Неделя N (повт×вес).
// Новый формат: …+ D=Отдых (rest, сек), недели сдвинуты на E+. Авто-детект по header[3].
// notes — опциональный 2D массив заметок ячеек (getNotes), параллельный values.
// Заметка с колонки B первой строки упражнения → ex.note (контекст: отдых/RIR/техника).
export function parsePlanValues(values: unknown[][], notes?: unknown[][]): Plan {
  if (!values || values.length < 2) throw new Error('Вкладка «План» пуста')
  const header = values[0]

  // Авто-детект rest-колонки в D (индекс 3). Есть → restCol=3, недели с 4; нет → недели с 3.
  const hasRest = isRestHeader(header[3])
  const restCol = hasRest ? 3 : -1
  const firstWeekCol = hasRest ? 4 : 3

  const weekCols: { label: string; col: number }[] = []
  for (let c = firstWeekCol; c < header.length; c++) {
    const w = String(header[c] || '').trim()
    if (w) weekCols.push({ label: w, col: c })
  }
  if (!weekCols.length) throw new Error('Нет колонок недель в плане')

  const plan: Plan = { weeks: weekCols.map((w) => w.label), days: [] }
  const dayMap: Record<string, PlanDay & { _ex?: Record<string, PlanExercise> }> = {}
  for (let r = 1; r < values.length; r++) {
    const row = values[r]
    const day = String(row[0] || '').trim()
    const name = String(row[1] || '').trim()
    if (!day || !name) continue // пустые/неполные строки пропускаем
    if (!dayMap[day]) {
      dayMap[day] = { day_id: day, day_name: day, exercises: [], _ex: {} }
      plan.days.push(dayMap[day])
    }
    const d = dayMap[day]
    if (!d._ex![name]) {
      const note = notes && notes[r] ? String(notes[r][1] || '').trim() : ''
      d._ex![name] = { exercise_id: name, name: name, note: note, sets: [] } // ключ = название
      d.exercises.push(d._ex![name])
    }
    const ex = d._ex![name]
    const byWeek: Record<string, Cell> = {}
    weekCols.forEach((w) => {
      const cell = parseCell(row[w.col])
      if (cell) byWeek[w.label] = cell
    })
    const set: PlanSet = { is_warmup: truthyFlag(row[2]), byWeek: byWeek }
    if (restCol >= 0) {
      const rest = parseRest(row[restCol])
      if (rest !== undefined) set.rest = rest
    }
    ex.sets.push(set)
  }
  plan.days.forEach((d) => { delete (d as PlanDay & { _ex?: unknown })._ex })
  // Пустой план (нет дней или ни одного упражнения) → клиент падает на days[0].
  if (plan.days.length === 0 || !plan.days.some((d) => d.exercises.length > 0)) {
    throw new Error('В плане нет дней/упражнений')
  }
  return plan
}

// Валидация payload для saveSession. Возвращает {ok:true} или {ok:false, code, error}.
export function validatePayload(p: SessionPayload | null | undefined): ValidationResult {
  if (!p || typeof p !== 'object') return { ok: false, code: 'bad_payload', error: 'Пустой payload' }
  if (!p.session_id) return { ok: false, code: 'no_session_id', error: 'Нет session_id' }
  if (String(p.session_id).length > 64) return { ok: false, code: 'too_long', error: 'session_id слишком длинный' }
  if (p.plan != null && String(p.plan).length > 100) return { ok: false, code: 'too_long', error: 'plan слишком длинный' }
  if (p.week != null && String(p.week).length > 100) return { ok: false, code: 'too_long', error: 'week слишком длинный' }
  if (p.day != null && String(p.day).length > 100) return { ok: false, code: 'too_long', error: 'day слишком длинный' }
  if (!Array.isArray(p.sets) || p.sets.length === 0) return { ok: false, code: 'no_sets', error: 'Нет подходов' }
  if (p.sets.length > 200) return { ok: false, code: 'too_big', error: 'Слишком много подходов' }
  if (p.status != null && p.status !== '' && p.status !== 'completed' && p.status !== 'partial') {
    return { ok: false, code: 'bad_status', error: 'Недопустимый статус' }
  }
  if (p.feel !== '' && p.feel != null) {
    const f = Number(p.feel)
    if (!(f >= 1 && f <= 10)) return { ok: false, code: 'bad_feel', error: 'Самочувствие вне 1–10' }
  }
  for (let i = 0; i < p.sets.length; i++) {
    const s = p.sets[i]
    if (!s || (!s.name && !s.exercise_id)) return { ok: false, code: 'bad_set', error: 'Подход без названия (#' + i + ')' }
    if (s.name != null && String(s.name).length > 200) return { ok: false, code: 'too_long', error: 'Название: слишком длинно (#' + i + ')' }
    if (s.note != null && String(s.note).length > 500) return { ok: false, code: 'too_long', error: 'Заметка: слишком длинно (#' + i + ')' }
    // reps/weight — свободный текст; только лимит длины
    if (s.reps != null && String(s.reps).length > 40) return { ok: false, code: 'bad_reps', error: 'Повторы: слишком длинно (#' + i + ')' }
    if (s.weight != null && String(s.weight).length > 40) return { ok: false, code: 'bad_weight', error: 'Вес: слишком длинно (#' + i + ')' }
    if (s.rpe !== '' && s.rpe != null) {
      const rpe = Number(s.rpe)
      if (!(rpe >= 1 && rpe <= 10)) return { ok: false, code: 'bad_rpe', error: 'RPE вне 1-10 (#' + i + ')' }
    }
  }
  return { ok: true }
}

// existingIds — массив session_id уже в колонке A «Сессии».
export function findDuplicate(existingIds: unknown[], sessionId: unknown): boolean {
  for (let i = 0; i < existingIds.length; i++) {
    if (String(existingIds[i]) === String(sessionId)) return true
  }
  return false
}

// Защита от формул-инъекции в Sheets: текст, начинающийся с = + - @, делаем литералом.
// Опасный префикс детектим ПОСЛЕ обрезки ведущих пробелов/таб/переводов строк
// (обход формулы ведущим пробелом), но кавычку ставим к ОРИГИНАЛУ.
export function sanitizeCell(v: unknown): string {
  const s = v == null ? '' : String(v)
  const t = s.replace(/^[\s﻿]+/, '')
  return /^[=+\-@]/.test(t) ? "'" + s : s
}

// payload + момент времени → 2D строки для «Сессии» (порядок колонок = DATA-CONTRACT.md).
// session_id | plan | week | date | day | name | set_index | is_warmup | reps | weight | rpe | note | status | feel | saved_at
export function buildSessionRows(payload: SessionPayload, nowIso: string): SheetRow[] {
  return payload.sets.map((s) => {
    return [
      sanitizeCell(payload.session_id),
      sanitizeCell(payload.plan),
      sanitizeCell(payload.week),
      sanitizeCell(payload.date),
      sanitizeCell(payload.day),
      sanitizeCell(s.name),
      Number(s.set_index) || '',
      s.is_warmup ? 'yes' : '',
      sanitizeCell(s.reps),
      sanitizeCell(s.weight),
      s.rpe === '' || s.rpe == null ? '' : sanitizeCell(s.rpe),
      sanitizeCell(s.note),
      payload.status || '',
      payload.feel === '' || payload.feel == null ? '' : sanitizeCell(payload.feel),
      nowIso,
    ]
  })
}

// STATE.exercises → массив подходов для payload.
// Подход учитывается, если отмечен «выполнено» ИЛИ заполнены повторы. set_index — внутри упражнения.
// Разминочные подходы (is_warmup) тоже попадают в лог.
export function collectSets(exercises: { exercise_id: string; name: string; sets: SessionSet[] }[]): SessionSet[] {
  const out: SessionSet[] = []
  exercises.forEach((ex) => {
    let k = 0
    ex.sets.forEach((s) => {
      if (s.done || (s.reps !== '' && s.reps != null)) {
        k++
        out.push({
          exercise_id: ex.exercise_id, name: ex.name, set_index: k,
          is_warmup: !!s.is_warmup, reps: s.reps, weight: s.weight, rpe: s.rpe, note: '',
        })
      }
    })
  })
  return out
}

// === Кардио (отдельный лог «Кардио») ===
export function validateCardioPayload(p: CardioPayload | null | undefined): ValidationResult {
  if (!p || typeof p !== 'object') return { ok: false, code: 'bad_payload', error: 'Пустой payload' }
  if (!p.session_id) return { ok: false, code: 'no_session_id', error: 'Нет session_id' }
  if (String(p.session_id).length > 64) return { ok: false, code: 'too_long', error: 'session_id слишком длинный' }
  if (p.plan != null && String(p.plan).length > 100) return { ok: false, code: 'too_long', error: 'plan слишком длинный' }
  if (p.week != null && String(p.week).length > 100) return { ok: false, code: 'too_long', error: 'week слишком длинный' }
  if (p.day != null && String(p.day).length > 100) return { ok: false, code: 'too_long', error: 'day слишком длинный' }
  if (p.note != null && String(p.note).length > 500) return { ok: false, code: 'too_long', error: 'note слишком длинный' }
  if (p.duration === '' || p.duration == null) return { ok: false, code: 'no_duration', error: 'Нет длительности' }
  const d = Number(p.duration)
  if (!(d > 0 && d < 1000)) return { ok: false, code: 'bad_duration', error: 'Длительность вне диапазона' }
  if (p.hr !== '' && p.hr != null) { const h = Number(p.hr); if (!(h > 0 && h < 300)) return { ok: false, code: 'bad_hr', error: 'Пульс вне диапазона' } }
  if (p.rpe !== '' && p.rpe != null) { const r = Number(p.rpe); if (!(r >= 1 && r <= 10)) return { ok: false, code: 'bad_rpe', error: 'RPE вне 1–10' } }
  return { ok: true }
}

// → 1 строка для листа «Кардио» (порядок колонок = DATA-CONTRACT.md).
export function buildCardioRow(payload: CardioPayload, nowIso: string): SheetRow {
  return [
    sanitizeCell(payload.session_id),
    sanitizeCell(payload.plan),
    sanitizeCell(payload.week),
    sanitizeCell(payload.date),
    sanitizeCell(payload.day),
    sanitizeCell(payload.type),
    payload.duration ?? '',
    payload.hr === '' || payload.hr == null ? '' : payload.hr,
    payload.rpe === '' || payload.rpe == null ? '' : payload.rpe,
    sanitizeCell(payload.note),
    nowIso,
  ]
}
