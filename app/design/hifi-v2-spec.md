# Имплементационная спека: hifi-v2 → текущее Svelte 5 приложение трекера тренировок

Рабочий референс для переноса дизайн-прототипа `design_handoff_workout_tracker/hifi-v2/`
(React + Babel inline) в существующее Svelte 5 + Vite приложение
(`/Users/timurv/src/personal/projects/training/app/ui/src/`).

Цель спеки — описать **что рисует/делает прототип** и **что добавить/изменить у нас**.
Tweaks-панель НЕ переносим (это инструмент прототипа). Скейл «рамка телефона»
(`device-fit`) и статусбар-имитация iOS — опциональны (у нас апп идёт на весь экран
реального телефона; см. README.md:44-46 — можно сделать корневой контейнер `100dvh`).

Все ссылки `файл:строки` — относительно `hifi-v2/` прототипа, если не сказано иное.

---

## 1. Дерево компонентов (прототип)

Корень — `App()` (`app.jsx:18`). Структура DOM (`app.jsx:227-295`):

```
App (stage → device-fit → device[.amoled] → screen)
├─ statusbar              «9:41 · 5G 76%»            app.jsx:232-235 (имитация iOS, опц.)
├─ Header                 заголовок дня + ⚙          parts.jsx:5
├─ DayTabs                горизонтальные пилюли дней parts.jsx:41
├─ SyncLine               строка статуса отправки    parts.jsx:59
├─ body (.scroll)         список контента:
│   ├─ Banner (если locked)        «Завершена»       parts.jsx:81
│   ├─ EmptyDay (если день пуст)                      parts.jsx:253
│   ├─ CardioForm (если kind==cardio)                parts.jsx:200
│   └─ ExerciseCard × N (силовой)                    parts.jsx:148
│        └─ SetRow × M                                 parts.jsx:100
├─ RestTimer (если timer != null)  док над футером   parts.jsx:264   ← НОВОЕ (v2)
├─ Footer                 CTA «Завершить» + ↻         parts.jsx:306
├─ home-indicator         (косметика, опц.)
├─ FinishSheet (modal==finish)                       sheets.jsx:43
├─ SettingsSheet (modal==settings)                   sheets.jsx:74
└─ LoadingScreen (loading.on)  оверлей z-80          parts.jsx:26
```

(`NumPad`, `sheets.jsx:5` — кастомная клавиатура — **НЕ используется**: поля стали
нативными `<input>`. Игнорировать, у нас тоже нативные.)

Что каждый принимает/рендерит:

- **Header** `{day, week, onSettings}` (`parts.jsx:5-23`): слева `day.name` (28/700) и
  подзаголовок `day.sub · Неделя {week}` (точка-разделитель `.dotsep`); справа кнопка-шестерёнка
  `.iconbtn` 44×44. **Селекта недели в шапке НЕТ** — неделя только текстом в подзаголовке.

- **DayTabs** `{days, activeId, onPick}` (`parts.jsx:41-56`): `{#each days}` → `.tab`.
  `data-active` на активном (фон `--accent`); `data-cardio` на кардио (dashed border + иконка walk).

- **SyncLine** `{state, onRetry}` (`parts.jsx:59-78`): `.sync[data-s=state]` с точкой `.sdot`
  и текстом из карты состояний. При `ok` — галочка; при `off` — кнопка «Повторить». Детали §4.

- **Banner** `{kind, onReset}` (`parts.jsx:81-95`): `done` → зелёный «Тренировка завершена и
  отправлена» + «Начать заново»; `pending` → spinner «Идёт отправка…».

- **SetRow** `{set, displayIdx, isNext, locked, onVal, onRpe, onToggle, onStart}` (`parts.jsx:100-145`):
  один подход — сетка `30px 1fr 1fr 62px var(--tt)` (`.setrow`). Колонки: `.set-idx` (кнопка
  номер+rest, запускает таймер), `.field` повт (`input` numeric), `.field` вес (`input` decimal +
  `кг`), `.rpe` (`select` пусто/6-10), `.check` (галочка). Детали §9.

- **ExerciseCard** `{ex, exIndex, locked, onVal, onRpe, onToggle, onAdd, onRemove, onStartRest}`
  (`parts.jsx:148-197`): шапка `ex.name` + прогресс `doneCount/workCount` (`.ex-prog`, зелёный
  `data-all` когда все ✓); опц. note-пилюля; `.colhead`; `{#each ex.sets}` → `SetRow`; степпер
  ±подход (`.add-stepper`, скрыт при `locked`). `firstUndoneIdx` → проброс `isNext` для подсветки.

- **CardioForm** `{day, locked, onType, onVal, onRpe}` (`parts.jsx:200-250`): note-пилюля + 4 поля
  (`.fbig`): Вид (`select`), Длительность (`input` numeric, `мин`), Ср. пульс (`input` numeric, опц.,
  `уд/мин`), RPE (`select` 6-10).

