import test from 'node:test';
import assert from 'node:assert';
import * as T from '../ui/src/lib/timer.ts';

// FAKE CLOCK: всё время передаём явно как `now` (ms). Никакого Date.now(),
// setTimeout/setInterval — «прыгаем» во времени вручную.
const T0 = 1_000_000_000_000; // фиксированный «эпох-старт» теста
const at = (sec) => T0 + sec * 1000; // момент = T0 + sec секунд

test('createTimer: старт отсчёта, моменты, derive в нуле времени', () => {
  const s = T.createTimer('Жим лёжа', 120, at(0));
  assert.equal(s.exName, 'Жим лёжа');
  assert.equal(s.total, 120);
  assert.equal(s.startedAt, at(0));
  assert.equal(s.targetEndAt, at(120));
  assert.equal(s.pausedAt, null);
  assert.equal(s.finished, false);

  const d = T.derive(s, at(0));
  assert.equal(d.remaining, 120);
  assert.equal(d.over, 0);
  assert.equal(d.running, true);
  assert.equal(d.finished, false);
  assert.equal(d.progress, 1);
});

test('отсчёт точный через «прыжки» now', () => {
  const s = T.createTimer('X', 120, at(0));
  assert.equal(T.derive(s, at(10)).remaining, 110);
  assert.equal(T.derive(s, at(60)).remaining, 60);
  assert.equal(T.derive(s, at(119)).remaining, 1);
  // прогресс = remaining/total
  assert.ok(Math.abs(T.derive(s, at(60)).progress - 0.5) < 1e-9);
});

test('пауза/продолжение замораживает remaining', () => {
  let s = T.createTimer('X', 120, at(0));
  // в 30с ставим на паузу → осталось 90
  s = T.pause(s, at(30));
  assert.equal(T.derive(s, at(30)).remaining, 90);
  assert.equal(T.derive(s, at(30)).running, false);
  // время идёт, но на паузе remaining заморожен на 90
  assert.equal(T.derive(s, at(100)).remaining, 90);
  assert.equal(T.derive(s, at(100000)).remaining, 90);
  // продолжаем в 100с → отсчёт продолжается с 90
  s = T.resume(s, at(100));
  assert.equal(T.derive(s, at(100)).remaining, 90);
  assert.equal(T.derive(s, at(110)).remaining, 80);
  assert.equal(T.derive(s, at(190)).remaining, 0);
  assert.equal(T.derive(s, at(190)).running, true);
});

test('повторная пауза/ресюм идемпотентны', () => {
  let s = T.createTimer('X', 60, at(0));
  s = T.pause(s, at(10));
  const again = T.pause(s, at(20)); // no-op
  assert.equal(again.pausedAt, at(10));
  let r = T.resume(s, at(30));
  const noop = T.resume(r, at(40)); // уже идёт → no-op
  assert.deepEqual(noop, r);
});

test('+15 и −15 меняют remaining (сдвиг targetEndAt)', () => {
  let s = T.createTimer('X', 120, at(0));
  // через 10с осталось 110; +15 → 125
  s = T.adjust(s, 15, at(10));
  assert.equal(T.derive(s, at(10)).remaining, 125);
  // −15 → обратно 110
  s = T.adjust(s, -15, at(10));
  assert.equal(T.derive(s, at(10)).remaining, 110);
});

test('−15 не уводит remaining в отрицательное (клампится в 0)', () => {
  let s = T.createTimer('X', 10, at(0));
  // через 2с осталось 8; −15 → должно стать 0, не -7
  s = T.adjust(s, -15, at(2));
  const d = T.derive(s, at(2));
  assert.equal(d.remaining, 0);
  assert.ok(d.remaining >= 0);
});

test('+15 на паузе считается от замороженного момента', () => {
  let s = T.createTimer('X', 120, at(0));
  s = T.pause(s, at(30)); // осталось 90
  s = T.adjust(s, 15, at(999)); // now игнорируется (пауза), считаем от 30с-момента
  assert.equal(T.derive(s, at(999)).remaining, 105);
});

test('достижение 0 → finished + over растёт вверх', () => {
  const s = T.createTimer('X', 60, at(0));
  // ровно в 0 — уже finished
  let d = T.derive(s, at(60));
  assert.equal(d.finished, true);
  assert.equal(d.remaining, 0);
  assert.equal(d.over, 0);
  // через 5с сверх
  d = T.derive(s, at(65));
  assert.equal(d.finished, true);
  assert.equal(d.over, 5);
  // через 2 минуты сверх
  d = T.derive(s, at(180));
  assert.equal(d.over, 120);
});

test('createTimer с total=0 сразу finished', () => {
  const s = T.createTimer('X', 0, at(0));
  assert.equal(s.finished, true);
  const d = T.derive(s, at(0));
  assert.equal(d.finished, true);
  assert.equal(T.derive(s, at(10)).over, 10);
});

