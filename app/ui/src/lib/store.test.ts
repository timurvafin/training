import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Тесты стора через ПУБЛИЧНЫЙ фасад store.svelte.ts (после split фасад тот же — тесты должны
// остаться зелёными). api отдаёт mock (gas.ts MOCK_PLAN) вне Apps Script; offline эмулируется
// ключом localStorage 'mock_offline'. Каждый тест — свежий модуль (resetModules) + чистый localStorage.
// `!` на app.session/app.plan — в тестах они гарантированно построены strengthSession()/loadPlan().

let store: typeof import('./store.svelte.js')
let confirmFn: ReturnType<typeof vi.fn>

beforeEach(async () => {
  localStorage.clear()
  vi.resetModules()
  confirmFn = vi.fn(() => true)
  vi.stubGlobal('confirm', confirmFn)
  store = await import('./store.svelte.js')
})

afterEach(() => {
  vi.useRealTimers() // если тест включал fake timers и упал до restore — не протекаем в следующий
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Построить силовую сессию (День 1, последняя неделя) из mock-плана.
async function strengthSession() {
  await store.fetchPlan('fullbody')
  return store.app
}

describe('loadPlan', () => {
  it('грузит планы и строит сессию первого дня', async () => {
    vi.useFakeTimers()
    const p = store.loadPlan()
    await vi.runAllTimersAsync()
    await p
    const app = store.app
    expect(app.plans).toContain('fullbody')
    expect(app.plan!.plan).toBe('fullbody')
    expect(app.session).toBeTruthy()
    expect(app.session!.day_id).toBe('День 1')
  })
})

describe('touch', () => {
  it('инвалидирует замороженный payload и поднимает _dirty', async () => {
    const app = await strengthSession()
    app.session!.synced = false
    app.showRetry = true
    // эмулируем замороженный payload неудачной попытки финиша
    app.session!.payload = { session_id: 'x', sets: [], shared_secret: '' }
    vi.useFakeTimers() // touch() планирует debounce-запись (350мс) — контролируем, не оставляя висящий таймер
    store.touch()
    vi.runOnlyPendingTimers() // флашим отложенную запись синхронно
    vi.useRealTimers()
    expect(app.session!.payload).toBeNull()
    expect(app.session!._dirty).toBe(true)
    expect(app.showRetry).toBe(false)
  })
})

describe('syncNow', () => {
  it('online: успешная отправка → synced + статус ok', async () => {
    const app = await strengthSession()
    app.session!.exercises[0].sets[0].done = true
    app.session!.exercises[0].sets[0].reps = '10'
    await store.syncNow()
    expect(app.session!.synced).toBe(true)
    expect(app.status.cls).toBe('s-ok')
    expect(app.showRetry).toBe(false)
  })

  it('online: дубликат (written 0) → статус «уже было»', async () => {
    const api = await import('./api.js')
    vi.spyOn(api, 'saveSession').mockResolvedValue({ ok: true, written: 0, duplicate: true })
    const app = await strengthSession()
    app.session!.exercises[0].sets[0].done = true
    await store.syncNow()
    expect(app.session!.synced).toBe(true)
    expect(app.status.msg).toContain('уже было')
  })

  it('offline: reject → не synced, показан ретрай, локальный статус', async () => {
    localStorage.setItem('mock_offline', '1')
    const app = await strengthSession()
    app.session!.exercises[0].sets[0].done = true
    await store.syncNow()
    expect(app.session!.synced).toBe(false)
    expect(app.showRetry).toBe(true)
    expect(app.status.cls).toBe('s-local')
  })

  it('уже synced → no-op «уже отправлено»', async () => {
    const app = await strengthSession()
    app.session!.synced = true
    await store.syncNow()
    expect(app.status.cls).toBe('s-ok')
    expect(app.showRetry).toBe(false)
  })
})

describe('guard смены дня/недели', () => {
  it('несохранённый прогресс: confirm=false блокирует, confirm=true пересобирает', async () => {
    const app = await strengthSession()
    app.session!._dirty = true
    const orig = app.session!.day_id

    confirmFn.mockReturnValue(false)
    store.selectDay('Кардио 1')
    expect(app.session!.day_id).toBe(orig)

    confirmFn.mockReturnValue(true)
    store.selectDay('Кардио 1')
    expect(app.session!.day_id).toBe('Кардио 1')
  })

  it('несуществующий день не трогает сессию и не спрашивает confirm', async () => {
    const app = await strengthSession()
    app.session!._dirty = true
    confirmFn.mockClear()
    store.selectDay('Нет такого дня')
    expect(app.session!.day_id).toBe('День 1')
    expect(confirmFn).not.toHaveBeenCalled() // проверка !day стоит ДО guardUnsynced
  })

  it('selectWeek с подтверждением меняет неделю', async () => {
    const app = await strengthSession()
    const otherWeek = app.plan!.weeks.find((w) => w !== app.session!.week)!
    confirmFn.mockReturnValue(true)
    store.selectWeek(otherWeek)
    expect(app.session!.week).toBe(otherWeek)
  })
})

describe('startNew', () => {
  it('после отправки создаёт свежую сессию', async () => {
    const app = await strengthSession()
    app.session!.synced = true
    const oldId = app.session!.session_id
    store.startNew()
    expect(app.session!.synced).toBe(false)
    expect(app.session!.session_id).not.toBe(oldId)
    expect(app.showRetry).toBe(false)
  })

  it('во время отправки (_submitting) — no-op', async () => {
    const app = await strengthSession()
    app.session!._submitting = true
    const id = app.session!.session_id
    store.startNew()
    expect(app.session!.session_id).toBe(id)
  })
})

describe('syncStatus (derived)', () => {
  it('idle/sync/ok/off по состоянию сессии', async () => {
    const app = await strengthSession()
    expect(store.syncStatus()).toBe('idle') // свежий черновик
    app.session!._submitting = true
    expect(store.syncStatus()).toBe('sync')
    app.session!._submitting = false
    app.session!.synced = true
    expect(store.syncStatus()).toBe('ok')
    app.session!.synced = false
    app.showRetry = true
    expect(store.syncStatus()).toBe('off')
  })
})

describe('localStorage недоступен', () => {
  it('сбой записи снапшота → статус s-err, без падения', async () => {
    const app = await strengthSession()
    const spy = vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    store.addSet(app.session!.exercises[0]) // структурное действие → flushSave → writeSession
    expect(app.status.cls).toBe('s-err')
    spy.mockRestore()
  })
})
