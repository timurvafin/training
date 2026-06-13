/* data.jsx — план тренировок (seed). У каждого подхода свой rest (сек). */
window.makePlan = function makePlan() {
  // S(reps, weight, {warm, rpe, rest})
  const S = (reps, weight, opt = {}) => ({
    reps, weight, rpe: opt.rpe ?? null, warm: !!opt.warm,
    rest: opt.rest ?? 90, done: false,
  });

  return {
    week: 6,
    days: [
      {
        id: 'd1', kind: 'strength', name: 'День 1', sub: 'Грудь · Трицепс',
        exercises: [
          { name: 'Жим штанги лёжа', note: 'RIR 1–2', sets: [
            S(12, 40, { warm: true, rest: 45 }), S(8, 60, { rest: 120 }), S(8, 62.5, { rest: 120 }), S(8, 62.5, { rest: 150 }) ] },
          { name: 'Жим гантелей под углом', note: 'Контролируй негатив', sets: [
            S(10, 22, { rest: 90 }), S(10, 22, { rest: 90 }), S(10, 24, { rest: 90 }) ] },
          { name: 'Разгибания на трицепс (блок)', note: '', sets: [
            S(12, 30, { rest: 60 }), S(12, 30, { rest: 60 }), S(12, 32.5, { rest: 60 }) ] },
          { name: 'Брусья', note: 'До RIR 1', sets: [
            S(8, 0, { rest: 90 }), S(8, 0, { rest: 90 }), S(8, 0, { rest: 90 }) ] },
        ],
      },
      {
        id: 'd2', kind: 'strength', name: 'День 2', sub: 'Спина · Бицепс',
        exercises: [
          { name: 'Тяга верхнего блока', note: 'Своди лопатки', sets: [
            S(12, 50, { warm: true, rest: 45 }), S(10, 55, { rest: 120 }), S(10, 55, { rest: 120 }), S(10, 60, { rest: 120 }) ] },
          { name: 'Тяга гантели в наклоне', note: '', sets: [
            S(10, 28, { rest: 90 }), S(10, 28, { rest: 90 }), S(10, 30, { rest: 90 }) ] },
          { name: 'Тяга нижнего блока', note: 'Пауза 1с в сокращении', sets: [
            S(12, 50, { rest: 75 }), S(12, 50, { rest: 75 }), S(12, 52.5, { rest: 75 }) ] },
          { name: 'Молотки на бицепс', note: '', sets: [
            S(12, 14, { rest: 60 }), S(12, 14, { rest: 60 }), S(12, 16, { rest: 60 }) ] },
        ],
      },
      {
        id: 'd3', kind: 'strength', name: 'День 3', sub: 'Ноги · Плечи',
        exercises: [], // план на эту неделю ещё не заполнен → пустое состояние
      },
      {
        id: 'c1', kind: 'cardio', name: 'Кардио 1', sub: 'Низкая интенсивность',
        note: 'Зона 2 · держи пульс ровным',
        cardio: { type: 'Ходьба с уклоном', duration: 30, hr: null, rpe: 5 },
      },
      {
        id: 'c2', kind: 'cardio', name: 'Кардио 2', sub: 'Интервалы',
        note: '4×4 мин в зоне 4, 3 мин отдых',
        cardio: { type: 'Эллипс', duration: 35, hr: null, rpe: 7 },
      },
    ],
  };
};
window.CARDIO_TYPES = ['Ходьба с уклоном', 'Эллипс', 'Велотренажёр'];
