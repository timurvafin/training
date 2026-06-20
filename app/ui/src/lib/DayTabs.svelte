<script>
  import { app, selectDay, dayDone } from './store.svelte.js'
  import { isCardio } from './state.js'

  // Вкладки дней всегда кликабельны: даже когда текущий день завершён (locked),
  // переключение на другой день начинает новую сессию (см. selectDay в store).
  const activeId = $derived(app.session?.day_id)
</script>

<div class="tabs scroll">
  {#each app.plan?.days ?? [] as day (day.day_id)}
    {@const active = day.day_id === activeId}
    {@const cardio = isCardio(day)}
    {@const done = dayDone(day.day_id)}
    <button
      class="pill tap"
      data-active={active ? '' : undefined}
      data-cardio={cardio ? '' : undefined}
      data-done={done ? '' : undefined}
      aria-label={done ? day.day_name + ' — выполнено' : day.day_name}
      aria-pressed={active}
      data-testid="day-tab"
      onclick={() => selectDay(day.day_id)}
    >
      {#if cardio}
        <svg class="tab-ic" width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.9" stroke-linecap="round"
          stroke-linejoin="round" aria-hidden="true">
          <circle cx="13" cy="4" r="1.6" />
          <path d="M7 21l3-5 4-1-2-5-4 2-2 4" />
          <path d="M14 10l3 1 2 4" />
        </svg>
      {/if}
      {day.day_name}
      {#if done}<span class="tab-done" aria-hidden="true">✓</span>{/if}
    </button>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 0 18px 12px;
    background: var(--app);
  }
  .pill[data-cardio] {
    border-style: dashed;
    border-color: var(--hair-2);
  }
  .pill[data-cardio][data-active] {
    border-style: solid;
  }
  .tab-ic {
    flex: 0 0 auto;
    opacity: 0.9;
  }
  .pill:disabled {
    opacity: 0.45;
    cursor: default;
  }
  /* выполненный день: галочка + зелёная окантовка (когда не активен) */
  .tab-done {
    margin-left: 5px;
    color: var(--ok);
    font-weight: 700;
  }
  .pill[data-done]:not([data-active]) {
    border-color: var(--ok);
  }
</style>
