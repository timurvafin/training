<script>
  import { flushSync } from 'svelte'
  import { app, finish, selectWeek, isLocked } from './store.svelte.js'
  import { collectSets } from './state.js'
  import { tap } from './tap.js'

  // Смена недели + принудительный flush — чтобы дни/подходы перерисовались сразу (iOS-страховка).
  function onWeek(e) {
    selectWeek(e.target.value)
    try { flushSync() } catch (_) { /* flushSync вне эффекта — игнор */ }
  }

  // Выбор НЕДЕЛИ перенесён в шапку (из настроек) — крупный селект-дропдаун.
  // Недели берутся из текущего плана и реактивно обновляются при смене плана
  // (это же закрывает баг «смена плана не обновляет список недель»).
  const weeks = $derived(app.plan?.weeks ?? [])
  const currentWeek = $derived(app.session?.week ?? '')
  // Метка недели: значения уже метки («Неделя 6», «Неделя 16 (план)»); чисто числовое → префикс.
  const weekLabel = (w) => {
    const s = String(w)
    return /^\d+$/.test(s) ? `Неделя ${s}` : s
  }

  // Кнопка «Завершить» — синяя кнопка-флаг.
  const cardio = $derived(!!app.session?.cardio)
  const synced = $derived(!!app.session?.synced)
  const locked = $derived(isLocked())
  const submitting = $derived(!!app.session?._submitting)
  // Есть что отправлять: кардио с длительностью ИЛИ силовая с ≥1 заполненным/✓ подходом.
  const hasData = $derived(
    app.session
      ? app.session.cardio
        ? !!app.session.duration
        : collectSets(app.session.exercises).length > 0
      : false
  )
  const finishDisabled = $derived(!app.session || locked || submitting || !hasData)
  const finishLabel = $derived(
    synced ? 'Тренировка закрыта' : cardio ? 'Завершить кардио' : 'Завершить тренировку'
  )
</script>

<header class="hdr">
  <label class="week-field">
    <select
      class="week-select"
      aria-label="неделя"
      data-testid="week-select"
      value={currentWeek}
      onchange={onWeek}
    >
      {#each weeks as w}<option value={w}>{weekLabel(w)}</option>{/each}
    </select>
    <span class="week-chev" aria-hidden="true">▾</span>
  </label>

  <div class="hdr-actions">
    <button
      class="iconbtn finish-btn tap"
      data-disabled={finishDisabled ? '' : undefined}
      disabled={finishDisabled}
      aria-label={finishLabel}
      data-testid="finish"
      use:tap={() => { if (!finishDisabled) finish() }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    </button>
    <button
      class="iconbtn tap"
      aria-label="Настройки"
      data-testid="open-settings"
      onclick={() => (app.showSettings = true)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  </div>
</header>

<style>
  .hdr {
    position: relative;
    background: var(--app);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 18px 14px;
  }
  /* Селект недели — крупное поле слева (на месте бывшего заголовка). */
  .week-field {
    flex: 1 1 auto;
    min-width: 0;
    position: relative;
    height: 46px;
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1px solid var(--hair);
    display: flex;
    align-items: center;
  }
  .week-field:focus-within {
    border-color: var(--accent);
    background: var(--surface-3);
    box-shadow: 0 0 0 4px var(--accent-tint);
  }
  .week-select {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0 34px 0 16px;
    font-family: var(--f-ui);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: var(--text);
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
    text-overflow: ellipsis;
  }
  .week-chev {
    position: absolute;
    right: 14px;
    color: var(--text-3);
    font-size: 13px;
    pointer-events: none;
  }

  .hdr-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .iconbtn {
    flex: 0 0 auto;
    width: 46px;
    height: 46px;
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1px solid var(--hair);
    color: var(--text-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .iconbtn:active { transform: scale(0.94); }
  /* «Завершить» — синяя акцентная кнопка-флаг */
  .finish-btn {
    background: var(--accent);
    border-color: transparent;
    color: var(--on-accent);
  }
  .finish-btn[data-disabled] {
    background: var(--surface-2);
    border-color: var(--hair);
    color: var(--text-3);
  }
</style>
