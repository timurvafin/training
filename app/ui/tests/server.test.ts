import { describe, it, expect, afterEach, vi } from 'vitest'
import { saveSession, saveCardio } from '../../server.ts'
import type { SessionPayload, CardioPayload } from '../../logic.ts'

// Юнит-тесты идемпотентного append (saveRowsIdempotent через saveSession/saveCardio). Все Apps Script-глобалы
// замоканы — проверяем порядок веток: секрет (до lock) → валидация (до lock) → lock → дубликат → запись,
// + exception при записи (releaseLock в finally). tryLock/releaseLock — vi.fn, чтобы проверять «до lock».

function validPayload(extra: Record<string, unknown> = {}): SessionPayload {
  return {
    session_id: 'sess-1', plan: 'fullbody', week: 'Неделя 1', date: '2026-06-10',
    day: 'День 1', status: 'completed', feel: '8',
    sets: [{ name: 'Жим ногами', set_index: 1, is_warmup: false, reps: '10', weight: '120', rpe: '8', note: '' }],
    shared_secret: 'topsecret',
    ...extra,
  } as SessionPayload
}
function validCardio(extra: Record<string, unknown> = {}): CardioPayload {
  return {
    session_id: 'card-1', plan: 'fullbody', week: 'Неделя 1', date: '2026-06-10',
    day: 'Кардио 1', type: 'Ходьба с уклоном', duration: '40', hr: '130', rpe: '6', note: '',
    shared_secret: 'topsecret',
    ...extra,
  } as CardioPayload
}

// secret — значение SHARED_SECRET (null = секрет не задан); lockOk — удалось ли взять lock;
// sheet=null — вкладки нет; throwOnWrite — setValues бросает (ветка exception); иначе sheet переопределяет mock.
function mockGas({ secret = null as string | null, lockOk = true, sheet = {} as Record<string, unknown> | null, throwOnWrite = false } = {}) {
  const captured: { rows: unknown } = { rows: null }
  const tryLock = vi.fn((_ms: number) => lockOk)
  const releaseLock = vi.fn()
  const g = globalThis as Record<string, unknown>
  g.PropertiesService = { getScriptProperties: () => ({ getProperty: (_k: string) => secret }) }
  g.LockService = { getScriptLock: () => ({ tryLock, releaseLock }) }
  const defaultSheet = {
    getLastRow: () => 1,
    getRange: () => ({
      createTextFinder: () => ({ matchEntireCell: () => ({ findNext: () => null }) }),
      setValues: (rows: unknown) => { if (throwOnWrite) throw new Error('boom'); captured.rows = rows },
    }),
  }
  g.SpreadsheetApp = {
    getActive: () => ({ getSheetByName: (_n: string) => (sheet === null ? null : { ...defaultSheet, ...sheet }) }),
  }
  return { captured, tryLock, releaseLock }
}

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  delete g.PropertiesService
  delete g.LockService
  delete g.SpreadsheetApp
})

describe('saveRowsIdempotent (через saveSession)', () => {
  it('forbidden: неверный секрет — проверка ДО взятия lock', () => {
    const { tryLock } = mockGas({ secret: 'topsecret' })
    expect(saveSession(validPayload({ shared_secret: 'wrong' }))).toMatchObject({ ok: false, code: 'forbidden' })
    expect(tryLock).not.toHaveBeenCalled()
  })

  it('валидация (пустые sets) — ДО взятия lock', () => {
    const { tryLock } = mockGas({ secret: 'topsecret' })
    expect(saveSession(validPayload({ sets: [] }))).toMatchObject({ ok: false, code: 'no_sets' })
    expect(tryLock).not.toHaveBeenCalled()
  })

  it('busy: не удалось взять lock', () => {
    mockGas({ secret: 'topsecret', lockOk: false })
    expect(saveSession(validPayload())).toMatchObject({ ok: false, code: 'busy' })
  })

  it('no_sheet: вкладки нет', () => {
    mockGas({ secret: 'topsecret', sheet: null })
    expect(saveSession(validPayload())).toMatchObject({ ok: false, code: 'no_sheet' })
  })

  it('duplicate: session_id уже записан → written 0', () => {
    mockGas({
      secret: 'topsecret',
      sheet: {
        getLastRow: () => 5,
        getRange: () => ({
          createTextFinder: () => ({ matchEntireCell: () => ({ findNext: () => ({}) }) }),
          setValues: () => {},
        }),
      },
    })
    expect(saveSession(validPayload())).toMatchObject({ ok: true, duplicate: true, written: 0 })
  })

  it('success: новая запись → строки записаны, lock освобождён', () => {
    const { captured, releaseLock } = mockGas({ secret: 'topsecret' })
    expect(saveSession(validPayload())).toMatchObject({ ok: true, written: 1 })
    expect(captured.rows).toHaveLength(1)
    expect(releaseLock).toHaveBeenCalled()
  })

  it('exception при записи → code exception, lock освобождён (finally)', () => {
    const { releaseLock } = mockGas({ secret: 'topsecret', throwOnWrite: true })
    expect(saveSession(validPayload())).toMatchObject({ ok: false, code: 'exception' })
    expect(releaseLock).toHaveBeenCalled()
  })

  it('секрет не задан на сервере → запись разрешена без проверки', () => {
    mockGas({ secret: null })
    expect(saveSession(validPayload({ shared_secret: '' }))).toMatchObject({ ok: true })
  })
})

describe('saveCardio', () => {
  it('success: одна строка в «Кардио»', () => {
    const { captured } = mockGas({ secret: 'topsecret' })
    expect(saveCardio(validCardio())).toMatchObject({ ok: true, written: 1 })
    expect(captured.rows).toHaveLength(1)
  })

  it('валидация: пустая длительность → no_duration', () => {
    mockGas({ secret: 'topsecret' })
    expect(saveCardio(validCardio({ duration: '' }))).toMatchObject({ ok: false, code: 'no_duration' })
  })
})
