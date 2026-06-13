<script>
  import SetRow from './SetRow.svelte'
  import { addSet, removeSet } from './store.svelte.js'
  import { tap } from './tap.js'

  let { ex, locked = false } = $props()

  const total = $derived(ex.sets.length)
  const doneCount = $derived(ex.sets.filter((s) => s.done).length)
  const allDone = $derived(total > 0 && doneCount === total)
  // Первый невыполненный подход (по порядку) — он подсвечивается кольцом.
  const firstUndoneIdx = $derived(ex.sets.findIndex((s) => !s.done))

  // Отображаемый номер рабочего подхода (разминки не считаются): si → номер.
  // Считаем заранее, чтобы 🔥-строки не сбивали нумерацию.
  const workNums = $derived.by(() => {
    let n = 0
    return ex.sets.map((s) => (s.is_warmup ? null : ++n))
  })
</script>

<div class="card ex-card" data-testid="exercise-card">
  <div class="ex-head">
    <div class="ex-toprow">
      <span class="ex-name">{ex.name}</span>
      <span class="ex-prog num" data-all={allDone ? '' : undefined}>{doneCount}/{total}</span>
    </div>
    {#if ex.note}
      <span class="ex-note"><span class="bulb">💡</span>{ex.note}</span>
    {/if}
  </div>

  <div class="setlist">
    <div class="colhead">
      <span>#</span><span>ПОВТ</span><span>ВЕС</span><span>RPE</span><span>✓</span>
    </div>
    {#each ex.sets as set, si (si)}
      <SetRow
        {set}
        index={workNums[si]}
        {locked}
        isNextUndone={si === firstUndoneIdx}
      />
    {/each}
  </div>

  {#if !locked}
    <div class="setactions">
      <div class="add-stepper">
        <button
          type="button"
          class="as-btn tap"
          use:tap={() => removeSet(ex)}
          disabled={ex.sets.length <= 1}
          aria-label="убрать подход"
        >−</button>
        <button
          type="button"
          class="as-btn tap as-plus"
          use:tap={() => addSet(ex)}
          aria-label="добавить подход"
        >+</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .ex-card { gap: 12px; }

  .ex-head {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ex-toprow {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .ex-name {
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.2px;
  }
  .ex-prog {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-3);
    flex: 0 0 auto;
  }
  .ex-prog[data-all] { color: var(--ok); }

  .ex-note {
    align-self: flex-start;
    max-width: 100%;
    display: flex;
    align-items: flex-start; /* 💡 у верхней строки, когда текст переносится */
    gap: 6px;
    background: var(--surface-2);
    border-radius: 9px;
    padding: 6px 10px;
    font-size: 12px; /* мельче */
    line-height: 1.35;
    color: var(--text-2);
    white-space: normal; /* перенос вместо обрезки в одну строку */
  }
  .bulb { flex: 0 0 auto; }

  .setlist {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .colhead {
    display: grid;
    grid-template-columns: 30px 1fr 1fr 62px var(--tt);
    gap: 8px;
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: var(--text-3);
  }
  .colhead span { text-align: center; }

  /* степпер ±подход — по центру под строками */
  .setactions {
    display: flex;
    justify-content: center;
    margin-top: 2px;
  }
  .add-stepper {
    display: inline-flex;
    align-items: stretch;
    background: var(--surface-2);
    border: 1px solid var(--hair);
    border-radius: 13px;
    overflow: hidden;
  }
  .as-btn {
    width: 48px;
    height: 44px;
    background: none;
    border: none;
    color: var(--text);
    font-size: 22px;
    font-weight: 500;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .as-btn:disabled { color: var(--text-3); opacity: 0.5; cursor: default; }
  /* разделитель между − и + */
  .as-plus { border-left: 1px solid var(--hair); }
</style>
