<script>
  import { app, confirmFinish } from './store.svelte.js'
  import BottomSheet from './BottomSheet.svelte'

  // Оценка 1–10. Init из app.session.feel, если уже выставлена (число или строка).
  const initFeel = Number(app.session?.feel)
  let rating = $state(Number.isFinite(initFeel) && initFeel >= 1 && initFeel <= 10 ? initFeel : null)

  const SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  function close() { app.showFinish = false }
  function submit() {
    if (rating == null) return
    confirmFinish(rating)
  }
</script>

<BottomSheet testid="finish-sheet" labelledby="finish-sheet-title" onClose={close}>
  <div class="grab"></div>
  <div class="sheet-title" id="finish-sheet-title">Как прошла в целом?</div>
  <div class="sheet-sub">Оцени тренировку от 1 до 10</div>

  <div class="scale">
    {#each SCALE as n}
      <button
        type="button"
        class="sc tap"
        data-testid="rating-{n}"
        data-sel={rating === n ? '' : undefined}
        aria-label="Оценка {n}"
        aria-pressed={rating === n}
        onclick={() => (rating = n)}
      >{n}</button>
    {/each}
  </div>
  <div class="scale-legend"><span>Легко</span><span>На пределе</span></div>

  <div class="warnbox">
    <span class="w-ic">⚠️</span>
    <span>После отправки запись закрывается — изменить подходы будет нельзя.</span>
  </div>

  <div class="sheet-btns">
    <button type="button" class="tap" onclick={close}>Отмена</button>
    <button
      type="button"
      class="primary tap"
      data-disabled={rating == null ? '' : undefined}
      disabled={rating == null}
      onclick={submit}
    >Отправить</button>
  </div>
</BottomSheet>

<style>
  /* Классы из дизайна hifi-v2 (design/hifi-v2/app.css), которых нет в ui/src/app.css.
     Локально на токенах --accent/--warn-tint/--surface-2/--hair и т.д. */
  .scale {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 9px;
  }
  .scale .sc {
    height: 54px;
    border-radius: 13px;
    background: var(--surface-2);
    border: 1px solid var(--hair);
    color: var(--text-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--f-num);
    font-size: 19px;
    font-weight: 600;
  }
  .scale .sc[data-sel] {
    background: var(--accent);
    color: var(--on-accent);
    border-color: transparent;
    box-shadow: 0 6px 16px var(--accent-tint);
  }
  .scale-legend {
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    color: var(--text-3);
    padding: 0 2px;
  }
  .warnbox {
    display: flex;
    gap: 11px;
    align-items: flex-start;
    background: var(--warn-tint);
    border: 1px solid color-mix(in oklab, var(--warn) 35%, transparent);
    color: var(--warn);
    border-radius: 14px;
    padding: 13px 15px;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }
  .warnbox .w-ic {
    flex: 0 0 auto;
    font-size: 16px;
  }
  .sheet-btns {
    display: flex;
    gap: 10px;
  }
  .sheet-btns button {
    flex: 1 1 auto;
    height: 54px;
    border-radius: 15px;
    font-family: var(--f-ui);
    font-size: 16px;
    font-weight: 700;
    border: 1px solid var(--hair);
    background: var(--surface-2);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .sheet-btns .primary {
    background: var(--accent);
    color: var(--on-accent);
    border-color: transparent;
  }
  .sheet-btns .primary[data-disabled] {
    background: var(--surface-2);
    color: var(--text-3);
  }
</style>
