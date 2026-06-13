<script>
  import { flushSync } from 'svelte'
  import { touch, toggleDone, toggleWarmup } from './store.svelte.js'
  import { tap } from './tap.js'

  let { set, index, locked = false, isNextUndone = false } = $props()

  const RPE = ['', 6, 7, 8, 9, 10]

  // «Тронут» ли подход: либо отмечен done, либо в полях есть значение,
  // либо пользователь правил поле в этой сессии (локальный флаг).
  // Аналог прототипного shown = done || touched: плановое значение faint,
  // после ввода/выполнения — ярче.
  let edited = $state(false)
  const shownReps = $derived(set.done || edited || !!String(set.reps ?? '').trim())
  const shownWeight = $derived(set.done || edited || !!String(set.weight ?? '').trim())
  const shownRpe = $derived(!!String(set.rpe ?? '').trim())

  // Вес тела (плейсхолдер «своё»): плана веса нет и ничего не введено.
  const isBW = $derived(!String(set.weight ?? '').trim() && !set.done && !edited)
</script>

<div
  class="setrow"
  data-testid="set-row"
  data-next={isNextUndone && !locked ? '' : undefined}
  data-done={set.done ? '' : undefined}
>
  <!-- # — номер/огонёк + длительность отдыха; тап = переключить тип (разминка ↔ рабочий) -->
  <button
    type="button"
    class="set-idx tap"
    data-warm={set.is_warmup ? '' : undefined}
    disabled={locked}
    use:tap={() => toggleWarmup(set)}
    aria-label="переключить тип подхода"
  >
    <span class="si-n">{#if set.is_warmup}🔥{:else}{index}{/if}</span>
    {#if set.rest}<span class="si-rest num">{set.rest}с</span>{/if}
  </button>

  <!-- Повт -->
  <label class="field" data-plan={shownReps ? undefined : ''} data-filled={shownReps ? '' : undefined}>
    <input
      class="finput"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      aria-label="повторы"
      placeholder={set.target_reps || '—'}
      disabled={locked}
      value={set.reps ?? ''}
      oninput={(e) => { set.reps = e.target.value.slice(0, 40); edited = true; touch(); try { flushSync() } catch {} }}
    />
  </label>

  <!-- Вес -->
  <label class="field" data-plan={shownWeight ? undefined : ''} data-filled={shownWeight ? '' : undefined}>
    <input
      class="finput"
      type="text"
      inputmode="decimal"
      aria-label="вес"
      placeholder={isBW ? 'своё' : '—'}
      disabled={locked}
      value={set.weight ?? ''}
      oninput={(e) => { set.weight = e.target.value.replace(',', '.').slice(0, 40); edited = true; touch(); try { flushSync() } catch {} }}
    />
    {#if String(set.weight ?? '').trim()}<span class="fu">кг</span>{/if}
  </label>

  <!-- RPE -->
  <label class="rpe" data-plan={shownRpe ? undefined : ''}>
    <select
      class="rpe-input"
      aria-label="rpe"
      disabled={locked}
      value={String(set.rpe || '')}
      onchange={(e) => { set.rpe = e.target.value; edited = true; touch(); try { flushSync() } catch {} }}
    >
      {#each RPE as o}<option value={String(o)}>{o === '' ? 'RPE' : o}</option>{/each}
    </select>
    <span class="chev" aria-hidden="true">▾</span>
  </label>

  <!-- ✓ -->
  <button
    type="button"
    class="check tap"
    data-done={set.done ? '' : undefined}
    aria-label="готово"
    disabled={locked}
    use:tap={() => toggleDone(set)}
  >
    {#if set.done}✓{/if}
  </button>
</div>

<style>
  .setrow {
    display: grid;
    grid-template-columns: 30px 1fr 1fr 62px var(--tt);
    gap: 8px;
    align-items: center;
  }

  /* # — ячейка номера + длительность отдыха */
  .set-idx {
    height: var(--tt);
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: none;
    border: none;
    padding: 0;
    color: var(--text-2);
  }
  .set-idx[data-warm] { color: var(--warn); }
  .si-n {
    font-size: 14px;
    font-weight: 600;
    line-height: 1;
  }
  /* 🔥 крупнее цифры по глифу — мельчим и поджимаем line-height, чтобы не наезжал на время */
  .set-idx[data-warm] .si-n {
    font-size: 12px;
    line-height: 1;
  }
  .si-rest {
    font-size: 10px;
    color: var(--text-3);
    line-height: 1;
  }
  .set-idx:disabled { opacity: 1; cursor: default; }

  /* поля повт/вес используют глобальный .field/.finput; единица «кг» — .fu */

  /* RPE — нативный select со своим шевроном */
  .rpe {
    position: relative;
    height: var(--tt);
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1.5px solid transparent;
    display: flex;
    align-items: center;
    cursor: pointer;
  }
  .rpe:focus-within {
    border-color: var(--accent);
    background: var(--surface-3);
    box-shadow: 0 0 0 4px var(--accent-tint);
  }
  .rpe-input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0 18px 0 9px;
    font-family: var(--f-num);
    font-size: 17px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text);
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }
  .rpe[data-plan] .rpe-input { color: var(--text-3); font-weight: 500; }
  .rpe-input:disabled { -webkit-text-fill-color: var(--text); opacity: 1; }
  .chev {
    position: absolute;
    right: 7px;
    font-size: 11px;
    color: var(--text-3);
    pointer-events: none;
  }

  /* ✓ — символ галочки внутри глобального .check */
  .check { font-size: 19px; font-weight: 700; }

  /* next-undone: подсветка кольцом */
  .setrow[data-next] .check {
    border-color: var(--accent-ring);
    box-shadow: 0 0 0 4px var(--accent-tint);
  }
  /* выполненная строка: лёгкий зелёный тинт у полей */
  .setrow[data-done] .field { background: var(--ok-tint); }
  .setrow[data-done] .rpe { background: var(--ok-tint); }
</style>