- **EmptyDay** (`parts.jsx:253`): иконка-плейсхолдер `calx` 84×84 + «Подходов нет» + текст.

- **RestTimer** `{state, onAdd, onToggle, onSkip}` (`parts.jsx:264-305`): док-бар. Детали §3.

- **Footer** `{locked, syncState, onFinish, onRetry}` (`parts.jsx:306-318`): CTA «Завершить
  тренировку» (флаг-иконка; при `locked` → «Тренировка закрыта» disabled) + квадрат ↻ (крутится
  при `sync`).

- **LoadingScreen** `{label, pct}` (`parts.jsx:26-38`): бренд-бейдж + спиннер-кольцо + статус-текст +
  прогресс-бар (`width: pct%`). Детали §5.

- **FinishSheet** `{rating, onRate, onClose, onSubmit}` (`sheets.jsx:43`): §7.
- **SettingsSheet** `{plan, onCyclePlan, week, onCycleWeek, reveal, onReveal, onClose}` (`sheets.jsx:74`): §6.

---

## 2. Модель данных (прототип)

### Подход (set)
Фабрика `S(reps, weight, opt)` в `data.jsx:4-7`:
```
{ reps:number, weight:number, rpe:number|null, warm:boolean,
  rest:number(сек, по умолчанию 90), done:false }
```
Поле **`touched`** добавляется в рантайме при первой правке/тоггле (`app.jsx:146,154,163`).
В `addSet` явно создаётся полный объект (`app.jsx:177`):
```
{ reps, weight, rpe:null, warm:false, rest:last.rest, done:false, touched:false }
```
Итоговая форма подхода: **`{reps, weight, rpe, warm, rest, done, touched}`**.

- **`warm`** — разминочный подход. В UI: вместо номера иконка-молния 🔥 (`bolt`, цвет `--warn`),
  rest обычно меньше (45с). Автостарт таймера срабатывает только для **рабочих** подходов
  (`if (becoming && t.autostart && s0.rest) startRest(...)` — стартует и для разминки тоже,
  но семантически акцент на рабочих; см. README.md:224).
- **`touched`** — пользователь коснулся поля (правил повт/вес/rpe или жал ✓). Управляет
  отображением: `shown = set.done || set.touched` (`parts.jsx:101`) → плановое значение faint
  (`--text-3`) против введённого яркого; влияет на `data-plan`/`data-filled` и плейсхолдер «своё»
  для веса тела (`isBW = weight===0 && !touched`, `parts.jsx:103`).
- **`rest`** — длительность отдыха **этого** подхода в секундах. Примеры из `data.jsx`:
  - Жим лёжа: разминка `45`, рабочие `120, 120, 150` (`data.jsx:15-16`).
  - Жим гантелей под углом: `90, 90, 90` (`data.jsx:17-18`).
  - Разгибания/изоляция: `60` (`data.jsx:19-20`).
  - Брусья: `90` (`data.jsx:21-22`).
  - Тяга верх. блока: разминка `45`, рабочие `120` (`data.jsx:28-29`).
  - Тяга нижнего блока: `75` (`data.jsx:32-33`).
  Под номером подхода видна как `«120с»` (`.si-rest`, `parts.jsx:110`).

### Упражнение
```
{ name:string, note:string, sets:Set[] }
```
(`data.jsx:15`). `note` — текст подсказки-пилюли (`💡 RIR 1–2`); пустая строка → пилюли нет.

### День
```
{ id, kind:'strength'|'cardio', name, sub, exercises:[], (cardio?{...}), (note?) }
```
(`data.jsx:12`). Кардио-день: `cardio: {type, duration, hr:null, rpe}` (`data.jsx:45`),
`note` на уровне дня. Силовой день с `exercises: []` → пустое состояние (`data.jsx:40`).

### План
```
{ week:number, days:Day[] }   // data.jsx:10-53
```
`window.CARDIO_TYPES = ['Ходьба с уклоном','Эллипс','Велотренажёр']` (`data.jsx:55`).

### Форма state приложения (React, `app.jsx:21-34`)
| state | тип / значения | назначение |
|---|---|---|
| `plan` | `makePlan()` | дерево дни→упражнения→подходы |
| `activeId` | `'d1'` (id дня) | текущий день |
| `week` | `6` | текущая неделя (число) |
| `status` | `'active'\|'completed'` | завершена ли тренировка → `locked` |
| `sync` | `'idle'\|'sync'\|'ok'\|'off'` | статус отправки (по умолч. `idle`) |
| `modal` | `null\|'finish'\|'settings'` | открытая модалка |
| `rating` | `number\|null` | оценка в FinishSheet |
| `reveal` | `bool` | показ секрета в настройках |
| `planIdx` | `0` | индекс выбранного плана (циклится) |
| `loading` | `{on, label, pct}` | оверлей загрузки |
| `timer` | `null \| {id,exName,total,remaining,running,finished,over}` | rest-таймер (НОВОЕ) |

