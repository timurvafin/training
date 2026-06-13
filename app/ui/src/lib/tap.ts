// Svelte-экшен: ПРЯМОЙ (не делегированный) click-listener на элементе.
//
// Зачем: на iOS Safari внутри iframe Apps Script делегирование событий Svelte 5
// (один listener на корне + обход дерева) для части кнопок внутри карточек НЕ срабатывает —
// нативный `click` на кнопку приходит (подтверждено tap-диагностикой: touchstart/touchend/click
// все летят на BUTTON{готово}), но делегированный обработчик не вызывается. Прямой listener
// на самом элементе ловит этот нативный click напрямую, минуя делегирование.
//
// Использование: <button use:tap={() => toggleDone(set)}>  (вместо onclick={...}).
//
// flushSync ОБЯЗАТЕЛЕН: на iOS Safari (Apps Script iframe, первый рендер) после raw-listener
// реактивный flush Svelte «застревает» — состояние меняется и персистится, но DOM не
// перерисовывается до перезагрузки страницы (после reload галки уже показаны нажатыми).
// flushSync принудительно синхронно доводит обновления до DOM сразу после обработчика.
import { flushSync } from 'svelte'

type TapHandler = (e: Event) => void

export function tap(node: HTMLElement, handler: TapHandler) {
  let current = handler
  const fn = (e: Event) => {
    if (!current) return
    current(e)
    try { flushSync() } catch (err) { /* flushSync вне компонента — игнор */ }
  }
  node.addEventListener('click', fn)
  return {
    update(h: TapHandler) { current = h },
    destroy() { node.removeEventListener('click', fn) },
  }
}
