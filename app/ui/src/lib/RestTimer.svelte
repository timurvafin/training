<script>
  import { app, toggleTimer, adjustTimer, skipTimer, timerView } from './store.svelte.js'
  import { mmss } from './timer.js'

  // Производный вид таймера: { remaining, over, running, finished, progress }.
  // Пересчитывается реактивно по app.now (тикает 1с пока есть app.timer).
  const v = $derived(timerView())
</script>

<!-- Верхняя строка дока: метка + кнопка пропуска/готово.
     Snippet, чтобы не дублировать в ветках «обычный отдых» и «переотдых». -->
{#snippet topbar(labelText, skipText, skipAria)}
  <div class="rt-top">
    <span class="rt-label">{labelText}</span>
    <button class="rt-skip tap" onclick={skipTimer} aria-label={skipAria}>{skipText}</button>
  </div>
{/snippet}

<!-- Объявление для скринридера ТОЛЬКО перехода «отдых окончен».
     Само время тикает каждую секунду — его aria-live НЕ озвучивает (было бы шумно).
     Узел всегда в DOM; текст пустой → непустой только при v.finished, поэтому
     assertive-регион объявляет лишь сам момент окончания отдыха, не каждый тик. -->
<div class="rt-sr" aria-live="assertive" role="status">
  {#if app.timer != null && v.finished}Отдых окончен{/if}
</div>

{#if app.timer != null}
  <div
    class="resttimer"
    class:done={v.finished}
    data-testid="rest-timer"
  >
    {#if v.finished}
      <!-- Переотдых: бар янтарный, счёт вверх -->
      {@render topbar('ОТДЫХ ОКОНЧЕН' + (app.timer.exName ? ' · ' + app.timer.exName : ''), 'Готово', 'Завершить отдых')}
      <div class="rt-mid">
        <button
          class="rt-adj tap"
          onclick={toggleTimer}
          aria-label={v.running ? 'Пауза' : 'Продолжить'}
        >
          {#if v.running}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" />
              <rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="7 4 20 12 7 20" fill="currentColor" />
            </svg>
          {/if}
        </button>

        <button class="rt-overwrap tap" onclick={toggleTimer} aria-label="Пауза/продолжить">
          <span class="rt-over num">+{mmss(v.over)}</span>
          <span class="rt-oversub">сверх {mmss(app.timer.total)}</span>
        </button>

        <button class="rt-adj tap" onclick={skipTimer} aria-label="Пропустить отдых">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="5 4 15 12 5 20" fill="currentColor" stroke="none" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      </div>
      <div class="rt-bar"><i style="width:100%"></i></div>
    {:else}
      <!-- Обычный отдых -->
      {@render topbar('ОТДЫХ' + (app.timer.exName ? ' · ' + app.timer.exName : ''), 'Пропустить', 'Пропустить отдых')}
      <div class="rt-mid">
        <button class="rt-adj num tap" onclick={() => adjustTimer(-15)} aria-label="Минус 15 секунд">−15</button>

        <button
          class="rt-time tap"
          onclick={toggleTimer}
          aria-label={v.running ? 'Пауза' : 'Продолжить'}
        >
          <span class="num">{mmss(v.remaining)}</span>
          {#if v.running}
            <svg class="rt-pp" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="7" y="5" width="3.4" height="14" rx="1" fill="currentColor" />
              <rect x="13.6" y="5" width="3.4" height="14" rx="1" fill="currentColor" />
            </svg>
          {:else}
            <svg class="rt-pp" viewBox="0 0 24 24" aria-hidden="true">
              <polygon points="7 4 20 12 7 20" fill="currentColor" />
            </svg>
          {/if}
        </button>

        <button class="rt-adj num tap" onclick={() => adjustTimer(15)} aria-label="Плюс 15 секунд">+15</button>
      </div>
      <div class="rt-bar"><i style="width:{v.progress * 100}%"></i></div>
    {/if}
  </div>
{/if}

<style>
  /* Визуально-скрытая live-область: объявляет только переход «отдых окончен»,
     не видна и не занимает места (screen-reader-only). */
  .rt-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Док-бар отдыха: обычный флекс-ребёнок снизу #app (после скролл-контента main),
     без position:fixed — футера больше нет, шапка липнет флексом. */
  .resttimer {
    flex: 0 0 auto;
    margin: 0 18px calc(12px + env(safe-area-inset-bottom));
    background: var(--surface);
    border: 1px solid var(--hair-2);
    border-radius: 18px;
    box-shadow: var(--shadow);
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 9px;
    overflow: hidden;
  }
  .resttimer.done {
    /* непрозрачный янтарный фон (док перекрывает контент — нельзя просвечивать) */
    background: color-mix(in srgb, var(--warn) 16%, var(--surface));
    border-color: var(--warn);
    animation: rt-pulse 0.9s ease 2;
  }
  @keyframes rt-pulse {
    0%, 100% { box-shadow: var(--shadow); }
    50% { box-shadow: 0 0 0 4px var(--warn-tint), var(--shadow); }
  }

  .rt-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .rt-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: var(--text-2);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .resttimer.done .rt-label { color: var(--warn); }

  .rt-skip {
    flex: 0 0 auto;
    background: var(--surface-2);
    border: 1px solid var(--hair);
    color: var(--text-2);
    font-family: var(--f-ui);
    font-size: 13px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: var(--r-pill);
  }
  .resttimer.done .rt-skip {
    background: var(--warn);
    border-color: transparent;
    color: #1c1304;
  }

  .rt-mid {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .rt-adj {
    flex: 0 0 auto;
    width: 58px;
    height: 46px;
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1px solid var(--hair);
    color: var(--text);
    font-size: 16px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .rt-adj svg { width: 18px; height: 18px; }

  .rt-time {
    flex: 1 1 auto;
    height: 54px;
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1px solid var(--hair);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }
  .rt-time .num {
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
  }
  .rt-pp {
    width: 17px;
    height: 17px;
    color: var(--text-2);
    flex: 0 0 auto;
  }

  /* Переотдых: центральный блок «+M:SS / сверх M:SS» */
  .rt-overwrap {
    flex: 1 1 auto;
    height: 54px;
    border-radius: var(--r-field);
    background: transparent;
    border: none;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
  }
  .rt-over {
    font-size: 30px;
    font-weight: 600;
    line-height: 1;
    color: var(--warn);
  }
  .rt-oversub {
    font-family: var(--f-ui);
    font-size: 12px;
    font-weight: 600;
    color: var(--warn);
    opacity: 0.85;
  }

  .rt-bar {
    height: 4px;
    border-radius: var(--r-pill);
    background: var(--hair);
    overflow: hidden;
  }
  .rt-bar i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: inherit;
    transition: width 0.25s linear;
  }
  .resttimer.done .rt-bar { background: var(--warn-tint); }
  .resttimer.done .rt-bar i { background: var(--warn); }

  /* Уважение к prefers-reduced-motion: без пульса/анимаций, статичный док. */
  @media (prefers-reduced-motion: reduce) {
    .resttimer.done { animation: none; }
    .rt-bar i { transition: none; }
  }
</style>