`day = plan.days.find(d=>d.id===activeId)`; `locked = status==='completed'` (`app.jsx:36-37`).

---

## 3. Rest-таймер (детально) — НОВОЕ в v2

### Структура `timer`
`startRest(sec, name)` (`app.jsx:114-117`):
```
{ id: Date.now(),     // ключ для пересоздания интервала
  exName: string,     // имя упражнения для подписи «ОТДЫХ · <name>»
  total: sec,         // исходная длительность (для прогресс-бара и «сверх M:SS»)
  remaining: sec,     // текущий обратный отсчёт
  running: true,      // идёт/на паузе
  finished: false,    // достигли 0 → режим переотдыха
  over: 0 }           // секунды сверх (только когда finished)
```
`if (!sec) return` — пустой rest таймер не запускает.

### Запуск
1. **Авто при ✓ рабочего подхода** (`toggleDone`, `app.jsx:157-167`):
   `if (becoming && t.autostart && s0.rest) startRest(s0.rest, ex.name)` —
   только при переходе в done (`becoming=!s0.done`), с учётом Tweak `autostart` (по умолч. `true`)
   и наличия `rest`. **У нас:** `autostart` становится настройкой приложения (не Tweak).
2. **Вручную тапом по ячейке номера** (`startRestForSet`, `app.jsx:168-172`):
   тап по `.set-idx` (`parts.jsx:108`, `onStart`) → `startRest(s.rest, ex.name)`.
   Срабатывает и для уже сделанных, и для несделанных подходов; перезапускает таймер.

### Тик (setInterval 1с)
`React.useEffect` (`app.jsx:118-131`), зависимости `[timer.id, timer.running]`:
```
каждую 1000мс, если timer && running:
  если !finished:
    если remaining <= 1 → {remaining:0, finished:true, over:0}   // достигли нуля
    иначе               → remaining - 1
  если finished:        → over + 1                                // переотдых, счёт ВВЕРХ
```
Очистка: `return () => clearInterval(iv)` — при смене id/running/размонтаже.
**У нас (Svelte 5):** `$effect` с `setInterval`, cleanup в return эффекта (или `onDestroy`).
Зависеть от `timer.id` и `timer.running`, чтобы пауза останавливала интервал.

### −15 / +15
`timerAdd(d)` (`app.jsx:132`): только когда `!finished`.
`remaining = max(0, remaining + d)`, `total = max(total, remaining + d)`
(увеличиваем total, чтобы бар не переполнялся при +15). Кнопки `.rt-adj` `−15`/`+15`
(`parts.jsx:295,300`).

### Пауза / продолжить
`timerToggle()` (`app.jsx:133`): `running = !running`. Тап по большой ячейке времени
`.rt-time` (`parts.jsx:296`) или по `.rt-adj` play/pause в переотдыхе. Иконка `pause`↔`play`
по `state.running` (`parts.jsx:298,275`). Пауза работает и в переотдыхе.

### Переотдых (после 0)
Когда `finished=true` (`parts.jsx:267-286`):
- Контейнер `.resttimer.done` → **янтарный** фон `--warn-tint`, border warn, короткий пульс тени
  `rtpulse 1.3s ease 2` (2 цикла) (`app.css:214-215`).
- Подпись «Отдых окончен · <exName>» (`parts.jsx:270`), справа кнопка «**Готово**» (`rt-skip`).
- Центр: `.rt-adj` pause/play | `.rt-overwrap` с `+M:SS` (счёт `over` **вверх**, цвет `--warn`,
  `.rt-over`) и подписью «сверх M:SS» (от `total`) | `.rt-adj` skip-иконка.
- Бар `width:100%`, янтарный (`app.css:238`).
- «Готово»/skip → `timerSkip()` = `setTimer(null)` (`app.jsx:134`) — убирает док.

### Формат времени
`mmss(s) = floor(s/60) + ':' + (s%60).padStart(2,'0')` (`parts.jsx:265`). Шрифт `--f-num`,
размер 30px (`.rt-time .num`), tabular-nums.

### Нормальный режим (не finished)
`pct = remaining/total*100` → ширина бара `.rt-bar i` (transition `width .95s linear`, `app.css:237`).
Подпись «Отдых · <exName>» + «Пропустить» (`parts.jsx:291-292`).

---

## 4. Статусы синка

Карта текстов (`parts.jsx:60-65`), цвета (`app.css:59-67`):

