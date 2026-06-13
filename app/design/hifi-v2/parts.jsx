/* parts.jsx — компоненты экрана (экспорт в window) */
const I = (props) => <window.Icon {...props} />;

/* ---------- header ---------- */
window.Header = function Header({ day, week, onSettings }) {
  return (
    <div className="hdr">
      <div>
        <div className="hdr-title">{day.name}</div>
        <div className="hdr-sub">
          <span>{day.sub}</span>
          <span className="dotsep"></span>
          <span>Неделя {week}</span>
        </div>
      </div>
      <div className="hdr-right">
        <button className="iconbtn tap" onClick={onSettings} aria-label="Настройки">
          <I n="gear" />
        </button>
      </div>
    </div>);

};

/* ---------- loading screen ---------- */
window.LoadingScreen = function LoadingScreen({ label, pct }) {
  return (
    <div className="loading">
      <div className="brand">
        <span className="mark"><I n="bolt" /></span>
        Тренировки
      </div>
      <div className="ringwrap"><div className="ring"></div></div>
      <div className="lstatus" key={label}>{label}</div>
      <div className="lbar"><i style={{ width: pct + '%' }}></i></div>
    </div>);

};

/* ---------- day tabs ---------- */
window.DayTabs = function DayTabs({ days, activeId, onPick }) {
  return (
    <div className="tabs">
      {days.map((d) =>
      <button key={d.id}
      className="tab tap"
      data-active={d.id === activeId ? '' : undefined}
      data-cardio={d.kind === 'cardio' ? '' : undefined}
      onClick={() => onPick(d.id)}>
          {d.kind === 'cardio' && <I n="walk" className="tab-ic" />}
          {d.name}
        </button>
      )}
    </div>);

};

/* ---------- sync ---------- */
window.SyncLine = function SyncLine({ state, onRetry }) {
  const map = {
    idle: { t: 'Черновик — отправится при завершении' },
    ok: { t: 'Отправлено в таблицу' },
    sync: { t: 'Отправляем…' },
    off: { t: 'Оффлайн — отправится позже' }
  };
  return (
    <div className="sync" data-s={state}>
      <span className="sdot"></span>
      <span>{map[state].t}</span>
      {state === 'ok' && <I n="check" style={{ width: 16, height: 16 }} />}
      {state === 'off' &&
      <button className="sync-retry tap" onClick={onRetry}>
          <I n="refresh" style={{ width: 15, height: 15 }} /> Повторить
        </button>
      }
    </div>);

};

/* ---------- banner ---------- */
window.Banner = function Banner({ kind, onReset }) {
  if (kind === 'done') return (
    <div className="banner" data-kind="done">
      <span className="b-ic">✅</span>
      <span>Тренировка завершена и отправлена</span>
      <button className="b-act tap" onClick={onReset}>Начать заново</button>
    </div>);

  return (
    <div className="banner" data-kind="pending">
      <I n="refresh" className="spin" style={{ width: 18, height: 18 }} />
      <span>Идёт отправка…</span>
    </div>);

};

/* ---------- set row ---------- */
function fmtWeight(w) {return w === 0 ? '' : Number.isInteger(w) ? String(w) : w.toFixed(1);}

