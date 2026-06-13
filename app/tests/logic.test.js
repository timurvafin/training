import test from 'node:test';
import assert from 'node:assert';
import * as L from '../logic.ts';

test('truthyFlag', () => {
  ['yes', 'да', 'true', '1', 'ДА'].forEach(function (v) { assert.equal(L.truthyFlag(v), true, String(v)); });
  ['', 'no', '0', 'false', null, undefined].forEach(function (v) { assert.equal(L.truthyFlag(v), false, String(v)); });
});

test('parseCell: повт×вес (первый разделитель, тире=пусто)', () => {
  assert.deepEqual(L.parseCell('8×190'), { reps: '8', weight: '190' });
  assert.deepEqual(L.parseCell('10'), { reps: '10', weight: '' });
  assert.deepEqual(L.parseCell('12×90lbs'), { reps: '12', weight: '90lbs' });
  assert.deepEqual(L.parseCell('8-10×190'), { reps: '8-10', weight: '190' });
  assert.deepEqual(L.parseCell('8x120'), { reps: '8', weight: '120' });
  assert.deepEqual(L.parseCell('10×тонк'), { reps: '10', weight: 'тонк' });
  ['', '—', '–', '-', null].forEach(function (v) { assert.equal(L.parseCell(v), null, String(v)); });
});

test('parsePlanValues: колонки day|name|warmup|недели, ключ=name, byWeek', () => {
  const values = [
    ['day', 'name', 'warmup', 'Неделя 14', 'Неделя 15', 'Неделя 16'],
    [1, 'Тяга', 'да', '10×11', '10×11', '10×11'],
    [1, 'Тяга', '', '8×30', '12×22.5', '10×30'],
    ['', '', '', '', '', ''],                       // пустая строка-разделитель
    [1, 'Жим', '', '8×190', '—', '8×190'],          // — в нед.15 → пропуск
    [2, 'Мост', '', '', '', '8–12']                 // только нед.16
  ];
  const p = L.parsePlanValues(values);
  assert.deepEqual(p.weeks, ['Неделя 14', 'Неделя 15', 'Неделя 16']);
  assert.equal(p.days.length, 2);
  assert.equal(p.days[0].day_id, '1');
  assert.equal(p.days[0].day_name, '1');           // day_name = значение колонки как есть
  assert.equal(p.days[0].exercises.length, 2);
  const ex = p.days[0].exercises[0];
  assert.equal(ex.exercise_id, 'Тяга');            // ключ = название
  assert.equal(ex.name, 'Тяга');
  assert.equal(ex.sets.length, 2);
  assert.equal(ex.sets[0].is_warmup, true);
  assert.deepEqual(ex.sets[0].byWeek['Неделя 14'], { reps: '10', weight: '11' });
  assert.equal(ex.sets[1].is_warmup, false);
  const jim = p.days[0].exercises[1];
  assert.ok(jim.sets[0].byWeek['Неделя 14']);
  assert.ok(!jim.sets[0].byWeek['Неделя 15']);     // — пропущено
  assert.equal(p.days[1].exercises[0].exercise_id, 'Мост');
});

test('parsePlanValues: заметка ячейки (кол. B первой строки упражнения) → ex.note', () => {
  const values = [
    ['day', 'name', 'warmup', 'Неделя 16'],
    [1, 'Тяга', 'да', '10×11'],
    [1, 'Тяга', '', '8×30']
  ];
  const notes = [
    [],
    ['', 'Отдых 90с; RIR 1-2; грудь в подушку'],   // заметка на col B первой строки «Тяга»
    ['', 'не должна попасть']                        // заметки последующих строк игнорируются
  ];
  const p = L.parsePlanValues(values, notes);
  assert.equal(p.days[0].exercises[0].note, 'Отдых 90с; RIR 1-2; грудь в подушку');
});

test('parsePlanValues: day_name = значение колонки как есть (строка/число/кардио)', () => {
  const values = [
    ['day', 'name', 'warmup', 'Неделя 1'],
    ['День 1', 'Жим ногами', '', '15×100'],
    ['Кардио 1', 'Кардио зона-2', '', '30 мин']
  ];
  const p = L.parsePlanValues(values);
  assert.equal(p.days[0].day_name, 'День 1');                    // как в таблице, без авто-префикса
  assert.equal(p.days[1].day_id, 'Кардио 1');
  assert.equal(p.days[1].day_name, 'Кардио 1');
  assert.deepEqual(p.days[1].exercises[0].sets[0].byWeek['Неделя 1'], { reps: '30 мин', weight: '' });
});