| state | текст | цвет / фон | элемент |
|---|---|---|---|
| `idle` | «Черновик — отправится при завершении» | `--text-2` / `--surface-2`, серая точка `--text-3` | (черновик во время ввода) |
| `sync` | «Отправляем…» | `--accent` / `--accent-tint`, синяя точка **пульсирует** (`pulse 1s`) | коротко после завершения |
| `ok` | «Отправлено в таблицу» + ✓ | `--ok` / `--ok-tint`, зелёная точка | успех |
| `off` | «Оффлайн — отправится позже» + кнопка «Повторить» | `--warn` / `--warn-tint`, янтарная точка | оффлайн |

**Ключевое правило:** синхронизация **НЕ на каждое изменение**. Во время ввода
`markDirty()` ставит `idle` (или `off` если оффлайн) (`app.jsx:71-75`). Единственная реальная
отправка факта — по «Завершить» (`submitFinish`, `app.jsx:205-209`): `sync` → `flushSync()`
(`setTimeout 850мс`) → `ok`. Оффлайн (`submitFinish` при `t.offline`) → сразу `off`; ретрай
`resend()` (`app.jsx:217-221`) → `sync` → `ok`.

---

## 5. Экран загрузки

`runLoad(seq, done)` (`app.jsx:78-88`): проигрывает массив шагов `{label, pct, delay}`,
каждый шаг — `setLoading({on:true,label,pct})` + `setTimeout(step, delay)`; в конце `{on:false}` +
колбэк. `LoadingScreen` (`parts.jsx:26-38`): бренд-бейдж `bolt` + «Тренировки» (23/800),
спиннер-кольцо 52px (`.ring`, `border-top:--accent`, `spin .8s linear infinite`), статус-текст
(`key={label}` для ремоунта), прогресс-бар `.lbar i` (`width:pct%`, transition `.45s`).

### (а) Первый запуск (`app.jsx:90-96`, ~1.7с суммарно)
```
«Подключаемся к Google Sheets»  pct 22  delay 650
«Читаем план на сегодня»        pct 68  delay 650
«Почти готово»                  pct 100 delay 380
```
Стартовый state: `{on:true, label:'Подключаемся…', pct:8}` (`app.jsx:30`).

### (б) Смена плана/недели (`reloadPlan`, `app.jsx:97-103`, ~1с)
```
«Обновляем план…»  pct 40  delay 320
«Читаем таблицу»   pct 82  delay 460
«Готово»           pct 100 delay 260
```

Визуал: оверлей `.loading` z-80 на весь экран (`app.css:317-343`), фон `--app` + лёгкий
радиальный `--accent-tint` сверху.

---

## 6. Настройки (SettingsSheet)

Боттомшит (`sheets.jsx:74-121`). Поля (каждое `.frow` + `.set-field` + `.set-meta`):

1. **План** — `.set-field` кликабельный, циклит `PLANS = ['Силовой блок А','Силовой блок Б',
   'Минимализм 3×5']` (`app.jsx:8`) через `onCyclePlan` (`(i+1)%PLANS.length`, `app.jsx:270`).
   Подпись: «Список тренировок и план берётся из выбранной вкладки таблицы.»
2. **Неделя** — `.set-field` кликабельный, циклит 5→8→5 (`cycleWeek`, `app.jsx:223`:
   `w>=8 ? 5 : w+1`). Текст «Неделя {week}». Подпись «По умолчанию показывается последняя
   неделя плана.» **Неделя теперь ЗДЕСЬ, не в шапке** (см. §10 DIFF).
3. **Секрет записи** — маска `••••••••••` / реальное значение, кнопка «показать/скрыть»
   (`reveal`/`onReveal`, цвет `--accent`).
4. **Таблица плана** — статика «Google Sheets · ✓ подключено».
5. Кнопки «Закрыть» / «Сохранить» (обе вызывают `onClose`).

**Логика open/close** (`app.jsx:106-111`):
- `openSettings()` запоминает `settingsBefore = {planIdx, week}`.
- `closeSettings()`: если `planIdx` **ИЛИ** `week` изменились → `setStatus('active')` +
  `reloadPlan()` (экран загрузки «Обновляем план…», §5б). Т.е. при смене **плана или недели**:
  loading → перечитать план → статус в active.

---

## 7. FinishSheet

Боттомшит (`sheets.jsx:43-71`):
- Заголовок «Как прошла в целом?» + подпись «Оцени тренировку от 1 до 10».
- **Шкала 1–10**: `grid-template-columns: repeat(5,1fr)` (`.scale`, `app.css:398-400`) = **сетка 5×2**,
  10 ячеек `.sc` height 54. Выбранная (`data-sel`, `rating===n`) → фон `--accent` + `--on-accent`
  + тень. Легенда под шкалой: «Легко» … «На пределе» (`.scale-legend`).
- **Предупреждение** (`.warnbox`, `--warn-tint`, border warn): ⚠️ «После отправки запись
  закрывается — изменить подходы будет нельзя.»
