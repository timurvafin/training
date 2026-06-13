<script>
  import { fly, fade } from 'svelte/transition'
  import { onMount } from 'svelte'

  // Переиспользуемый нижний шит с dialog-семантикой и a11y-обвязкой.
  //   onClose    — вызвать для закрытия (клик-вне / ESC).
  //   children   — snippet с контентом шита (sheet-title, frow'ы, sheet-btns).
  //   testid     — прокидывается на scrim (чтобы e2e находил [data-testid="..."]).
  //   labelledby — id заголовка внутри children для aria-labelledby (опц.).
  let { onClose, children, testid = undefined, labelledby = undefined } = $props()

  // Сам диалог (.sheet) — для focus-trap, фокуса на mount, restore focus.
  let sheetEl = $state(null)

  // Селектор фокусируемых элементов для trap'а и авто-фокуса.
  const FOCUSABLE =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  function focusables() {
    if (!sheetEl) return []
    return Array.from(sheetEl.querySelectorAll(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    )
  }

  function onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
      return
    }
    if (e.key === 'Tab') {
      const items = focusables()
      if (items.length === 0) {
        // Нет фокусируемых — держим фокус на самом диалоге.
        e.preventDefault()
        sheetEl?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || !sheetEl?.contains(active)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last || !sheetEl?.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
  }

  onMount(() => {
    // Элемент, который был активен до открытия — чтобы вернуть фокус при закрытии.
    const prevActive = document.activeElement

    // Фокус на первый фокусируемый внутри шита, иначе на сам .sheet.
    const items = focusables()
    if (items.length) items[0].focus()
    else sheetEl?.focus()

    window.addEventListener('keydown', onKeydown, true)

    return () => {
      window.removeEventListener('keydown', onKeydown, true)
      // Restore focus на элемент, активный до открытия (если он ещё в DOM).
      if (prevActive && typeof prevActive.focus === 'function' && document.contains(prevActive)) {
        prevActive.focus()
      }
    }
  })
</script>

<!--
  Scrim: клик-вне → onClose. Клавиатурный путь (ESC) и фокус-ловушка — в onKeydown/onMount.
  role/keydown на самом скриме не нужны: ESC ловится на window, закрытие дублируется кнопкой.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="sheet-scrim"
  data-testid={testid}
  onclick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
  transition:fade={{ duration: 160 }}
>
  <div
    class="sheet"
    bind:this={sheetEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby={labelledby}
    tabindex="-1"
    transition:fly={{ y: 320, duration: 240 }}
  >
    {@render children()}
  </div>
</div>