test('parsePlanValues: старый формат (без колонки «Отдых») — недели с D, rest отсутствует', () => {
  const values = [
    ['day', 'name', 'warmup', 'Неделя 14', 'Неделя 15', 'Неделя 16'],   // header[3]='Неделя 14' → не отдых
    [1, 'Тяга', 'да', '10×11', '10×11', '10×11'],
    [1, 'Тяга', '', '8×30', '12×22.5', '10×30']
  ];
  const p = L.parsePlanValues(values);
  assert.deepEqual(p.weeks, ['Неделя 14', 'Неделя 15', 'Неделя 16']);   // недели читаются с D
  const ex = p.days[0].exercises[0];
  assert.deepEqual(ex.sets[0].byWeek['Неделя 14'], { reps: '10', weight: '11' });
  assert.equal(ex.sets[0].rest, undefined);                              // rest отсутствует
  assert.equal(ex.sets[1].rest, undefined);
});

test('parsePlanValues: новый формат (колонка «Отдых» в D) — недели с E, rest парсится', () => {
  const values = [
    ['day', 'name', 'warmup', 'Отдых', 'Неделя 1', 'Неделя 2'],   // header[3]='Отдых' → rest-колонка
    [1, 'Жим', 'да', '45', '12×40', '12×40'],
    [1, 'Жим', '', '120', '8×60', '8×62.5'],
    [1, 'Жим', '', '', '8×62.5', '8×62.5']                        // пустой отдых → undefined
  ];
  const p = L.parsePlanValues(values);
  assert.deepEqual(p.weeks, ['Неделя 1', 'Неделя 2']);           // недели сдвинуты на E+
  const ex = p.days[0].exercises[0];
  assert.equal(ex.sets.length, 3);
  assert.equal(ex.sets[0].is_warmup, true);
  assert.equal(ex.sets[0].rest, 45);                             // разминка
  assert.equal(ex.sets[1].rest, 120);                           // рабочий
  assert.equal(ex.sets[2].rest, undefined);                     // пустая ячейка отдыха
  assert.deepEqual(ex.sets[0].byWeek['Неделя 1'], { reps: '12', weight: '40' });   // повт×вес читается из E
  assert.deepEqual(ex.sets[1].byWeek['Неделя 2'], { reps: '8', weight: '62.5' });
});

test('parsePlanValues: «Отдых» детектится по заголовку (rest / отдых, с) и парсит «120с»', () => {
  const en = L.parsePlanValues([
    ['day', 'name', 'warmup', 'Rest, sec', 'Неделя 1'],          // англ. заголовок по префиксу
    [1, 'A', '', '90с', '10×50']
  ]);
  assert.deepEqual(en.weeks, ['Неделя 1']);
  assert.equal(en.days[0].exercises[0].sets[0].rest, 90);        // «90с» → 90

  const ru = L.parsePlanValues([
    ['day', 'name', 'warmup', 'Отдых, с', 'Неделя 1'],           // «Отдых, с» по префиксу
    [1, 'A', '', '120', '10×50']
  ]);
  assert.equal(ru.days[0].exercises[0].sets[0].rest, 120);
});

test('parsePlanValues: parseRest форматы (90/90с, 1:30, 2мин/2 min) и диапазон', () => {
  const p = L.parsePlanValues([
    ['day', 'name', 'warmup', 'Отдых', 'Неделя 1'],
    [1, 'A', '', '90', '10×50'],       // голое число
    [1, 'A', '', '90 sec', '10×50'],   // с суффиксом
    [1, 'A', '', '1:30', '10×50'],     // мм:сс → 90
    [1, 'A', '', '2 мин', '10×50'],    // минуты → 120
    [1, 'A', '', '2 min', '10×50'],    // англ. минуты → 120
    [1, 'A', '', '0', '10×50'],        // вне диапазона (≤0) → undefined
    [1, 'A', '', '5000', '10×50'],     // вне диапазона (>3600) → undefined
    [1, 'A', '', 'abc', '10×50']       // нечисловое → undefined
  ]);
  const sets = p.days[0].exercises[0].sets;
  assert.equal(sets[0].rest, 90);
  assert.equal(sets[1].rest, 90);
  assert.equal(sets[2].rest, 90);     // 1:30
  assert.equal(sets[3].rest, 120);    // 2 мин
  assert.equal(sets[4].rest, 120);    // 2 min
  assert.equal(sets[5].rest, undefined);  // 0
  assert.equal(sets[6].rest, undefined);  // 5000
  assert.equal(sets[7].rest, undefined);  // abc
});

test('parsePlanValues: без notes — note пустой', () => {
  const p = L.parsePlanValues([['day', 'name', 'warmup', 'Неделя 16'], [1, 'Тяга', '', '8×30']]);
  assert.equal(p.days[0].exercises[0].note, '');
});

test('parsePlanValues: бросает на пустом / без недель', () => {
  assert.throws(() => L.parsePlanValues(null));
  assert.throws(() => L.parsePlanValues([['day', 'name', 'warmup'], [1, 'e', '']]));
});

