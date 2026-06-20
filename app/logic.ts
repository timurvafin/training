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

// Серверные настройки выбора (план/неделя/день/звук) — переживают перезапуск (localStorage ломается в iframe на iOS).
// `secret` — серверный SHARED_SECRET, отдаётся клиенту для payload (на сервере хранится отдельно, через setPrefs не пишется).
export interface Prefs {
  plan_name?: string
  last_week?: string
  last_day?: string
  muted?: boolean
  secret?: string
}

// Факт по выполненному дню (read-only просмотр) — derive из «Сессии»/«Кардио».
export interface ProgressSet {
  exercise: string
  set_index: number | string
  is_warmup: boolean
  reps: string
  weight: string
  rpe: string
  note: string
}
export interface ProgressDay {
  sets: ProgressSet[]
  status: string
  feel: string
  date: string
  session_id: string
  // Кардио-день (из листа «Кардио») — sets пуст, факт в полях ниже.
  cardio?: boolean
  type?: string
  duration?: string
  hr?: string
  rpe?: string
  note?: string
}
export type ProgressMap = Record<string, ProgressDay>

// Ответ единого стартового вызова bootstrap() — за один round-trip Apps Script.
export interface BootstrapResult {
  plans: string[]
  prefs: Prefs
  plan: Plan
  progress?: ProgressMap | null
}

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

// === Прогресс (read-only факт выполненных дней) — чистая группировка из values листов ===

// Ключ сортировки записей «по времени»: ISO saved_at → epoch; Date-объект из Sheets → getTime;
// нечисловое/пустое → номер строки (поздние строки = позже). Защита от строкового сравнения не-ISO.
function savedAtKey(v: unknown, rowIdx: number): number {
  if (v instanceof Date) return v.getTime()
  const t = Date.parse(String(v == null ? '' : v))
  return Number.isFinite(t) ? t : rowIdx
}

// Факт из «Сессии» по дням. Колонки (DATA-CONTRACT.md / buildSessionRows):
// 0 session_id | 1 plan | 2 week | 3 date | 4 day | 5 name | 6 set_index | 7 is_warmup | 8 reps | 9 weight | 10 rpe | 11 note | 12 status | 13 feel | 14 saved_at.
// Несколько сессий на один день → берём последнюю по saved_at (колонка 14). Сравнение plan/week — строковое c trim.
export function parseSessionProgress(values: unknown[][], planName: string, week: string): ProgressMap {
  const out: ProgressMap = {}
  if (!values || values.length < 2) return out
  const pn = String(planName ?? '').trim()
  const wk = String(week ?? '').trim()
  const byDay: Record<string, Record<string, { rows: unknown[][]; savedAt: number }>> = {}
  for (let r = 1; r < values.length; r++) {
    const row = values[r]
    if (!row) continue
    if (String(row[1] ?? '').trim() !== pn || String(row[2] ?? '').trim() !== wk) continue
    const day = String(row[4] ?? '').trim()
    if (!day) continue
    const sid = String(row[0] ?? '')
    if (!byDay[day]) byDay[day] = {}
    if (!byDay[day][sid]) byDay[day][sid] = { rows: [], savedAt: -Infinity }
    byDay[day][sid].rows.push(row)
    const sa = savedAtKey(row[14], r)
    if (sa > byDay[day][sid].savedAt) byDay[day][sid].savedAt = sa
  }
  Object.keys(byDay).forEach((day) => {
    const sessions = byDay[day]
    let bestSid = ''
    let bestSavedAt = -Infinity
    Object.keys(sessions).forEach((sid) => {
      if (bestSid === '' || sessions[sid].savedAt > bestSavedAt) { bestSid = sid; bestSavedAt = sessions[sid].savedAt }
    })
    const rows = sessions[bestSid].rows
    const sets: ProgressSet[] = rows.map((row) => ({
      exercise: String(row[5] ?? ''), set_index: (row[6] as number | string) ?? '',
      is_warmup: truthyFlag(row[7]), reps: String(row[8] ?? ''), weight: String(row[9] ?? ''),
      rpe: String(row[10] ?? ''), note: String(row[11] ?? ''),
    }))
    const first = rows[0]
    out[day] = {
      sets, status: String(first[12] ?? ''), feel: String(first[13] ?? ''),
      date: String(first[3] ?? ''), session_id: bestSid, cardio: false,
    }
  })
  return out
}

// Факт из «Кардио» по дням (одна строка на тренировку). Колонки (buildCardioRow):
// 0 session_id | 1 plan | 2 week | 3 date | 4 day | 5 type | 6 duration | 7 hr | 8 rpe | 9 note | 10 saved_at.
// Несколько записей на день → последняя по saved_at (колонка 10).
export function parseCardioProgress(values: unknown[][], planName: string, week: string): ProgressMap {
  const out: ProgressMap = {}
  if (!values || values.length < 2) return out
  const pn = String(planName ?? '').trim()
  const wk = String(week ?? '').trim()
  const byDay: Record<string, { savedAt: number; row: unknown[] }> = {}
  for (let r = 1; r < values.length; r++) {
    const row = values[r]
    if (!row) continue
    if (String(row[1] ?? '').trim() !== pn || String(row[2] ?? '').trim() !== wk) continue
    const day = String(row[4] ?? '').trim()
    if (!day) continue
    const sa = savedAtKey(row[10], r)
    if (!byDay[day] || sa > byDay[day].savedAt) byDay[day] = { savedAt: sa, row }
  }
  Object.keys(byDay).forEach((day) => {
    const row = byDay[day].row
    out[day] = {
      sets: [], status: 'completed', feel: '', date: String(row[3] ?? ''), session_id: String(row[0] ?? ''),
      cardio: true, type: String(row[5] ?? ''), duration: String(row[6] ?? ''),
      hr: String(row[7] ?? ''), rpe: String(row[8] ?? ''), note: String(row[9] ?? ''),
    }
  })
  return out
}

// Whitelist + лимиты длины для блоба PREFS. Клиент шлёт полный снимок — берём только известные ключи,
// `secret` НЕ включаем (серверный SHARED_SECRET, через setPrefs не перезаписывается). Возврат — чистый объект для перезаписи.
export function sanitizePrefs(full: Prefs | null | undefined): Prefs {
  const src = full && typeof full === 'object' ? full : {}
  const out: Prefs = {}
  if (src.plan_name != null) out.plan_name = String(src.plan_name).slice(0, 100)
  if (src.last_week != null) out.last_week = String(src.last_week).slice(0, 100)
  if (src.last_day != null) out.last_day = String(src.last_day).slice(0, 100)
  if (src.muted != null) out.muted = !!src.muted
  return out
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
