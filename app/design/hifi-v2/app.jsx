/* app.jsx — состояние приложения + Tweaks */

const ACCENTS = {
  'Синий':  ['#4c8dff', '#f7faff'],
  'Бирюза': ['#22c1bd', '#042120'],
  'Фиолет': ['#8b6cf0', '#f8f6ff'],
};
const PLANS = ['Силовой блок А', 'Силовой блок Б', 'Минимализм 3×5'];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "Синий",
  "amoled": false,
  "touch": 50,
  "offline": false,
  "autostart": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [plan, setPlan] = React.useState(() => window.makePlan());
  const [activeId, setActiveId] = React.useState('d1');
  const [week, setWeek] = React.useState(6);
  const [status, setStatus] = React.useState('active');     // active | completed
  const [sync, setSync] = React.useState('idle');           // idle | sync | ok | off
  const [modal, setModal] = React.useState(null);           // finish | settings
  const [rating, setRating] = React.useState(null);
  const [reveal, setReveal] = React.useState(false);
  const [planIdx, setPlanIdx] = React.useState(0);
  const [loading, setLoading] = React.useState({ on: true, label: 'Подключаемся…', pct: 8 });
  const [timer, setTimer] = React.useState(null);   // {id,exName,total,remaining,running,finished}
  const syncTimer = React.useRef(null);
  const loadTimer = React.useRef(null);
  const settingsBefore = React.useRef(null);

  const day = plan.days.find((d) => d.id === activeId);
  const locked = status === 'completed';

  /* ----- scale device to fit viewport ----- */
  const fitRef = React.useRef(null);
  React.useEffect(() => {
    const fit = () => {
      if (!fitRef.current) return;
      const s = Math.min(1, (window.innerHeight - 24) / 844, (window.innerWidth - 24) / 390);
      fitRef.current.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  /* ----- apply tweaks ----- */
  React.useEffect(() => {
    const r = document.documentElement;
    const [a, on] = ACCENTS[t.accent] || ACCENTS['Синий'];
    r.style.setProperty('--accent', a);
    r.style.setProperty('--on-accent', on);
    r.style.setProperty('--tt', t.touch + 'px');
  }, [t.accent, t.touch]);

  /* ----- offline tweak drives sync ----- */
  React.useEffect(() => {
    if (t.offline) { clearTimeout(syncTimer.current); setSync('off'); }
    else { setSync(status === 'completed' ? 'ok' : 'idle'); }
  }, [t.offline]);

  function flushSync() {
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => setSync('ok'), 850);
  }
  function markDirty() {
    // Изменения локальные — отправляем только по «Завершить».
    if (t.offline) { setSync('off'); return; }
    setSync('idle');
  }

  /* ----- loading sequences ----- */
  function runLoad(seq, done) {
    clearTimeout(loadTimer.current);
    let i = 0;
    const step = () => {
      if (i >= seq.length) { setLoading({ on: false }); done && done(); return; }
      const s = seq[i++];
      setLoading({ on: true, label: s.label, pct: s.pct });
      loadTimer.current = setTimeout(step, s.delay);
    };
    step();
  }
  /* first launch */
  React.useEffect(() => {
    runLoad([
      { label: 'Подключаемся к Google Sheets', pct: 22, delay: 650 },
      { label: 'Читаем план на сегодня', pct: 68, delay: 650 },
      { label: 'Почти готово', pct: 100, delay: 380 },
    ]);
  }, []);
  function reloadPlan() {
    runLoad([
      { label: 'Обновляем план…', pct: 40, delay: 320 },
      { label: 'Читаем таблицу', pct: 82, delay: 460 },
      { label: 'Готово', pct: 100, delay: 260 },
    ]);
  }

  /* ----- settings open/close (week + plan can trigger reload) ----- */
  function openSettings() { settingsBefore.current = { planIdx, week }; setModal('settings'); }
  function closeSettings() {
    setModal(null);
    const b = settingsBefore.current;
    if (b && (b.planIdx !== planIdx || b.week !== week)) { setStatus('active'); reloadPlan(); }
  }

  /* ----- rest timer ----- */
  function startRest(sec, name) {
    if (!sec) return;
    setTimer({ id: Date.now(), exName: name, total: sec, remaining: sec, running: true, finished: false, over: 0 });
  }
  React.useEffect(() => {
    if (!timer || !timer.running) return;
    const iv = setInterval(() => {
      setTimer((tm) => {
        if (!tm || !tm.running) return tm;
        if (!tm.finished) {
          if (tm.remaining <= 1) return { ...tm, remaining: 0, finished: true, over: 0 };
          return { ...tm, remaining: tm.remaining - 1 };
        }
        return { ...tm, over: (tm.over || 0) + 1 };   // переотдых: считаем вверх
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timer && timer.id, timer && timer.running]);
  function timerAdd(d) { setTimer((tm) => tm && !tm.finished ? { ...tm, remaining: Math.max(0, tm.remaining + d), total: Math.max(tm.total, tm.remaining + d) } : tm); }
  function timerToggle() { setTimer((tm) => tm ? { ...tm, running: !tm.running } : tm); }
  function timerSkip() { setTimer(null); }

  /* ----- mutations ----- */
  function mutate(fn) {
    setPlan((prev) => { const next = structuredClone(prev); fn(next); return next; });
  }
  function setFieldValue(exIndex, setIndex, field, raw) {
    mutate((p) => {
      const s = p.days.find((d) => d.id === activeId).exercises[exIndex].sets[setIndex];
      if (field === 'reps') s.reps = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
      else { const v = parseFloat(raw); s.weight = raw === '' ? 0 : (isNaN(v) ? s.weight : v); }
      s.touched = true;
    });
    markDirty();
  }
  function cycleRpe(exIndex, setIndex, val) {
    mutate((p) => {
      const s = p.days.find((d) => d.id === activeId).exercises[exIndex].sets[setIndex];
      s.rpe = val === '' ? null : parseInt(val, 10);
      s.touched = true;
    });
    markDirty();
  }
  function toggleDone(exIndex, setIndex) {
    const ex = day.exercises[exIndex];
    const s0 = ex.sets[setIndex];
    const becoming = !s0.done;
    mutate((p) => {
      const s = p.days.find((d) => d.id === activeId).exercises[exIndex].sets[setIndex];
      s.done = !s.done; s.touched = true;
    });
    markDirty();
    if (becoming && t.autostart && s0.rest) startRest(s0.rest, ex.name);
  }
  function startRestForSet(exIndex, setIndex) {
    const ex = day.exercises[exIndex];
    const s = ex.sets[setIndex];
    startRest(s.rest, ex.name);
  }
  function addSet(exIndex) {
    mutate((p) => {
      const arr = p.days.find((d) => d.id === activeId).exercises[exIndex].sets;
      const last = arr[arr.length - 1];
      arr.push({ reps: last.reps, weight: last.weight, rpe: null, warm: false, rest: last.rest, done: false, touched: false });
    });
    markDirty();
  }
  function removeSet(exIndex) {
    mutate((p) => {
      const arr = p.days.find((d) => d.id === activeId).exercises[exIndex].sets;
      if (arr.length > 1) arr.pop();
    });
    markDirty();
  }

  /* cardio */
  function cardioType(tp) { mutate((p) => { p.days.find((d) => d.id === activeId).cardio.type = tp; }); markDirty(); }
  function cardioSetField(field, raw) {
    mutate((p) => {
      const c = p.days.find((d) => d.id === activeId).cardio;
      if (field === 'hr') c.hr = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
      else c.duration = raw === '' ? 0 : Math.max(0, parseInt(raw, 10) || 0);
    });
    markDirty();
  }
  function cardioRpe(val) {
    mutate((p) => { const c = p.days.find((d) => d.id === activeId).cardio; c.rpe = parseInt(val, 10); });
    markDirty();
  }

  /* flow */
  function submitFinish() {
    setModal(null); setStatus('completed'); setRating(null);
    if (t.offline) setSync('off');
    else { setSync('sync'); flushSync(); }   // единственная отправка факта
  }
  function resetWorkout() {
    mutate((p) => {
      const d = p.days.find((x) => x.id === activeId);
      if (d.exercises) d.exercises.forEach((e) => e.sets.forEach((s) => { s.done = false; s.touched = false; s.rpe = null; }));
    });
    setStatus('active'); markDirty();
  }
  function resend() {
    // Ретрай отправки: имеет смысл только когда тренировка завершена.
    if (t.offline) setTweak('offline', false);   // имитация восстановления сети
    if (status === 'completed') { setSync('sync'); flushSync(); }
  }
  function pickDay(id) { setActiveId(id); setStatus('active'); }
  function cycleWeek() { setWeek((w) => (w >= 8 ? 5 : w + 1)); }

  const isEmpty = day.kind === 'strength' && (!day.exercises || day.exercises.length === 0);

  return (
    <div className="stage">
      <div className="device-fit" ref={fitRef}>
        <div className={'device' + (t.amoled ? ' amoled' : '')}>
        <div className="screen">
          <div className="statusbar">
            <span>9:41</span>
            <span className="sb-right">5G&nbsp;&nbsp;76%</span>
          </div>

          <window.Header day={day} week={week} onSettings={openSettings} />
          <window.DayTabs days={plan.days} activeId={activeId} onPick={pickDay} />
          <window.SyncLine state={sync} onRetry={resend} />

          {isEmpty ? (
            <div className="body" style={{ flex: '1 1 auto' }}><window.EmptyDay /></div>
          ) : (
            <div className="body scroll">
              {locked && <window.Banner kind="done" onReset={resetWorkout} />}
              {day.kind === 'cardio' ? (
                <window.CardioForm day={day}
                  locked={locked} onType={cardioType} onVal={cardioSetField} onRpe={cardioRpe} />
              ) : (
                day.exercises.map((ex, i) => (
                  <window.ExerciseCard key={i} ex={ex} exIndex={i}
                    locked={locked}
                    onVal={setFieldValue} onRpe={cycleRpe} onToggle={toggleDone}
                    onAdd={addSet} onRemove={removeSet} onStartRest={startRestForSet} />
                ))
              )}
            </div>
          )}

          {timer && <window.RestTimer state={timer} onAdd={timerAdd} onToggle={timerToggle} onSkip={timerSkip} />}

          <window.Footer locked={locked || isEmpty} syncState={sync}
            onFinish={() => setModal('finish')} onRetry={resend} />

          <div className="home-indicator"></div>

          {modal === 'finish' && <window.FinishSheet rating={rating} onRate={setRating}
            onClose={() => setModal(null)} onSubmit={submitFinish} />}
          {modal === 'settings' && <window.SettingsSheet plan={PLANS[planIdx]}
            onCyclePlan={() => setPlanIdx((i) => (i + 1) % PLANS.length)}
            week={week} onCycleWeek={cycleWeek}
            reveal={reveal} onReveal={() => setReveal((r) => !r)} onClose={closeSettings} />}

          {loading.on && <window.LoadingScreen label={loading.label} pct={loading.pct} />}
        </div>
      </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Палитра" />
        <TweakColor label="Акцент" value={ACCENTS[t.accent][0]}
          options={Object.values(ACCENTS).map((a) => a[0])}
          onChange={(hex) => {
            const name = Object.keys(ACCENTS).find((k) => ACCENTS[k][0] === hex) || 'Синий';
            setTweak('accent', name);
          }} />
        <TweakToggle label="AMOLED-чёрный фон" value={t.amoled} onChange={(v) => setTweak('amoled', v)} />
        <TweakSection label="Зал-режим" />
        <TweakSlider label="Тач-цели" value={t.touch} min={44} max={60} step={2} unit="px"
          onChange={(v) => setTweak('touch', v)} />
        <TweakToggle label="Автостарт таймера отдыха" value={t.autostart} onChange={(v) => setTweak('autostart', v)} />
        <TweakToggle label="Оффлайн (демо статуса)" value={t.offline} onChange={(v) => setTweak('offline', v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