test('parsePlanValues: бросает на плане без дней/упражнений (недели есть, строки пустые)', () => {
  // Недели присутствуют, но ни одна строка не даёт упражнения → клиент бы упал на days[0].
  assert.throws(
    () => L.parsePlanValues([
      ['day', 'name', 'warmup', 'Неделя 1'],
      ['', '', '', '10×50'],   // нет day/name → пропуск
      ['', '', '', '8×40']
    ]),
    /нет дней\/упражнений/i
  );
});

test('validatePayload: валидный + единицы/бэнды в весе', () => {
  assert.deepEqual(L.validatePayload({ session_id: 's1', sets: [{ exercise_id: 'e', reps: '10', weight: '20', rpe: '8' }] }), { ok: true });
  assert.ok(L.validatePayload({ session_id: 's1', sets: [{ exercise_id: 'e', reps: '8-10', weight: '90lbs' }] }).ok);  // веса с единицами проходят
  assert.ok(L.validatePayload({ session_id: 's1', sets: [{ exercise_id: 'e', weight: 'тонк' }] }).ok);
});

test('validatePayload: коды ошибок', () => {
  assert.equal(L.validatePayload(null).code, 'bad_payload');
  assert.equal(L.validatePayload({ sets: [{ exercise_id: 'e' }] }).code, 'no_session_id');
  assert.equal(L.validatePayload({ session_id: 's' }).code, 'no_sets');
  assert.equal(L.validatePayload({ session_id: 's', sets: [{}] }).code, 'bad_set');
  assert.equal(L.validatePayload({ session_id: 's', sets: [{ exercise_id: 'e', rpe: '11' }] }).code, 'bad_rpe');
  assert.equal(L.validatePayload({ session_id: 's', status: 'xxx', sets: [{ exercise_id: 'e' }] }).code, 'bad_status');
  assert.equal(L.validatePayload({ session_id: 's', sets: [{ exercise_id: 'e', reps: 'x'.repeat(50) }] }).code, 'bad_reps');
  const big = Array.from({ length: 201 }, () => ({ exercise_id: 'e' }));
  assert.equal(L.validatePayload({ session_id: 's', sets: big }).code, 'too_big');
});

