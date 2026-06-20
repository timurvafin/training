/**
 * HTML-трекер тренировок — Apps Script backend (источник на TypeScript).
 * Серверный `server.gs` ГЕНЕРИРУЕТСЯ из этого файла (ui/gen-gs.mjs: esbuild снимает типы,
 * убираются import/export → глобальные функции/константы, как требует Apps Script). Не править server.gs руками.
 *
 * `import ... from './logic'` — только для типчека (tsc); генератор его удаляет, а функции logic
 * берутся из глобального logic.gs (тоже генерируется из logic.ts). Apps Script-глобалы
 * (SpreadsheetApp/LockService/…) типизированы через @types/google-apps-script.
 *
 * Контракт: app/DATA-CONTRACT.md
 */
import {
  parsePlanValues, validatePayload, validateCardioPayload,
  buildSessionRows, buildCardioRow, sanitizePrefs, parseSessionProgress, parseCardioProgress,
  type Plan, type SessionPayload, type CardioPayload, type ValidationResult, type SaveResult, type SheetRow,
  type Prefs, type BootstrapResult, type ProgressMap,
} from './logic'

const PLAN_PREFIX = 'План: '   // план = вкладка с таким префиксом, напр. «План: fullbody»
const SESSIONS_SHEET = 'Сессии'
const SESSION_COL_COUNT = 15 // ширина «Сессии» — см. DATA-CONTRACT.md
const CARDIO_SHEET = 'Кардио'
const CARDIO_COL_COUNT = 11  // ширина «Кардио» — см. DATA-CONTRACT.md

