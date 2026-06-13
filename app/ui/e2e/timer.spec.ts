import {
  test,
  expect,
  open,
  setRows,
  idxBtn,
  startRestTimer,
} from './helpers'

// Rest-таймер. Новый дизайн: старт — ✓ ЛЮБОГО подхода (вкл. разминку: у разминок в плане
// тоже своя длительность отдыха, напр. 45с). Тап по # больше НЕ стартует таймер — он
// переключает тип подхода (разминка ↔ рабочий).
// Точный тайминг — в юнит-тестах timer.js (fake-clock). В e2e — видимые старт/изменение/пауза/пропуск.

const timer = (page) => page.locator('[data-testid="rest-timer"]')

// Текущее показанное время M:SS из основной кнопки времени.
async function readTime(page): Promise<number> {
  const txt = await timer(page).locator('.rt-time .num').innerText()
  const [m, s] = txt.trim().split(':').map(Number)
  return m * 60 + s
}

test('авто-старт по ✓ рабочего подхода (rest 120с)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // ✓ рабочего подхода (nth 1, rest 120с) — таймер появляется.
  await startRestTimer(rows.nth(1))
  await expect(timer(page)).toBeVisible()
  // Стартовое время около 2:00 (120с rest), допускаем 1с тика.
  const t = await readTime(page)
  expect(t).toBeGreaterThanOrEqual(118)
  expect(t).toBeLessThanOrEqual(120)
})

test('авто-старт по ✓ разминки ТОЖЕ запускает таймер (rest 45с)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // ✓ разминки (nth 0, rest 45с) — таймер ТОЖЕ стартует (исключение для разминок снято).
  await startRestTimer(rows.nth(0))
  await expect(timer(page)).toBeVisible()
  // Стартовое время около 0:45 (45с rest), допускаем 1с тика.
  const t = await readTime(page)
  expect(t).toBeGreaterThanOrEqual(43)
  expect(t).toBeLessThanOrEqual(45)
})

test('тап по # НЕ стартует таймер (а переключает тип подхода)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  await expect(timer(page)).toHaveCount(0)

  // Тап по # рабочего подхода (nth 1) — таймер НЕ появляется (тап переключает тип).
  await idxBtn(rows.nth(1)).click()
  await expect(timer(page)).toHaveCount(0)
})

test('−15 / +15 меняют время', async ({ page }) => {
  await open(page)
  // ✓ рабочего подхода (nth 2, rest 150с) → старт таймера.
  await startRestTimer(setRows(page).nth(2))
  await expect(timer(page)).toBeVisible()

  const before = await readTime(page)
  await timer(page).getByRole('button', { name: 'Минус 15 секунд' }).click()
  const afterMinus = await readTime(page)
  expect(afterMinus).toBeLessThanOrEqual(before - 14) // ~−15 (±1с тика)

  await timer(page).getByRole('button', { name: 'Плюс 15 секунд' }).click()
  const afterPlus = await readTime(page)
  expect(afterPlus).toBeGreaterThanOrEqual(afterMinus + 14) // ~+15
})

test('пауза / продолжить', async ({ page }) => {
  await open(page)
  await startRestTimer(setRows(page).nth(1))
  await expect(timer(page)).toBeVisible()

  // По умолчанию идёт → кнопка «Пауза».
  const pause = timer(page).getByRole('button', { name: 'Пауза' })
  await expect(pause).toBeVisible()
  await pause.click()
  // После паузы — кнопка «Продолжить».
  await expect(timer(page).getByRole('button', { name: 'Продолжить' })).toBeVisible()
})

test('пропуск отдыха убирает таймер', async ({ page }) => {
  await open(page)
  await startRestTimer(setRows(page).nth(1))
  await expect(timer(page)).toBeVisible()

  await timer(page).getByRole('button', { name: 'Пропустить отдых' }).click()
  await expect(timer(page)).toHaveCount(0)
})

test('переотдых: счёт вверх, появляется «Завершить отдых»', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  // Старт таймера ✓ рабочего (nth 1, rest 120с) и быстро согнать время к нулю через −15.
  await startRestTimer(rows.nth(1))
  await expect(timer(page)).toBeVisible()
  const minus = timer(page).getByRole('button', { name: 'Минус 15 секунд' })
  // 120с → 0 за 8 нажатий (adjust клампит до «сейчас»); далее реальный тик флипнет в переотдых.
  for (let i = 0; i < 8; i++) await minus.click()

  // Переотдых: появляется кнопка «Завершить отдых» (aria-label), таймер всё ещё виден.
  await expect(timer(page).getByRole('button', { name: 'Завершить отдых' })).toBeVisible({ timeout: 5000 })
  await expect(timer(page)).toContainText('ОТДЫХ ОКОНЧЕН')
  // «+M:SS / сверх M:SS» — счёт сверх отдыха.
  await expect(timer(page).locator('.rt-over')).toContainText('+')

  // «Готово» (Завершить отдых) убирает таймер.
  await timer(page).getByRole('button', { name: 'Завершить отдых' }).click()
  await expect(timer(page)).toHaveCount(0)
})
