// Promise-адаптер над google.script.run.
// Внутри Apps Script (iframe) — настоящий вызов сервера; вне (npm run dev) — offline-mock.
import type { Plan } from './types.ts'

// google.script.run: цепочка withSuccessHandler/withFailureHandler; серверные методы зовутся
// динамически по имени (run[method]) — каст в точке вызова, чтобы не конфликтовать с with*Handler.
interface GoogleScriptRun {
  withSuccessHandler(cb: (r: unknown) => void): GoogleScriptRun
  withFailureHandler(cb: (e: unknown) => void): GoogleScriptRun
}
type ServerMethods = Record<string, (...args: unknown[]) => unknown>
const g = globalThis as typeof globalThis & {
  google?: { script?: { run?: GoogleScriptRun } }
  localStorage?: Storage
}

export function gas<T = unknown>(method: string, ...args: unknown[]): Promise<T> {
  const run = g.google?.script?.run
  if (!run) {
    // dev/mock. Переключатель offline для теста ретраев: localStorage.mock_offline='1'.
    if (mockOffline() && (method === 'saveSession' || method === 'saveCardio')) {
      return Promise.reject(new Error('mock offline'))
    }
    // Имитация медленной сети (для проверки экрана загрузки): localStorage.mock_delay='3000' (мс).
    const r = mock(method) as T
    const d = mockDelay()
    return d > 0 ? new Promise<T>((res) => setTimeout(() => res(r), d)) : Promise.resolve(r)
  }
  return new Promise<T>((resolve, reject) => {
    // Таймаут: если google.script.run не вызовет ни один колбэк (зависшая сеть) — не залипаем навсегда.
    const t = setTimeout(() => reject(new Error('Таймаут запроса (30с)')), 30000)
    const chain = run
      .withSuccessHandler((r) => { clearTimeout(t); resolve(r as T) })
      .withFailureHandler((e) => { clearTimeout(t); reject(e) })
    ;(chain as unknown as ServerMethods)[method](...args)
  })
}

function mockOffline(): boolean {
  try { return g.localStorage?.getItem('mock_offline') === '1' } catch (e) { return false }
}
// e2e-фикстура факта выполненных дней (для bootstrap/getProgress). По умолчанию пусто.
function mockProgress(): unknown {
  try { return JSON.parse(g.localStorage?.getItem('mock_progress') || '{}') } catch (e) { return {} }
}
function mockDelay(): number {
  try { return Number(g.localStorage?.getItem('mock_delay')) || 0 } catch (e) { return 0 }
}

export function isAppsScript(): boolean {
  return !!g.google?.script?.run
}

// ——— Mock для локальной разработки (npm run dev). Форма — как в DATA-CONTRACT.md. ———
function mock(method: string): unknown {
  if (method === 'listPlans') return ['fullbody', 'Восстановление']
  if (method === 'getPlan') return MOCK_PLAN
  if (method === 'bootstrap') return { plans: ['fullbody', 'Восстановление'], prefs: {}, plan: MOCK_PLAN, progress: mockProgress() }
  if (method === 'getPrefs') return {}
  if (method === 'setPrefs') return { ok: true }
  if (method === 'getProgress') return mockProgress()
  // saveSession / saveCardio — имитируем успешную запись
  if (method === 'saveSession' || method === 'saveCardio') return { ok: true, written: 1, mock: true }
  return { ok: true, mock: true }
}

const W1 = 'Неделя 1'
const W2 = 'Неделя 2'
const MOCK_PLAN: Plan = {
  plan: 'fullbody',
  weeks: [W1, W2],
  days: [
    {
      day_id: 'День 1', day_name: 'День 1',
      exercises: [
        {
          exercise_id: 'Жим ногами', name: 'Жим ногами', note: 'Отдых 90с; RIR 1-2; стопы шире плеч',
          sets: [
            { is_warmup: true, rest: 45, byWeek: { [W1]: { reps: '10', weight: '120' }, [W2]: { reps: '10', weight: '125' } } },
            { is_warmup: false, rest: 120, byWeek: { [W1]: { reps: '10', weight: '120' }, [W2]: { reps: '10', weight: '125' } } },
            { is_warmup: false, rest: 150, byWeek: { [W1]: { reps: '10', weight: '120' }, [W2]: { reps: '10', weight: '125' } } },
          ],
        },
        {
          exercise_id: 'Жим в хаммере', name: 'Жим в хаммере на грудь', note: '',
          sets: [
            { is_warmup: false, rest: 120, byWeek: { [W1]: { reps: '10', weight: '20' }, [W2]: { reps: '10', weight: '22.5' } } },
            { is_warmup: false, rest: 150, byWeek: { [W1]: { reps: '10', weight: '20' }, [W2]: { reps: '10', weight: '22.5' } } },
          ],
        },
      ],
    },
    {
      day_id: 'Кардио 1', day_name: 'Кардио 1',
      exercises: [
        {
          exercise_id: 'Кардио зона-2', name: 'Кардио зона-2', note: 'Пульс 120–135, разговорный темп',
          sets: [{ is_warmup: false, byWeek: { [W1]: { reps: '40 мин', weight: '' }, [W2]: { reps: '45 мин', weight: '' } } }],
        },
      ],
    },
  ],
}