test('validatePayload: лимиты длины строковых полей → too_long', () => {
  const base = { session_id: 's', sets: [{ name: 'e' }] };
  assert.equal(L.validatePayload({ ...base, session_id: 'x'.repeat(65) }).code, 'too_long');
  assert.ok(L.validatePayload({ ...base, session_id: 'x'.repeat(64) }).ok);                       // ровно 64 — ок
  assert.equal(L.validatePayload({ ...base, plan: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validatePayload({ ...base, week: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validatePayload({ ...base, day: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validatePayload({ session_id: 's', sets: [{ name: 'x'.repeat(201) }] }).code, 'too_long');
  assert.equal(L.validatePayload({ session_id: 's', sets: [{ name: 'e', note: 'x'.repeat(501) }] }).code, 'too_long');
  assert.ok(L.validatePayload({ session_id: 's', sets: [{ name: 'x'.repeat(200), note: 'x'.repeat(500) }] }).ok); // на границе
});

test('validateCardioPayload: лимиты длины строковых полей → too_long', () => {
  const base = { session_id: 's', duration: '40' };
  assert.equal(L.validateCardioPayload({ ...base, session_id: 'x'.repeat(65) }).code, 'too_long');
  assert.equal(L.validateCardioPayload({ ...base, plan: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validateCardioPayload({ ...base, week: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validateCardioPayload({ ...base, day: 'x'.repeat(101) }).code, 'too_long');
  assert.equal(L.validateCardioPayload({ ...base, note: 'x'.repeat(501) }).code, 'too_long');
  assert.ok(L.validateCardioPayload({ ...base, plan: 'x'.repeat(100), note: 'x'.repeat(500) }).ok); // на границе
});

test('validatePayload: name-only набор + feel', () => {
  assert.ok(L.validatePayload({ session_id: 's', sets: [{ name: 'Тяга', reps: '10' }] }).ok);   // без exercise_id
  assert.equal(L.validatePayload({ session_id: 's', sets: [{}] }).code, 'bad_set');             // ни name, ни exercise_id
  assert.ok(L.validatePayload({ session_id: 's', feel: '7', sets: [{ name: 'e' }] }).ok);
  assert.equal(L.validatePayload({ session_id: 's', feel: '11', sets: [{ name: 'e' }] }).code, 'bad_feel');
});

test('findDuplicate', () => {
  assert.equal(L.findDuplicate(['a', 'b'], 'b'), true);
  assert.equal(L.findDuplicate(['a', 'b'], 'c'), false);
  assert.equal(L.findDuplicate([], 'x'), false);
});

test('sanitizeCell: экранирует формул-инъекцию', () => {
  assert.equal(L.sanitizeCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(L.sanitizeCell('+1'), "'+1");
  assert.equal(L.sanitizeCell('Жим'), 'Жим');
  assert.equal(L.sanitizeCell(null), '');
});

test('sanitizeCell: опасный префикс после ведущих пробелов/таб (обход формулы)', () => {
  assert.equal(L.sanitizeCell(' =SUM(A1)'), "' =SUM(A1)");   // префикс ' к оригиналу (с пробелом)
  assert.equal(L.sanitizeCell('\t=1+1'), "'\t=1+1");          // ведущий таб
  assert.equal(L.sanitizeCell('\n@cmd'), "'\n@cmd");          // ведущий перевод строки
  assert.equal(L.sanitizeCell('   -2'), "'   -2");
  assert.equal(L.sanitizeCell('  Жим'), '  Жим');             // безопасный текст не трогаем
});

test('buildSessionRows: 15 колонок (+feel), plan/week, warmup→yes, экранирование', () => {
  const payload = {
    session_id: '=evil', plan: 'fullbody', week: 'Неделя 16', date: '2026-06-04', day: 'День 1', status: 'completed', feel: '7',
    sets: [{ name: '=HACK', set_index: 1, is_warmup: true, reps: '10', weight: '20', rpe: '', note: '@n' }]
  };
  const r = L.buildSessionRows(payload, 'NOW')[0];
  assert.equal(r.length, 15);
  assert.equal(r[0], "'=evil");       // session_id экранирован
  assert.equal(r[1], 'fullbody');     // plan
  assert.equal(r[2], 'Неделя 16');    // week
  assert.equal(r[5], "'=HACK");       // name экранировано
  assert.equal(r[6], 1);              // set_index
  assert.equal(r[7], 'yes');          // is_warmup
  assert.equal(r[10], '');            // пустой rpe
  assert.equal(r[11], "'@n");         // note экранировано
  assert.equal(r[12], 'completed');   // status
  assert.equal(r[13], '7');           // feel
  assert.equal(r[14], 'NOW');         // saved_at
});

test('collectSets: учитывает done или повторы, индексирует внутри упражнения, разминки тоже', () => {
  const ex = [
    { exercise_id: 'e1', name: 'A', sets: [
      { reps: '10', weight: '20', rpe: '8', is_warmup: true, done: false },
      { reps: '', weight: '20', rpe: '', is_warmup: false, done: true },
      { reps: '', weight: '', rpe: '', is_warmup: false, done: false }
    ] },
    { exercise_id: 'e2', name: 'B', sets: [{ reps: '', weight: '', rpe: '', is_warmup: false, done: false }] }
  ];
  const out = L.collectSets(ex);
  assert.equal(out.length, 2);
  assert.equal(out[0].set_index, 1);
  assert.equal(out[0].is_warmup, true);
  assert.equal(out[1].set_index, 2);
});

test('collectSets: пустой вход', () => { assert.deepEqual(L.collectSets([]), []); });

test('validateCardioPayload', () => {
  assert.ok(L.validateCardioPayload({ session_id: 's', duration: '40' }).ok);
  assert.ok(L.validateCardioPayload({ session_id: 's', duration: '40', hr: '130', rpe: '5' }).ok);
  assert.equal(L.validateCardioPayload(null).code, 'bad_payload');
  assert.equal(L.validateCardioPayload({ duration: '40' }).code, 'no_session_id');
  assert.equal(L.validateCardioPayload({ session_id: 's' }).code, 'no_duration');
  assert.equal(L.validateCardioPayload({ session_id: 's', duration: '0' }).code, 'bad_duration');
  assert.equal(L.validateCardioPayload({ session_id: 's', duration: '40', hr: '400' }).code, 'bad_hr');
  assert.equal(L.validateCardioPayload({ session_id: 's', duration: '40', rpe: '11' }).code, 'bad_rpe');
});

test('buildCardioRow: 11 колонок, экранирование', () => {
  const r = L.buildCardioRow({ session_id: '=evil', plan: 'Восстановление', week: 'Неделя 1', date: '2026-06-05', day: 'Кардио 1', type: '=HACK', duration: '40', hr: '130', rpe: '5', note: '@n' }, 'NOW');
  assert.equal(r.length, 11);
  assert.equal(r[0], "'=evil");   // session_id экранирован
  assert.equal(r[4], 'Кардио 1');
  assert.equal(r[5], "'=HACK");   // вид экранирован
  assert.equal(r[6], '40');       // длительность
  assert.equal(r[7], '130');      // пульс
  assert.equal(r[8], '5');        // rpe
  assert.equal(r[9], "'@n");      // заметка экранирована
  assert.equal(r[10], 'NOW');     // время записи
});
