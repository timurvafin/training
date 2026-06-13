<script>
  import { app, touch } from './store.svelte.js'

  let { locked = false } = $props()

  const s = $derived(app.session)
  const TYPES = ['Ходьба с уклоном', 'Эллипс', 'Велотренажёр']
  const RPE = ['', 6, 7, 8, 9, 10]
</script>

<div class="card cardio-card" data-testid="cardio-form">
  {#if s.cardio_note}
    <span class="ex-note"><span class="bulb">💡</span>{s.cardio_note}</span>
  {/if}

  <div class="cardio">
    <!-- Вид -->
    <div class="frow">
      <div class="flabel">Вид</div>
      <label class="fbig">
        <select
          class="fbig-input"
          aria-label="вид кардио"
          disabled={locked}
          value={s.type}
          onchange={(e) => { s.type = e.target.value; touch() }}
        >
          {#each TYPES as t}<option value={t}>{t}</option>{/each}
        </select>
        <span class="chev" aria-hidden="true">▾</span>
      </label>
    </div>

    <!-- Длительность -->
    <div class="frow">
      <div class="flabel">Длительность</div>
      <label class="fbig" data-filled={String(s.duration ?? '').trim() ? '' : undefined}>
        <input
          class="finput big"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          aria-label="длительность"
          placeholder="—"
          disabled={locked}
          value={s.duration ?? ''}
          oninput={(e) => { s.duration = e.target.value.replace(/[^0-9]/g, ''); touch() }}
        />
        <span class="bu">мин</span>
      </label>
    </div>

    <!-- Ср. пульс — опционально -->
    <div class="frow">
      <div class="flabel">Ср. пульс <span class="opt">— опц.</span></div>
      <label class="fbig" data-plan={String(s.hr ?? '').trim() ? undefined : ''}>
        <input
          class="finput big"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          aria-label="пульс"
          placeholder="—"
          disabled={locked}
          value={s.hr ?? ''}
          oninput={(e) => { s.hr = e.target.value.replace(/[^0-9]/g, ''); touch() }}
        />
        <span class="bu">уд/мин</span>
      </label>
    </div>

    <!-- RPE -->
    <div class="frow">
      <div class="flabel">RPE</div>
      <label class="fbig">
        <select
          class="fbig-input"
          aria-label="rpe"
          disabled={locked}
          value={String(s.rpe || '')}
          onchange={(e) => { s.rpe = e.target.value; touch() }}
        >
          {#each RPE as o}<option value={String(o)}>{o === '' ? 'RPE' : o}</option>{/each}
        </select>
        <span class="chev" aria-hidden="true">▾</span>
      </label>
    </div>
  </div>
</div>

<style>
  .cardio-card { gap: 14px; }

  /* подсказка-пилюля — как в карточке упражнения */
  .ex-note {
    align-self: flex-start;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--surface-2);
    border-radius: 9px;
    padding: 6px 10px;
    font-size: 13.5px;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bulb { flex: 0 0 auto; }

  .cardio {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .frow {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .flabel {
    font-size: 14px;
    color: var(--text-2);
    font-weight: 500;
  }
  .flabel .opt { color: var(--text-3); }

  /* большое поле */
  .fbig {
    position: relative;
    height: 60px;
    border-radius: var(--r-field);
    background: var(--surface-2);
    border: 1.5px solid transparent;
    display: flex;
    align-items: center;
    padding: 0 14px;
    cursor: pointer;
  }
  .fbig:focus-within {
    border-color: var(--accent);
    background: var(--surface-3);
    box-shadow: 0 0 0 4px var(--accent-tint);
  }
  .fbig[data-filled] { background: var(--surface-3); }

  .fbig .finput.big {
    font-size: 22px;
  }
  .fbig[data-plan] .finput.big { color: var(--text-3); font-weight: 500; }

  /* единица справа (кг/мин/уд-мин) */
  .bu {
    flex: 0 0 auto;
    font-size: 14px;
    color: var(--text-3);
    margin-left: 8px;
  }

  /* нативный select со своим шевроном */
  .fbig-input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0 20px 0 0;
    font-family: var(--f-ui);
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
    -webkit-appearance: none;
    appearance: none;
    cursor: pointer;
  }
  .fbig-input:disabled { -webkit-text-fill-color: var(--text); opacity: 1; }
  .chev {
    position: absolute;
    right: 14px;
    font-size: 12px;
    color: var(--text-3);
    pointer-events: none;
  }
</style>
