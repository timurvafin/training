// Полноэкранный оверлей загрузки.
// runLoading проигрывает массив шагов {label, pct, delayMs} последовательно. Оверлей гаснет,
// когда выполнено И ОБА: проиграна анимация шагов И (если передан) дорезолвился `until` —
// промис готовности данных (план загружен, сессия построена). Это убирает «пустой экран»:
// на медленной сети оверлей держится на последнем шаге, пока не готовы подходы (они уже
// отрисованы за оверлеем), а на быстрой — минимум на длину анимации (без мигания).
import { app } from './appState.svelte.js'
import type { LoadStep } from '../types.ts'

let loadSeq = 0 // токен против наложения двух последовательностей загрузки
export function runLoading(steps: LoadStep[], until?: Promise<unknown> | null): Promise<void> {
  const seq = ++loadSeq
  let stepsDone = false
  let untilDone = until == null
  const maybeHide = () => {
    if (seq !== loadSeq) return // началась новая загрузка — этой гасить нечего
    if (stepsDone && untilDone) app.loading = { on: false, label: '', pct: 0 }
  }
  if (until != null) {
    Promise.resolve(until).then(() => { untilDone = true; maybeHide() },
                               () => { untilDone = true; maybeHide() })
  }
  return new Promise<void>((resolve) => {
    let i = 0
    const next = () => {
      if (seq !== loadSeq) return resolve() // началась новая загрузка — эту бросаем
      if (i >= steps.length) {
        stepsDone = true
        maybeHide()
        return resolve()
      }
      const s = steps[i++]
      app.loading = { on: true, label: s.label, pct: s.pct }
      setTimeout(next, s.delayMs || 0)
    }
    next()
  })
}

// Тайминги из spec §5 (ориентир).
export const LOAD_FIRST: LoadStep[] = [
  { label: 'Подключаемся к Google Sheets', pct: 22, delayMs: 650 },
  { label: 'Читаем план на сегодня', pct: 68, delayMs: 650 },
  { label: 'Почти готово', pct: 100, delayMs: 380 },
]
export const LOAD_RELOAD: LoadStep[] = [
  { label: 'Обновляем план…', pct: 40, delayMs: 320 },
  { label: 'Читаем таблицу', pct: 82, delayMs: 460 },
  { label: 'Готово', pct: 100, delayMs: 260 },
]
