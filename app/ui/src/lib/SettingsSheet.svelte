<script>
  import { app, saveSettings, planName, toggleMute } from './store.svelte.js'
  import BottomSheet from './BottomSheet.svelte'

  // Список планов (имена). Фолбэк на текущий, если кэш планов пуст.
  const plans = app.plans.length ? app.plans : (planName() ? [planName()] : [])

  // Версия билда (инжектится vite define из git-хеша + времени сборки). Guard — на случай
  // импорта вне vite (тесты): typeof не кинет ReferenceError у необъявленного идентификатора.
  const build = typeof __BUILD_INFO__ !== 'undefined' ? __BUILD_INFO__ : 'dev'

  let selPlan = $state(planName())

  function close() { app.showSettings = false }
  // Неделя — в шапке; секрет записи приходит с сервера автоматически. saveSettings меняет только план.
  function save() { saveSettings(selPlan) }
</script>

<BottomSheet testid="settings-sheet" labelledby="settings-sheet-title" onClose={close}>
  <div class="grab"></div>
  <div class="sheet-title" id="settings-sheet-title">Настройки</div>

  <div class="frow">
    <div class="flabel">План</div>
    <div class="set-field">
      <select
        class="set-select"
        aria-label="план"
        bind:value={selPlan}
      >
        {#each plans as n}<option value={n}>{n}</option>{/each}
      </select>
      <span class="chev" aria-hidden="true">▾</span>
    </div>
    <div class="set-meta">Список тренировок и план берётся из выбранной вкладки таблицы.</div>
  </div>

  <div class="frow">
    <div class="flabel">Сигнал окончания отдыха</div>
    <button
      type="button"
      class="set-field toggle tap"
      role="switch"
      aria-checked={!app.muted}
      aria-label="звук и вибрация сигнала отдыха"
      data-testid="mute-toggle"
      onclick={toggleMute}
    >
      <span class="tg-text">{app.muted ? 'Выключено' : 'Звук и вибрация'}</span>
      <span class="switch" data-on={app.muted ? undefined : ''}><span class="knob"></span></span>
    </button>
    <div class="set-meta">Короткий сигнал и вибрация, когда таймер отдыха дошёл до нуля.</div>
  </div>

  <div class="frow">
    <div class="flabel">Таблица плана</div>
    <div class="set-field static">
      <span class="src-name">Google Sheets</span>
      <span class="conn">✓ подключено</span>
    </div>
  </div>

  <div class="sheet-btns">
    <button type="button" class="tap" onclick={close}>Закрыть</button>
    <button type="button" class="primary tap" onclick={save}>Сохранить</button>
  </div>

  <div class="build-info" data-testid="build-info">Сборка: {build}</div>
</BottomSheet>

<style>
  /* Классы из дизайна hifi-v2 (design/hifi-v2/app.css), которых нет в ui/src/app.css.
     Локально на токенах --surface-2/--hair/--accent/--ok и т.д. */
  .frow {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .flabel {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
    padding-left: 2px;
  }
  .set-field {
    height: 56px;
    border-radius: 14px;
    background: var(--surface-2);
    border: 1px solid var(--hair);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 10px;
    font-size: 16px;
  }
  .set-field:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 4px var(--accent-tint);
  }
  /* Нативный select «вписан» в .set-field, без собственного фона/рамки. */
  .set-select {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
    margin: 0;
    color: var(--text);
    font-family: var(--f-ui);
    font-size: 16px;
    -webkit-appearance: none;
    appearance: none;
  }
  .set-field .chev {
    margin-left: auto;
    color: var(--text-3);
    pointer-events: none;
  }
  .set-field.static .src-name { color: var(--text); }
  .set-field .conn {
    margin-left: auto;
    color: var(--ok);
    font-size: 13px;
    font-weight: 600;
    display: inline-flex;
    gap: 5px;
    align-items: center;
  }
  /* Тоггл-строка (звук сигнала): .set-field как кнопка-переключатель + пилюля-свитч справа. */
  .toggle {
    width: 100%;
    justify-content: space-between;
    cursor: pointer;
    color: var(--text);
    font-family: var(--f-ui);
    text-align: left;
  }
  .tg-text { font-size: 16px; }
  .switch {
    flex: 0 0 auto;
    width: 46px;
    height: 28px;
    border-radius: 999px;
    background: var(--surface-3);
    border: 1px solid var(--hair);
    position: relative;
    transition: background 0.15s;
  }
  .switch[data-on] { background: var(--accent); border-color: transparent; }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--text-2);
    transition: transform 0.15s, background 0.15s;
  }
  .switch[data-on] .knob { transform: translateX(18px); background: var(--on-accent); }
  @media (prefers-reduced-motion: reduce) {
    .switch, .knob { transition: none; }
  }

  .set-meta {
    font-size: 12.5px;
    color: var(--text-3);
    padding-left: 2px;
    margin-top: -2px;
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
  .build-info {
    text-align: center;
    font-family: var(--f-num);
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.2px;
    padding-top: 2px;
  }
</style>
