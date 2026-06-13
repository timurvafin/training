/* sheets.jsx — боттомшиты (экспорт в window) */
const SI = (props) => <window.Icon {...props} />;

/* ---------- numeric keypad ---------- */
window.NumPad = function NumPad({ label, unit, mode, value, onKey, onQuick, onClose, onCommit }) {
  const allowDot = mode === 'weight';
  const quick = mode === 'weight'
    ? [['-2.5', -2.5], ['+2.5', 2.5], ['+5', 5]]
    : [['-1', -1], ['+1', 1], ['+5', 5]];
  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', allowDot ? '.' : '', '0', 'back'];
  const display = value === '' ? '0' : value;
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab"></div>
        <div className="np-target">
          <span className="npt-label">{label}</span>
          <span className="np-value num">{display}<span className="cursor">|</span></span>
          {unit && <span className="np-unit">{unit}</span>}
        </div>
        <div className="np-quick">
          {quick.map(([t, d]) => (
            <button key={t} className="tap" onClick={() => onQuick(d)}>{t}</button>
          ))}
        </div>
        <div className="np-grid">
          {keys.map((k, i) => k === '' ? <div key={i}></div> : (
            <button key={i} className="np-key tap" data-fn={k === 'back' ? '' : undefined}
              onClick={() => onKey(k)}>
              {k === 'back' ? <SI n="backspace" /> : k}
            </button>
          ))}
        </div>
        <button className="np-done tap" onClick={onCommit}>
          <SI n="check" style={{ width: 20, height: 20 }} /> Готово
        </button>
      </div>
    </div>
  );
};

/* ---------- finish modal ---------- */
window.FinishSheet = function FinishSheet({ rating, onRate, onClose, onSubmit }) {
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab"></div>
        <div className="sheet-title">Как прошла в целом?</div>
        <div className="sheet-sub">Оцени тренировку от 1 до 10</div>
        <div className="scale">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} className="sc tap" data-sel={rating === n ? '' : undefined}
              onClick={() => onRate(n)}>{n}</button>
          ))}
        </div>
        <div className="scale-legend"><span>Легко</span><span>На пределе</span></div>
        <div className="warnbox">
          <span className="w-ic">⚠️</span>
          <span>После отправки запись закрывается — изменить подходы будет нельзя.</span>
        </div>
        <div className="sheet-btns">
          <button className="tap" onClick={onClose}>Отмена</button>
          <button className="primary tap" data-disabled={rating == null ? '' : undefined}
            disabled={rating == null} onClick={onSubmit}>
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- settings modal ---------- */
window.SettingsSheet = function SettingsSheet({ plan, onCyclePlan, week, onCycleWeek, reveal, onReveal, onClose }) {
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab"></div>
        <div className="sheet-title">Настройки</div>

        <div className="frow">
          <div className="flabel">План</div>
          <div className="set-field tap" onClick={onCyclePlan}>
            {plan}<span className="chev">▾</span>
          </div>
          <div className="set-meta">Список тренировок и план берётся из выбранной вкладки таблицы.</div>
        </div>

        <div className="frow">
          <div className="flabel">Неделя</div>
          <div className="set-field tap" onClick={onCycleWeek}>
            Неделя {week}<span className="chev">▾</span>
          </div>
          <div className="set-meta">По умолчанию показывается последняя неделя плана.</div>
        </div>

        <div className="frow">
          <div className="flabel">Секрет записи</div>
          <div className="set-field">
            <span className="pwd">{reveal ? 'gym-2026-Λx9' : '••••••••••'}</span>
            <button className="reveal tap" onClick={onReveal}>{reveal ? 'скрыть' : 'показать'}</button>
          </div>
          <div className="set-meta">Нужен, чтобы приложение могло писать факт обратно в таблицу.</div>
        </div>

        <div className="frow">
          <div className="flabel">Таблица плана</div>
          <div className="set-field">
            <span style={{ fontSize: 15 }}>Google Sheets</span>
            <span className="conn"><SI n="check" style={{ width: 14, height: 14 }} /> подключено</span>
          </div>
        </div>

        <div className="sheet-btns" style={{ marginTop: 4 }}>
          <button className="tap" onClick={onClose}>Закрыть</button>
          <button className="primary tap" onClick={onClose}>Сохранить</button>
        </div>
      </div>
    </div>
  );
};
