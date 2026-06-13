<script>
  import { app, syncNow, syncStatus } from './store.svelte.js'

  // idle | sync | ok | off — единственный источник правды о состоянии отправки.
  const state = $derived(syncStatus())

  const TEXT = {
    idle: 'Черновик — отправится при завершении',
    sync: 'Отправляем…',
    ok: 'Отправлено в таблицу',
    off: 'Оффлайн — отправится позже',
  }
  const label = $derived(TEXT[state] ?? TEXT.idle)
</script>

<!-- idle («Черновик») не показываем — лишняя плашка; статус виден только когда есть что
     сказать: отправляем / отправлено / оффлайн (с кнопкой повтора). -->
{#if state !== 'idle'}
  <div class="sync" data-s={state} role="status" aria-live="polite" data-testid="sync-line">
    <span class="sdot" class:pulse={state === 'sync'} aria-hidden="true"></span>
    <span class="stext">{label}</span>

    {#if state === 'ok'}
      <svg class="sicon" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.4" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    {:else if state === 'off'}
      <button class="sync-retry tap" aria-label="Повторить отправку" data-testid="sync-retry" onclick={syncNow}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        Повторить
      </button>
    {/if}
  </div>
{/if}

<style>
  .sync {
    margin: 0 18px 12px;
    padding: 9px 14px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
    font-weight: 600;
    background: var(--surface-2);
    color: var(--text-2);
    border: 1px solid var(--hair);
  }
  .sdot {
    flex: 0 0 auto;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--text-3);
  }
  .sdot.pulse { animation: pulse 1s ease-in-out infinite; }
  .stext {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sicon { flex: 0 0 auto; }

  .sync[data-s='sync'] {
    background: var(--accent-tint);
    color: var(--accent);
    border-color: transparent;
  }
  .sync[data-s='sync'] .sdot { background: var(--accent); }

  .sync[data-s='ok'] {
    background: var(--ok-tint);
    color: var(--ok);
    border-color: transparent;
  }
  .sync[data-s='ok'] .sdot { background: var(--ok); }

  .sync[data-s='off'] {
    background: var(--warn-tint);
    color: var(--warn);
    border-color: transparent;
  }
  .sync[data-s='off'] .sdot { background: var(--warn); }

  .sync-retry {
    margin-left: auto;
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: var(--r-pill);
    border: 1px solid var(--warn);
    background: transparent;
    color: var(--warn);
    font-family: var(--f-ui);
    font-size: 13px;
    font-weight: 600;
  }
</style>