function doGet(_e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.HTML.HtmlOutput {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Тренировка')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
}

/** Список доступных планов = вкладки «План: <name>» → массив имён (без префикса). */
function listPlans(): string[] {
  return SpreadsheetApp.getActive().getSheets()
    .map((sh) => sh.getName())
    .filter((t) => t.indexOf(PLAN_PREFIX) === 0)
    .map((t) => t.slice(PLAN_PREFIX.length).trim())
}

/** Прочитать план из вкладки «План: <planName>». Если имя не задано/не найдено — первый план. */
function getPlan(planName?: string): Plan {
  const names = listPlans()
  if (!names.length) throw new Error('Нет вкладок «' + PLAN_PREFIX + '…»')
  const name = planName && names.indexOf(planName) >= 0 ? planName : names[0]
  const sheet = SpreadsheetApp.getActive().getSheetByName(PLAN_PREFIX + name)!
  const rng = sheet.getDataRange()
  const p = parsePlanValues(rng.getValues(), rng.getNotes()) // values + заметки ячеек (контекст упражнений)
  p.plan = name // имя плана (без префикса)
  return p
}

// === Серверные настройки (prefs) и единый bootstrap ===
// ВАЖНО: single-user storage. Доступ к web app — «только я» (Workspace), поэтому ScriptProperties
// (глобальные на скрипт) корректны как пер-пользовательское хранилище. Multi-user НЕ поддерживается.
const PREFS_PROP = 'PREFS'

/** Прочитать prefs: блоб PREFS (план/неделя/день/звук) + серверный SHARED_SECRET (отдаём клиенту для payload — localStorage ломается в iframe на iOS). */
// `export` — для unit-тестов; gen-gs.mjs срезает его при генерации server.gs.
export function getPrefs(): Prefs {
  const props = PropertiesService.getScriptProperties()
  let stored: Prefs = {}
  try { stored = JSON.parse(props.getProperty(PREFS_PROP) || '{}') } catch (e) { stored = {} }
  const secret = props.getProperty('SHARED_SECRET') || ''
  return { ...sanitizePrefs(stored), secret: secret }
}

/** Перезаписать prefs целиком (клиент шлёт полный снимок) — last-write-wins, без read-modify-write → без гонок. Секрет (SHARED_SECRET) не трогаем. */
export function setPrefs(full: Prefs): { ok: true } {
  PropertiesService.getScriptProperties().setProperty(PREFS_PROP, JSON.stringify(sanitizePrefs(full)))
  return { ok: true }
}

/** Факт выполненных дней (read-only) для плана+недели: «Сессии» (силовые) + «Кардио». День → записанные подходы/поля. */
export function getProgress(planName: string, week: string): ProgressMap {
  const ss = SpreadsheetApp.getActive()
  const out: ProgressMap = {}
  const sessions = ss.getSheetByName(SESSIONS_SHEET)
  if (sessions && sessions.getLastRow() >= 2) {
    const m = parseSessionProgress(sessions.getDataRange().getValues(), planName, week)
    Object.keys(m).forEach((d) => { out[d] = m[d] })
  }
  const cardio = ss.getSheetByName(CARDIO_SHEET)
  if (cardio && cardio.getLastRow() >= 2) {
    const m = parseCardioProgress(cardio.getDataRange().getValues(), planName, week)
    Object.keys(m).forEach((d) => { out[d] = m[d] })
  }
  return out
}

/** Единый стартовый вызов: планы + prefs + план + progress за один round-trip. Приоритет плана: явный planName побеждает prefs. */
export function bootstrap(planName?: string): BootstrapResult {
  const prefs = getPrefs()
  const plan = getPlan(planName || prefs.plan_name)
  const weeks = plan.weeks || []
  // Неделя для progress — сохранённая (если валидна), иначе дефолт (последняя) — как initAfterPlan на клиенте.
  const week = prefs.last_week && weeks.indexOf(prefs.last_week) >= 0 ? prefs.last_week : weeks[weeks.length - 1] || ''
  const progress = getProgress(plan.plan || '', week)
  return { plans: listPlans(), prefs: prefs, plan: plan, progress: progress }
}

/**
 * Общий идемпотентный append в append-only лист.
 * Порядок: секрет (до lock) → валидация (до lock) → lock → проверка session_id → запись.
 * buildRowsFn(payload, nowIso) → массив строк (для кардио — одна строка в массиве).
 */
function saveRowsIdempotent<P extends { session_id?: string; shared_secret?: string }>(
  sheetName: string, colCount: number, payload: P,
  validateFn: (p: P) => ValidationResult, buildRowsFn: (p: P, now: string) => SheetRow[],
): SaveResult {
  // 1. Секрет (до lock — мусорные запросы не сериализуют запись)
  const expected = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET')
  if (expected && (!payload || payload.shared_secret !== expected)) {
    return { ok: false, code: 'forbidden', error: 'Неверный секрет' }
  }

  // 2. Валидация (до lock)
  const v = validateFn(payload)
  if (!v.ok) return v

  // 3. Lock только вокруг чтения/записи листа
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) return { ok: false, code: 'busy', error: 'Сервер занят, повтори через ↻' }
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName)
    if (!sheet) return { ok: false, code: 'no_sheet', error: 'Вкладка «' + sheetName + '» не найдена' }

    // 4. Идемпотентность — session_id уже записан в колонке A?
    //    Серверный TextFinder вместо чтения всей колонки A (O(1) на стороне Sheets, не O(n) в JS).
    const lastRow = sheet.getLastRow()
    if (lastRow >= 2) {
      const found = sheet.getRange(2, 1, lastRow - 1, 1)
        .createTextFinder(String(payload.session_id))
        .matchEntireCell(true)
        .findNext()
      if (found) return { ok: true, written: 0, duplicate: true }
    }

    // 5. Append
    const rows = buildRowsFn(payload, new Date().toISOString())
    sheet.getRange(lastRow + 1, 1, rows.length, colCount).setValues(rows)
    return { ok: true, written: rows.length }
  } catch (err) {
    return { ok: false, code: 'exception', error: String(err) }
  } finally {
    lock.releaseLock()
  }
}

/** Идемпотентно записать силовую сессию (по подходам) в лист «Сессии». payload — см. DATA-CONTRACT.md. */
// `export` нужен для юнит-тестов (ui/tests/server.test.ts); gen-gs.mjs срезает его при генерации server.gs.
export function saveSession(payload: SessionPayload): SaveResult {
  return saveRowsIdempotent(SESSIONS_SHEET, SESSION_COL_COUNT, payload, validatePayload, buildSessionRows)
}

/** Идемпотентно записать кардио-тренировку (одна строка) в лист «Кардио». payload — см. DATA-CONTRACT.md. */
export function saveCardio(payload: CardioPayload): SaveResult {
  return saveRowsIdempotent(CARDIO_SHEET, CARDIO_COL_COUNT, payload, validateCardioPayload, (p, now) => [buildCardioRow(p, now)])
}

/** Утилита для ручной проверки из редактора Apps Script. */
function _selftest(): Plan {
  const p = getPlan()
  let ex = 0
  ;(p.days || []).forEach((d) => { ex += d.exercises.length })
  Logger.log('Дней: ' + (p.days || []).length + ', упражнений всего: ' + ex)
  return p
}