- Кнопки: «Отмена» (вторичная, `onClose`) / «Отправить» (`.primary`, `--accent`,
  **`disabled` пока `rating == null`**, `sheets.jsx:63-64`). Отправка → `submitFinish` → состояние
  «Завершено» (`status='completed'`, `sync`→`ok`).

---

## 8. Тема / токены

Все в `theme.css` (`:root` `theme.css:7-42`, `.amoled` `:44-52`), компонентные классы в `app.css`.

### CSS-переменные
**Шрифты:** `--f-ui: 'Hanken Grotesk', ...` (текст/UI); `--f-num: 'Space Grotesk', ...`
(числа/вес/повторы/таймер) — везде с `font-variant-numeric: tabular-nums`.

**Тач-цель:** `--tt: 50px` (Tweak 44–60; у нас — настройка или константа 50px).
Используется как высота полей, галочки, ячейки номера; и в grid-колонке `.setrow`/`.colhead`.

**Цвета (Графит, дефолт):**
```
--page #090b0f   --app #0f141b   --surface #171d26   --surface-2 #1e2530   --surface-3 #29313e
--hair rgba(255,255,255,.075)    --hair-2 rgba(255,255,255,.13)
--text #eef1f6   --text-2 #a4adbb   --text-3 #6b7482
--accent #4c8dff   --on-accent #f7faff   --ok #2fbf71   --warn #f0a93b   --danger #f2655a
--accent-tint/-ring (color-mix accent 16%/55%)   --ok-tint (15%)   --warn-tint (15%)
```
**AMOLED** (класс `.amoled` на корне): `--page/--app:#000`, `--surface:#0b0e13`,
`--surface-2:#14181f`, `--surface-3:#1d232c`, hair ярче.
**Альт-акценты** (`app.jsx:3-7`): Синий `#4c8dff`/`#f7faff`, Бирюза `#22c1bd`/`#042120`,
Фиолет `#8b6cf0`/`#f8f6ff`. Меняются через `--accent`/`--on-accent`.

**Радиусы:** `--r-card:20px`, `--r-field:14px`, `--r-pill:999px`.
**Тени:** `--shadow: 0 8px 30px rgba(0,0,0,.45)`; `--shadow-sheet: 0 -14px 50px rgba(0,0,0,.55)`.

### Ключевые компонентные классы (`app.css`)
- `.hdr/.hdr-title/.hdr-sub/.dotsep` — шапка (`:6-14`).
- `.iconbtn` — кнопка-шестерёнка 44×44 (`:23`). (`.weekbtn` — есть в CSS, но в v2 не рендерится.)
- `.tabs/.tab[data-active][data-cardio]` — вкладки дней (`:31-49`).
- `.sync[data-s]/.sdot/.sync-retry` — строка синка (`:52-67`); `@keyframes pulse/spin` (`:68-70`).
- `.body[.scroll]` — контейнер контента (`:73`).
- `.banner[data-kind]/.b-act` — баннер завершения (`:76-89`).
- `.card/.ex-head/.ex-name/.ex-prog[data-all]/.ex-note/.bulb` — карточка упражнения (`:92-108`).
- `.colhead/.setlist/.setrow[data-next][data-done]` — таблица подходов (`:111-123,188-192`).
- `.set-idx[data-warm]/.si-n/.si-rest` — ячейка номера+rest (`:124-131`).
- `.field[data-plan][data-filled]:focus-within/.fv/.fu/.finput/.finput.big` — поля повт/вес (`:133-153`).
- `.rpe[data-plan]/.rpe-input/.chev` — RPE select (`:155-174`).
- `.check[data-done]` + `.setrow[data-next] .check` (ring) — галочка (`:176-191`).
- `.setactions/.add-stepper/.as-btn` — степпер ±подход (`:194-205`).
- `.resttimer[.done]/.rt-top/.rt-label/.rt-skip/.rt-mid/.rt-adj/.rt-time/.rt-bar/.rt-overwrap/.rt-over` —
  таймер (`:207-245`); `@keyframes rtpulse` (`:215`).
- `.footer/.cta[data-disabled]/.retry-btn` — футер (`:247-267`).
- `.cardio/.frow/.flabel/.fbig[data-plan]/.fbig-input/.seg-pills` — кардио-форма (`:269-298`).
- `.empty/.e-ic/.e-title/.e-sub` — пустой день (`:300-312`).
- `.loading/.brand/.mark/.ring/.lstatus/.lbar` — загрузка (`:317-343`).
- `.sheet-scrim/.sheet/.grab/.sheet-title/.sheet-sub/.sheet-btns/.primary` — боттомшиты (`:348-423`).
- `.scale/.sc[data-sel]/.scale-legend/.warnbox` — финиш-шкала (`:398-414`).
- `.set-field/.pwd/.reveal/.conn/.set-meta` — настройки (`:426-434`).