window.SetRow = function SetRow({ set, displayIdx, isNext, locked, onVal, onRpe, onToggle, onStart }) {
  const shown = set.done || set.touched;
  const [wbuf, setWbuf] = React.useState(null);
  const wval = wbuf != null ? wbuf : fmtWeight(set.weight);
  const isBW = set.weight === 0 && !set.touched;
  return (
    <div className="setrow" data-next={isNext ? '' : undefined} data-done={set.done ? '' : undefined}>
      <button className="set-idx tap" data-warm={set.warm ? '' : undefined}
      disabled={locked} onClick={locked ? undefined : onStart} aria-label="Запустить отдых">
        <span className="si-n">{set.warm ? <I n="bolt" style={{ width: 15, height: 15 }} /> : displayIdx}</span>
        {set.rest ? <span className="si-rest num">{set.rest}с</span> : null}
      </button>

      <label className="field" data-plan={!shown ? '' : undefined} data-filled={shown ? '' : undefined}>
        <input className="finput" type="text" inputMode="numeric" pattern="[0-9]*"
          disabled={locked} placeholder="—"
          value={set.reps === 0 ? '' : String(set.reps)}
          onChange={(e) => onVal('reps', e.target.value.replace(/[^0-9]/g, ''))} />
      </label>

      <label className="field" data-plan={!shown ? '' : undefined} data-filled={shown ? '' : undefined}>
        <input className="finput" type="text" inputMode="decimal"
          disabled={locked} placeholder={isBW ? 'своё' : '—'}
          value={wval}
          onChange={(e) => { const v = e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''); setWbuf(v); onVal('weight', v); }}
          onBlur={() => setWbuf(null)} />
        {wval !== '' ? <span className="fu">кг</span> : null}
      </label>

      <label className="rpe" data-plan={set.rpe == null ? '' : undefined}>
        <select className="rpe-input" disabled={locked}
          value={set.rpe == null ? '' : String(set.rpe)}
          onChange={(e) => onRpe(e.target.value)}>
          <option value="">RPE</option>
          {[6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span className="chev">▾</span>
      </label>

      <button className="check tap" data-done={set.done ? '' : undefined}
      disabled={locked} onClick={locked ? undefined : onToggle} aria-label="Выполнено">
        <I n="checkbold" />
      </button>
    </div>);

};

/* ---------- exercise card ---------- */
window.ExerciseCard = function ExerciseCard({ ex, exIndex, locked, onVal, onRpe, onToggle, onAdd, onRemove, onStartRest }) {
  const doneCount = ex.sets.filter((s) => s.done).length;
  const workCount = ex.sets.length;
  let workIdx = 0;
  const firstUndoneIdx = ex.sets.findIndex((s) => !s.done);
  return (
    <div className="card">
      <div className="ex-head">
        <div className="ex-toprow">
          <span className="ex-name">{ex.name}</span>
          <span className="ex-prog num" data-all={doneCount === workCount ? '' : undefined}>{doneCount}/{workCount}</span>
        </div>
        {ex.note && <span className="ex-note"><span className="bulb">💡</span>{ex.note}</span>}
      </div>

      <div className="setlist">
        <div className="colhead">
          <span>#</span><span>Повт</span><span>Вес</span><span>RPE</span><span>✓</span>
        </div>
        {ex.sets.map((s, si) => {
          if (!s.warm) workIdx += 1;
          return (
            <window.SetRow key={si}
            set={s}
            displayIdx={s.warm ? '🔥' : workIdx}
            isNext={!locked && si === firstUndoneIdx}
            locked={locked}
            onVal={(field, val) => onVal(exIndex, si, field, val)}
            onRpe={(val) => onRpe(exIndex, si, val)}
            onToggle={() => onToggle(exIndex, si)}
            onStart={() => onStartRest && onStartRest(exIndex, si)} />);

        })}
      </div>

      {!locked &&
      <div className="setactions">
          <div className="add-stepper">
            <button className="as-btn tap" onClick={() => onRemove(exIndex)} disabled={ex.sets.length <= 1} aria-label="Убрать подход">
              <I n="minus" />
            </button>
            <button className="as-btn tap" onClick={() => onAdd(exIndex)} aria-label="Добавить подход">
              <I n="plus" />
            </button>
          </div>
        </div>
      }
    </div>);

};

/* ---------- cardio form ---------- */
window.CardioForm = function CardioForm({ day, locked, onType, onVal, onRpe }) {
  const c = day.cardio;
  const ico = { 'Ходьба с уклоном': 'walk', 'Эллипс': 'ellipse', 'Велотренажёр': 'cycle' };
  return (
    <div className="card">
      {day.note && <span className="ex-note" style={{ alignSelf: 'stretch' }}><span className="bulb">💡</span>{day.note}</span>}
      <div className="cardio">
        <div className="frow">
          <div className="flabel">Вид</div>
          <label className="fbig">
            <select className="fbig-input" disabled={locked}
              value={c.type} onChange={(e) => onType(e.target.value)}>
              {window.CARDIO_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="chev">▾</span>
          </label>
        </div>
        <div className="frow">
          <div className="flabel">Длительность</div>
          <label className="fbig">
            <input className="finput big" type="text" inputMode="numeric" pattern="[0-9]*"
              disabled={locked} placeholder="—"
              value={c.duration === 0 ? '' : String(c.duration)}
              onChange={(e) => onVal('duration', e.target.value.replace(/[^0-9]/g, ''))} />
            <span className="bu">мин</span>
          </label>
        </div>
        <div className="frow">
          <div className="flabel">Ср. пульс <span className="opt">— опционально</span></div>
          <label className="fbig" data-plan={c.hr == null ? '' : undefined}>
            <input className="finput big" type="text" inputMode="numeric" pattern="[0-9]*"
              disabled={locked} placeholder="—"
              value={c.hr == null ? '' : String(c.hr)}
              onChange={(e) => onVal('hr', e.target.value.replace(/[^0-9]/g, ''))} />
            <span className="bu">уд/мин</span>
          </label>
        </div>
        <div className="frow">
          <div className="flabel">RPE</div>
          <label className="fbig">
            <select className="fbig-input" disabled={locked}
              value={String(c.rpe)} onChange={(e) => onRpe(e.target.value)}>
              {[6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="chev">▾</span>
          </label>
        </div>
      </div>
    </div>);

};

/* ---------- empty ---------- */
window.EmptyDay = function EmptyDay() {
  return (
    <div className="empty">
      <div className="e-ic"><I n="calx" /></div>
      <div className="e-title">Подходов нет</div>
      <div className="e-sub">Тренер ещё не заполнил план на эту неделю. Выбери другой день или неделю.</div>
    </div>);

};

/* ---------- rest timer (dock) ---------- */
window.RestTimer = function RestTimer({ state, onAdd, onToggle, onSkip }) {
  const mmss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const pct = state.total ? Math.max(0, state.remaining / state.total * 100) : 0;
  if (state.finished) return (
    <div className="resttimer done">
      <div className="rt-top">
        <span className="rt-label">Отдых окончен{state.exName ? ' · ' + state.exName : ''}</span>
        <button className="rt-skip tap" onClick={onSkip}>Готово</button>
      </div>
      <div className="rt-mid">
        <button className="rt-adj tap" onClick={onToggle} aria-label={state.running ? 'Пауза' : 'Продолжить'}>
          <I n={state.running ? 'pause' : 'play'} style={{ width: 18, height: 18 }} />
        </button>
        <button className="rt-overwrap tap" onClick={onToggle}>
          <span className="rt-over num">+{mmss(state.over || 0)}</span>
          <span className="rt-oversub">сверх {mmss(state.total)}</span>
        </button>
        <button className="rt-adj tap" onClick={onSkip} aria-label="Завершить отдых">
          <I n="skip" style={{ width: 18, height: 18 }} />
        </button>
      </div>
      <div className="rt-bar"><i style={{ width: '100%' }}></i></div>
    </div>);

  return (
    <div className="resttimer">
      <div className="rt-top">
        <span className="rt-label">Отдых{state.exName ? ' · ' + state.exName : ''}</span>
        <button className="rt-skip tap" onClick={onSkip}>Пропустить</button>
      </div>
      <div className="rt-mid">
        <button className="rt-adj tap num" onClick={() => onAdd(-15)}>−15</button>
        <button className="rt-time tap" onClick={onToggle}>
          <span className="num">{mmss(state.remaining)}</span>
          <I n={state.running ? 'pause' : 'play'} className="rt-pp" />
        </button>
        <button className="rt-adj tap num" onClick={() => onAdd(15)}>+15</button>
      </div>
      <div className="rt-bar"><i style={{ width: pct + '%' }}></i></div>
    </div>);

};
window.Footer = function Footer({ locked, syncState, onFinish, onRetry }) {
  return (
    <div className="footer">
      <button className="cta tap" data-disabled={locked ? '' : undefined}
      disabled={locked} onClick={locked ? undefined : onFinish}>
        {locked ? 'Тренировка закрыта' : <><I n="flag" className="cta-ic" /> Завершить тренировку</>}
      </button>
      <button className="retry-btn tap" onClick={onRetry} aria-label="Синхронизировать">
        <I n="refresh" className={syncState === 'sync' ? 'spin' : undefined} />
      </button>
    </div>);

};