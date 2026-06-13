import {
  test,
  expect,
  open,
  weekSelect,
  dayTab,
  dayTabs,
  syncLine,
  finishBtn,
  exerciseCard,
  setRows,
  idxBtn,
} from './helpers'

// Каркас грузится, план/вкладки/селект недели в шапке/заметки/разминка видны.

test('каркас и план: селект недели в шапке, вкладки (силовые+кардио), активный день', async ({ page }) => {
  await open(page)

  // Крупный заголовок-программа из шапки УБРАН — слева теперь селект НЕДЕЛИ (week-select).
  // Его значение по умолчанию = последняя неделя «Неделя 2».
  await expect(weekSelect(page)).toBeVisible()
  await expect(weekSelect(page)).toHaveValue('Неделя 2')

  // Вкладки: силовая «День 1» и кардио «Кардио 1».
  await expect(dayTabs(page)).toHaveCount(2)
  await expect(dayTab(page, 'День 1')).toBeVisible()
  await expect(dayTab(page, 'Кардио 1')).toBeVisible()
  // Активна «День 1» — какой день открыт, видно ТОЛЬКО по вкладке (aria-pressed).
  await expect(dayTab(page, 'День 1')).toHaveAttribute('aria-pressed', 'true')
  await expect(dayTab(page, 'Кардио 1')).toHaveAttribute('aria-pressed', 'false')

  // SyncLine в idle (черновик) СКРЫТА — пока нечего отправлять, плашки нет в DOM.
  await expect(syncLine(page)).toHaveCount(0)

  // Кнопка финиша — в шапке, «Завершить тренировку».
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить тренировку')
})

test('упражнения, заметка 💡 и разминка 🔥', async ({ page }) => {
  await open(page)

  // Два упражнения из плана.
  await expect(page.locator('[data-testid="exercise-card"]')).toHaveCount(2)
  await expect(exerciseCard(page, 'Жим ногами')).toBeVisible()
  await expect(exerciseCard(page, 'Жим в хаммере на грудь')).toBeVisible()

  // Заметка 💡 у «Жим ногами» (точный текст из mock-плана).
  const note = exerciseCard(page, 'Жим ногами').locator('.ex-note')
  await expect(note).toContainText('💡')
  await expect(note).toContainText('Отдых 90с; RIR 1-2; стопы шире плеч')

  // У «Жима ногами» 3 подхода: первый — разминка (🔥), остальные рабочие (1, 2).
  const legpress = exerciseCard(page, 'Жим ногами')
  const rows = legpress.locator('[data-testid="set-row"]')
  await expect(rows).toHaveCount(3)
  // Разминка: # = 🔥 + длительность отдыха 45с (кнопка # = «переключить тип подхода»).
  const warmCell = idxBtn(rows.nth(0))
  await expect(warmCell).toContainText('🔥')
  await expect(warmCell).toContainText('45с')
  // Рабочие подходы: rest 120с и 150с.
  await expect(idxBtn(rows.nth(1))).toContainText('120с')
  await expect(idxBtn(rows.nth(2))).toContainText('150с')

  // Прогресс «k/n» = 0/3.
  await expect(legpress.locator('.ex-prog')).toHaveText('0/3')
})

test('целевые повторы/вес из плана (Неделя 2)', async ({ page }) => {
  await open(page)
  const legpress = exerciseCard(page, 'Жим ногами')
  const rows = legpress.locator('[data-testid="set-row"]')

  // Плейсхолдер повторов = target_reps плана (Неделя 2 → «10»).
  await expect(rows.nth(0).getByRole('textbox', { name: 'повторы' })).toHaveAttribute('placeholder', '10')
  // Вес из плана для Недели 2 = «125» (предзаполнен в value).
  await expect(rows.nth(0).getByRole('textbox', { name: 'вес' })).toHaveValue('125')

  // «Жим в хаммере» вес Недели 2 = «22.5».
  const hammer = exerciseCard(page, 'Жим в хаммере на грудь')
  const hRows = hammer.locator('[data-testid="set-row"]')
  await expect(hRows).toHaveCount(2)
  await expect(hRows.nth(0).getByRole('textbox', { name: 'вес' })).toHaveValue('22.5')
})

test('тап по # переключает тип подхода (разминка 🔥 ↔ номер), таймер НЕ стартует', async ({ page }) => {
  await open(page)
  // У «Жим ногами»: nth0 — разминка (🔥), nth1/nth2 — рабочие (номера 1 и 2).
  const rows = exerciseCard(page, 'Жим ногами').locator('[data-testid="set-row"]')

  // Рабочий подход (nth 1): # показывает номер «1», не разминка.
  const workCell = idxBtn(rows.nth(1))
  await expect(workCell.locator('.si-n')).toHaveText('1')
  await expect(workCell).not.toHaveAttribute('data-warm', '')

  // Тап по # рабочего → становится разминкой: 🔥 и data-warm. Таймер НЕ стартует.
  await workCell.click()
  await expect(workCell.locator('.si-n')).toHaveText('🔥')
  await expect(workCell).toHaveAttribute('data-warm', '')
  await expect(page.locator('[data-testid="rest-timer"]')).toHaveCount(0)

  // Тап ещё раз → обратно в рабочий (номер «1» вернулся), таймера по-прежнему нет.
  await workCell.click()
  await expect(workCell.locator('.si-n')).toHaveText('1')
  await expect(workCell).not.toHaveAttribute('data-warm', '')
  await expect(page.locator('[data-testid="rest-timer"]')).toHaveCount(0)

  // Обратное направление: разминка (nth 0, 🔥) → рабочий (стала номером).
  const warmCell = idxBtn(rows.nth(0))
  await expect(warmCell.locator('.si-n')).toHaveText('🔥')
  await warmCell.click()
  await expect(warmCell).not.toHaveAttribute('data-warm', '')
  await expect(warmCell.locator('.si-n')).not.toHaveText('🔥')
  await expect(page.locator('[data-testid="rest-timer"]')).toHaveCount(0)
})