### Типографика (README.md:92-95)
заголовок дня 28/700; имя упражнения 19/700; тело 16; подписи 14; колонки таблицы 11.5 uppercase;
число в поле 17-19/600; таймер 30; шкала финиша 19.

---

## 9. Поля ввода

- **Повт** (`parts.jsx:113-118`): `<input type="text" inputMode="numeric" pattern="[0-9]*">`,
  плейсхолдер `—`, очистка `value.replace(/[^0-9]/g,'')`; пусто → `reps=0`, подход не отмечен.
- **Вес** (`parts.jsx:120-127`): `<input inputMode="decimal">`, нормализация
  `value.replace(',','.').replace(/[^0-9.]/g,'')` — **запятая → точка**. Локальный буфер `wbuf`
  (`React.useState`) держит строку во время набора дробных (`62.5`), сбрасывается `onBlur`.
  Плейсхолдер: `'своё'` если `isBW` (вес тела, `weight===0 && !touched`), иначе `'—'`. Единица
  `кг` (`.fu`) показывается только при непустом значении.
- **RPE** (`parts.jsx:129-137`): `<select>` `RPE`(пусто)/6/7/8/9/10, шеврон `▾` (`.chev`).
- **Кардио Длительность/Пульс** (`parts.jsx:220-235`): `inputMode="numeric"`, `.finput.big` (22px);
  пульс опционален, плейсхолдер `—`, `data-plan` когда `hr==null`.
- **Faint/яркость:** в покое плановое — `--text-3` (`data-plan`); после ввода/✓ — ярче, фон
  `--surface-3` (`data-filled`). Управляется `shown = done || touched` (`parts.jsx:101`).
- **`:focus-within`** (`app.css:143,162,290`): border `--accent` + `box-shadow: 0 0 0 4px
  --accent-tint`. На `.field`/`.rpe`/`.fbig`.
- **next-undone ✓ с ring** (`app.css:188-191`): первый невыполненный подход (`isNext`,
  `si===firstUndoneIdx`) → `.check` получает border `--accent-ring` + `box-shadow: 0 0 0 4px
  --accent-tint`. Выполненная строка `data-done` → поля получают лёгкий зелёный тинт (`app.css:192`).

---

## 10. DIFF против нашего текущего приложения

Наше приложение: `ui/src/App.svelte`, `ui/src/lib/*.svelte`, `lib/store.svelte.js`, `lib/state.js`,
`lib/storage.js`, `lib/api.js`, `app/logic.ts`, `app/DATA-CONTRACT.md`.
Наша модель шире прототипа (реальный Google Sheets бэкенд, свободный текст в reps/weight,
недели как строки-метки «Неделя 16 (план)», кардио как отдельный лист). **Прототип — это
визуал+UX; бэкенд-контракт менять НЕ нужно.**

### A. Что у нас УЖЕ есть и переиспользуемо (НЕ трогать)
- **Идемпотентность** по `session_id` (UUID, `state.js:7`; проверка дубля `logic.ts:174`
  `findDuplicate`; колонка A «Сессии»). Прототип этого не моделирует — оставляем как есть.
- **Offline-ретрай**: `app.showRetry` + `initOnlineListener` (online → `syncNow`,
  `store.svelte.js:237-241`) + авто-ретрай при перезапуске (`initAfterPlan`, `:108-113`).
  Покрывает `off`/«Повторить» прототипа.
- **`collectSets`** (`logic.ts:214`) — STATE.exercises → payload sets (учёт `done || reps`).
- **`buildPayload`** (`state.js:62`) — заморозка снимка для отправки (силовой/кардио).
- **`buildState`** (`state.js:31`) — пустая сессия из плана+недели (faint плановые значения уже
  есть: `target_reps`, `weight` из `byWeek`).
- **Freeze payload + lock**: `finalizing`/`payload`/`_submitting`/`synced` (`store.svelte.js`) —
  богаче, чем `status`/`sync` прототипа. `locked` уже выводится (`App.svelte:19`).
- **Guard несинхронизированного** при смене дня/недели/плана (`guardUnsynced`,
  `store.svelte.js:124`) — прототип теряет прогресс молча; наш `confirm()` лучше, **сохранить**.
- Нативные `<input inputmode>` с нормализацией запятой в весе уже есть (`SetRow.svelte:15`).
- RPE-селект пусто/6-10 уже есть (`SetRow.svelte:17-19`).
- Степпер ±подход, тоггл warmup/done, кардио-форма — есть.

### B. Что ДОБАВИТЬ (нового в прототипе нет у нас)

