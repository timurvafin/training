// Ядро стора: единый реактивный объект `app` (Svelte 5 runes) + setStatus.
// Доменные действия разнесены по соседним модулям (loading/restTimer/session/plan/sync) —
// все они импортируют `app` отсюда и мутируют его поля (реактивность — через прокси $state,
// мутация из любого модуля отслеживается). Фасад для компонентов — ../store.svelte.ts.
import * as storage from '../storage.js'
import type { AppState } from '../types.ts'

export const app: AppState = $state({
  plans: [], // string[] — доступные планы
  plan: null, // {plan, weeks, days} — текущий план
  progress: null, // ProgressMap | null — факт выполненных дней текущей недели (read-only)
  session: null, // STATE текущей сессии (глубоко реактивный)
  status: { cls: 's-idle', msg: '—' },
  showRetry: false,
  showSettings: false,
  showFinish: false,
  timer: null, // TimerState из timer.ts | null — активный rest-таймер (моменты времени)
  now: Date.now(), // реактивный «сейчас» (ms); тикает 1с пока есть app.timer (для derive)
  loading: { on: false, label: '', pct: 0 }, // полноэкранный оверлей загрузки
  muted: storage.getMuted(), // тихий режим сигнала окончания отдыха (звук+вибрация)
  weekLoading: false, // лёгкий оверлей на контенте при смене недели (грузим факт)
})

export function setStatus(cls: string, msg: string): void {
  app.status = { cls, msg }
}
