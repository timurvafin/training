import { describe, it, expect } from 'vitest'
import { buildState, buildPayload, findDay, isCardio, DEFAULT_REST } from './state.ts'
import type { PlanDay, Plan, SessionPayload } from './types.ts'

// Минимальный план-фикстура в форме getPlan (см. DATA-CONTRACT.md / gas.ts MOCK_PLAN).
const W1 = 'Неделя 1'
const W2 = 'Неделя 2'

const strengthDay: PlanDay = {
  day_id: 'День 1',
  day_name: 'День 1',
  exercises: [
    {
      exercise_id: 'Жим ногами', name: 'Жим ногами', note: 'RIR 1-2',
      sets: [
        { is_warmup: true, rest: 45, byWeek: { [W1]: { reps: '10', weight: '120' }, [W2]: { reps: '10', weight: '125' } } },
        { is_warmup: false, byWeek: { [W1]: { reps: '10', weight: '120' } } }, // нет rest → DEFAULT_REST
        { is_warmup: false, rest: 120, byWeek: { [W2]: { reps: '8', weight: '130' } } }, // только W2
      ],
    },
    {
      // В W1 ни одного подхода → упражнение должно отфильтроваться целиком.
      exercise_id: 'Только W2', name: 'Только W2', note: '',
      sets: [{ is_warmup: false, byWeek: { [W2]: { reps: '5', weight: '1' } } }],
    },
  ],
}

const cardioDay: PlanDay = {
  day_id: 'Кардио 1', day_name: 'Кардио 1',
  exercises: [{
    exercise_id: 'z2', name: 'Кардио зона-2', note: 'пульс 120–135',
    sets: [{ is_warmup: false, byWeek: { [W1]: { reps: '40 мин', weight: '' }, [W2]: { reps: '45 мин', weight: '' } } }],
  }],
}

const plan: Plan = { plan: 'fullbody', weeks: [W1, W2], days: [strengthDay, cardioDay] }

describe('isCardio', () => {
  it('день, начинающийся с «Кардио» — кардио', () => {
    expect(isCardio(cardioDay)).toBe(true)
  })
  it('обычный силовой день — не кардио', () => {
    expect(isCardio(strengthDay)).toBe(false)
  })
})

describe('findDay', () => {
  it('находит день по day_id', () => {
    expect(findDay(plan, 'Кардио 1')).toBe(cardioDay)
  })
  it('несуществующий day_id → undefined', () => {
    expect(findDay(plan, 'Нет такого')).toBeUndefined()
  })
})

describe('buildState — силовая', () => {
  const s = buildState(strengthDay, W1, 'fullbody')

  it('базовые поля сессии', () => {
    expect(s.cardio).toBe(false)
    expect(s.plan).toBe('fullbody')
    expect(s.week).toBe(W1)
    expect(s.day_id).toBe('День 1')
    expect(s.synced).toBe(false)
    expect(s.payload).toBeNull()
    expect(typeof s.session_id).toBe('string')
  })

  it('упражнение без подходов на эту неделю отфильтровано', () => {
    expect(s.exercises).toHaveLength(1)
    expect(s.exercises[0].name).toBe('Жим ногами')
  })

  it('подходы фильтруются по неделе (W2-only set исключён)', () => {
    expect(s.exercises[0].sets).toHaveLength(2)
  })

  it('rest берётся из подхода, иначе DEFAULT_REST', () => {
    expect(s.exercises[0].sets[0].rest).toBe(45)
    expect(s.exercises[0].sets[1].rest).toBe(DEFAULT_REST)
  })

  it('целевые повт/вес проставлены, факт пуст', () => {
    const set = s.exercises[0].sets[0]
    expect(set.target_reps).toBe('10')
    expect(set.weight).toBe('120')
    expect(set.reps).toBe('')
    expect(set.done).toBe(false)
    expect(set.is_warmup).toBe(true)
  })
})

// Сузить union до CardioSession (throw вместо expect — TS-narrowing для полей duration и т.п.).
function asCardio(s: ReturnType<typeof buildState>) {
  if (!s.cardio) throw new Error('ожидалась кардио-сессия')
  return s
}

describe('buildState — кардио', () => {
  it('длительность извлекается из «40 мин» → «40»', () => {
    const s = asCardio(buildState(cardioDay, W1, 'fullbody'))
    expect(s.duration).toBe('40')
    expect(s.exercises).toHaveLength(0)
    expect(s.status).toBe('completed')
  })
  it('другая неделя → другая длительность', () => {
    expect(asCardio(buildState(cardioDay, W2, 'fullbody')).duration).toBe('45')
  })
})

describe('buildPayload', () => {
  it('силовая без заполненных подходов → null', () => {
    const s = buildState(strengthDay, W1, 'fullbody')
    expect(buildPayload(s, 'secret')).toBeNull()
  })

  it('силовая с отмеченным подходом → payload с sets и секретом', () => {
    const s = buildState(strengthDay, W1, 'fullbody')
    s.exercises[0].sets[0].done = true
    const p = buildPayload(s, 'secret') as (SessionPayload & { shared_secret: string }) | null
    expect(p).not.toBeNull()
    expect(p!.shared_secret).toBe('secret')
    expect(p!.session_id).toBe(s.session_id)
    expect(p!.sets.length).toBeGreaterThanOrEqual(1)
    expect(p!.sets[0].name).toBe('Жим ногами')
  })

  it('кардио с длительностью → payload, без — null', () => {
    const s = asCardio(buildState(cardioDay, W1, 'fullbody'))
    expect(buildPayload(s, 'secret')).not.toBeNull()
    s.duration = ''
    expect(buildPayload(s, 'secret')).toBeNull()
  })
})