**B1. Поле `rest` на подходе (НЕТ в нашем DATA-CONTRACT / плане).**
Сейчас наш план приходит из вкладки «План» как `повт×вес` по неделям (`logic.ts:parseCell`,
`PlanSet.byWeek: {reps, weight}`). Поля длительности отдыха **нет нигде**: ни в `Cell`
(`logic.ts:12-15`), ни в `buildState` (`state.js:54`), ни в контракте (`DATA-CONTRACT.md:34`).
Варианты, как хранить `rest` в плане-листе (предложение):
  - **Рекомендуется:** отдельная колонка после «Разминка» (C) — напр. `D=Отдых(сек)`, недели
    сдвигаются на E+. Парсер `parsePlanValues` читает колонки по позиции (`logic.ts:106-141`,
    недели с индекса 3) — потребует сдвинуть стартовый индекс недель и прокинуть `rest` в `PlanSet`.
    Это структурное изменение контракта (раздел «Формат вкладки План», `DATA-CONTRACT.md:23-34`).
  - **Альтернатива (меньше ломает):** `rest` внутри ячейки недели как суффикс
    (`8×62.5@120`) — парсить в `parseCell` (`logic.ts:94-100`), не трогая раскладку колонок.
    Минус: засоряет ячейку плана.
  - **Альтернатива (без листа):** дефолты по типу подхода в клиенте (разминка 45с, рабочий 90с,
    последний 120-150с) + ручная правка ±15 в таймере. Не требует менять контракт; `rest`
    задаётся в `buildState`. Самый быстрый путь к рабочему таймеру.
  В любом случае: добавить `rest:number` в STATE-подход (`state.js:54` — объект подхода
  получает `rest`), и в `addSet` копировать `rest` с последнего (как `app.jsx:177`).
  `rest` в payload/«Сессии» писать НЕ обязательно (это план, а не факт) — можно не расширять
  `collectSets`/`buildSessionRows`.

**B2. Rest-таймер (полностью новый компонент + состояние).** См. §3.
  - Новый `RestTimer.svelte` (`parts.jsx:264` как референс верстки).
  - Новое поле в сторе: `app.timer = null | {id,exName,total,remaining,running,finished,over}`.
  - Действия в `store.svelte.js`: `startRest(sec,name)`, `timerAdd(d)`, `timerToggle()`,
    `timerSkip()`. Тик — `$effect` с `setInterval(1000)`, cleanup в return (зависит от
    `timer.id`+`timer.running`). См. логику `app.jsx:114-134`.
  - Авто-старт в `toggleDone` (`store.svelte.js:159`): при переходе в done и включённой настройке
    autostart и наличии `rest` → `startRest`. Ручной старт — тап по ячейке номера (`SetRow.svelte`,
    сейчас `.idx` тогглит warmup; нужно развести: тап = старт таймера, а warmup-тоггл —
    другим жестом/местом, или warmup приходит из плана и в рантайме не меняется).
  - Настройка `autostart` (по умолч. true) — добавить в `storage.js`/настройки (не Tweak).

**B3. Экран загрузки (у нас простой статус-текст).** Сейчас — однострочный `StatusBar`
  (`.status`, `state.js`→`setStatus`) c сообщениями «Загрузка планов…»/«Загрузка плана…»
  (`store.svelte.js:52,67`). Нет полноэкранного оверлея, спиннера, прогресс-бара, пошаговости.
  Добавить:
  - `LoadingScreen.svelte` (`parts.jsx:26`) + `app.loading = {on,label,pct}`.
  - `runLoad(seq, done)` секвенсор (`app.jsx:78`). Привязать к реальным этапам: первый запуск —
    обернуть `loadPlan()`/`fetchPlan()`; смена плана/недели — обернуть `fetchPlan(newPlan)`
    (`store.svelte.js:65`) и пересборку сессии в `selectWeek` (`:131`). Тайминги §5 — ориентир;
    у нас управлять `pct` по фактическим стадиям (listPlans → getPlan → build).
  - Можно оставить `StatusBar` как вторичный индикатор после загрузки (idle/sync/ok/err уже есть).

**B4. SyncLine как отдельная строка-статус «черновик».** У прототипа выделенная строка
  `.sync[data-s]` (§4) с явным «Черновик — отправится при завершении». У нас статус идёт через
  `app.status {cls,msg}` + `StatusBar` (классы `s-idle/s-sync/s-ok/s-err/s-local`, `app.css:23-24`).
  Маппинг наших состояний → визуал прототипа:
  - наш `s-idle` (черновик/ввод) → `idle` «Черновик — отправится при завершении»;
  - `s-sync` (`_submitting`) → `sync` «Отправляем…» (пульс точки);
  - `s-ok` (`synced`) → `ok` «Отправлено в таблицу» + ✓;
  - `s-local`/offline (`showRetry`, нет сети) → `off` «Оффлайн — отправится позже» + «Повторить»
    (→ `syncNow`).
  Реализовать `SyncLine.svelte` поверх существующего `app.status`/`showRetry`, не меняя логику
  отправки (`syncNow` уже единственная точка реальной отправки — совпадает с правилом
  «sync только при Завершить»).