test('settleFinished закрепляет over от момента нуля (не от now тика)', () => {
  let s = T.createTimer('X', 60, at(0));
  // тик пришёл с опозданием в 67с (фон/блокировка) — over всё равно от 60с-момента
  s = T.settleFinished(s, at(67));
  assert.equal(s.finished, true);
  assert.equal(s.overStartedAt, at(60));
  assert.equal(T.derive(s, at(67)).over, 7);
  assert.equal(T.derive(s, at(90)).over, 30);
});

test('пауза в переотдыхе замораживает over', () => {
  let s = T.createTimer('X', 30, at(0));
  // в 40с уже переотдых, over=10
  assert.equal(T.derive(s, at(40)).over, 10);
  // ставим паузу в 40с
  s = T.pause(s, at(40));
  assert.equal(T.derive(s, at(40)).over, 10);
  // время идёт — over заморожен на 10
  assert.equal(T.derive(s, at(100)).over, 10);
  assert.equal(T.derive(s, at(100)).running, false);
  // продолжаем в 100с → over продолжает расти с 10
  s = T.resume(s, at(100));
  assert.equal(T.derive(s, at(100)).over, 10);
  assert.equal(T.derive(s, at(105)).over, 15);
});

test('пауза ДО нуля переносит и точку перехода в переотдых', () => {
  let s = T.createTimer('X', 60, at(0));
  s = T.pause(s, at(50)); // осталось 10
  // долгая пауза
  s = T.resume(s, at(1000)); // продолжили в 1000с, осталось 10 → ноль в 1010с
  assert.equal(T.derive(s, at(1005)).remaining, 5);
  assert.equal(T.derive(s, at(1005)).finished, false);
  assert.equal(T.derive(s, at(1010)).finished, true);
  assert.equal(T.derive(s, at(1015)).over, 5);
});

test('skip/stop завершает таймер (→ null)', () => {
  const s = T.createTimer('X', 60, at(0));
  assert.equal(T.skip(s), null);
  assert.equal(T.stop(s), null);
});

test('persist/restore: переживает «reload» (тот же state + больший now)', () => {
  const s = T.createTimer('Тяга', 120, at(0));
  // прошло 30с, юзер «перезагрузил страницу» в 30с
  const json = JSON.stringify(T.serialize(s));
  const restored = T.restore(JSON.parse(json));
  // моменты те же → remaining пересчитан по реальному now
  assert.equal(T.derive(restored, at(30)).remaining, 90);
  // а если фон был долгим и now уже за нулём — корректно finished + over
  assert.equal(T.derive(restored, at(150)).finished, true);
  assert.equal(T.derive(restored, at(150)).over, 30);
});

test('persist/restore: пауза переживает reload (заморозка сохраняется)', () => {
  let s = T.createTimer('X', 120, at(0));
  s = T.pause(s, at(30)); // осталось 90, на паузе
  const restored = T.restore(JSON.parse(JSON.stringify(T.serialize(s))));
  // даже спустя «реальные» минуты — на паузе всё ещё 90
  assert.equal(T.derive(restored, at(5000)).remaining, 90);
  assert.equal(T.derive(restored, at(5000)).running, false);
  // продолжаем после reload
  const resumed = T.resume(restored, at(5000));
  assert.equal(T.derive(resumed, at(5010)).remaining, 80);
});

test('serialize: чистый объект из чисел/строк/null (JSON round-trip стабилен)', () => {
  const s = T.createTimer('Жим', 90, at(0));
  const plain = T.serialize(s);
  for (const k of ['total', 'startedAt', 'targetEndAt']) {
    assert.equal(typeof plain[k], 'number', k);
  }
  assert.equal(typeof plain.exName, 'string');
  // round-trip не теряет данных
  assert.deepEqual(JSON.parse(JSON.stringify(plain)), plain);
});

test('restore: битый/частичный JSON → null (нет TimerState с NaN)', () => {
  assert.equal(T.restore(null), null);
  assert.equal(T.restore('строка'), null);
  assert.equal(T.restore({ total: 'x' }), null); // нет числовых моментов
  assert.equal(T.restore({ total: 90 }), null); // нет startedAt/targetEndAt
  // валидный round-trip по-прежнему восстанавливается
  const ok = T.restore(T.serialize(T.createTimer('Z', 60, at(0))));
  assert.equal(ok.total, 60);
  assert.equal(ok.exName, 'Z');
});

test('mmss формат', () => {
  assert.equal(T.mmss(0), '0:00');
  assert.equal(T.mmss(5), '0:05');
  assert.equal(T.mmss(65), '1:05');
  assert.equal(T.mmss(120), '2:00');
});

test('derive(null) безопасен', () => {
  const d = T.derive(null, at(0));
  assert.deepEqual(d, { remaining: 0, over: 0, running: false, finished: false, progress: 0 });
});