### C. Что ИЗМЕНИТЬ (есть, но иначе)

**C1. Неделя: из шапки → в настройки.** Сейчас `<select>` недели в `Header.svelte:9-15`
  (`selectWeek`). Прототип: неделя только текстом в подзаголовке шапки (`parts.jsx:11-14`), а
  выбор — в SettingsSheet (§6), и смена недели → экран загрузки + перечитать план + статус active.
  Изменить:
  - Убрать `<select>` из `Header.svelte`; добавить текст «Неделя {week}» в подзаголовок
    (нужно прокинуть `day.sub` — у нас нет `sub`; можно собрать из имён упражнений или опустить).
  - Перенести выбор недели в `SettingsModal.svelte` (сейчас там только План+Секрет).
  - В `selectWeek` (`store.svelte.js:131`) — обернуть в loading-секвенс (B3) и оставить `active`.
  - Наши недели — **строки-метки** (`plan.weeks: string[]`, напр. «Неделя 16 (план)»),
    не числа 5-8. Селект недели, не циклер; «по умолчанию последняя» уже реализовано
    (`initAfterPlan`, `store.svelte.js:117`).

**C2. План: select → стиль `.set-field` (циклер/селект).** У нас `<select bind:value>`
  (`SettingsModal.svelte:13-15`) по `app.plans` (реальные вкладки «План: …»). Прототип циклит
  3 хардкод-плана. Сохранить нашу логику (реальные планы), только переверстать под `.set-field`.
  Смена плана уже триггерит `fetchPlan` + guard (`store.svelte.js:244-263`) — добавить loading (B3).

**C3. FinishModal: `<select>` → шкала-сетка 5×2.** Сейчас «Самочувствие» — `<select>` 1-10
  (`FinishModal.svelte:12-15`), кнопка «Завершить» всегда активна. Прототип: grid 5×2 кнопок
  (§7), легенда «Легко…На пределе», warn-box, «Отправить» disabled пока нет балла. Изменить
  верстку на `.scale`, добавить блокировку кнопки до выбора `rating`/`feel`. (Наш `feel` уже
  валидируется 1-10 на бэке, `logic.ts:155-158`.)

**C4. Карточки/поля → тёмная hi-fi тема.** Полностью заменить `app.css` нашими токенами из
  `theme.css` + классами `app.css` прототипа. Наша текущая палитра (`--bg:#0f1115` и т.д.,
  `ui/src/app.css:1`) и сетка `.set` (`34px 1fr 1fr 1.1fr 44px`, `:34`) → новая
  `30px 1fr 1fr 62px var(--tt)` (`app.css:113,121`). Перенести шрифты (Hanken/Space Grotesk),
  `--tt`, радиусы, тени, состояния `data-plan/data-filled/data-next/data-done/focus-within`.
  Для singlefile-сборки заинлайнить шрифты (README.md:50-51).

**C5. Banner/Footer.** Наш `Banner.svelte` (synced/finalizing) → стиль `.banner[data-kind]`
  (done/pending). Наш `Footer.svelte` (CTA + `.retry` ↻ когда `showRetry`) → стиль `.cta` +
  `.retry-btn` (флаг-иконка, ↻ крутится при sync). Логика совпадает — только верстка/иконки.

**C6. Иконки.** Прототип — инлайн-SVG (`icons.jsx`): gear, checkbold, plus, minus, refresh, flag,
  calx, walk/cycle/ellipse, bolt, timer/pause/play/skip. У нас — эмодзи/символы (⚙ ✓ 🔥 ↻).
  Перенести SVG-набор в Svelte (напр. `<Icon name=.. />`) или заменить на icon-библиотеку.

### D. Что НЕ переносить
- **Tweaks-панель** (`app.jsx:279-293`, `tweaks-panel.jsx`) — инструмент прототипа. Полезные её
  настройки (accent, AMOLED, тач-цели, autostart, offline) станут обычными настройками приложения,
  если нужны; иначе — фикс-дефолты (Графит, `--tt:50px`, autostart:true).
- **NumPad** (`sheets.jsx:5`) — кастомная клавиатура, в v2 не используется (нативные input).
- **`device`/`device-fit`/`statusbar`/`home-indicator`** (`app.jsx:228-235,265`) — рамка телефона
  и скейл; у нас апп на весь экран реального телефона → `100dvh` корневой контейнер
  (README.md:44-46). `env(safe-area-inset-*)` для футера/шитов уже учтён у нас
  (`ui/src/app.css:50`).
- Имитация offline через Tweak (`app.jsx:62-65`) — у нас реальный `navigator.onLine`.
