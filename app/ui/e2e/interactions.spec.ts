import {
  test,
  expect,
  open,
  enableOffline,
  disableOffline,
  finishStrength,
  exerciseCard,
  syncLine,
  finishBtn,
  setRows,
  repsInput,
  rpeSelect,
  doneBtn,
} from './helpers'

// Степпер ±подход, переключение «готово», выбор RPE, авто-ретрай по online,
// и явная проверка «saveSession не вызывается до финиша».

test('степпер +/−: добавить и убрать подход', async ({ page }) => {
  await open(page)
  const card = exerciseCard(page, 'Жим ногами')
  const rows = card.locator('[data-testid="set-row"]')
  await expect(rows).toHaveCount(3)

  // + добавляет подход.
  await card.getByRole('button', { name: 'добавить подход' }).click()
  await expect(rows).toHaveCount(4)
  // Прогресс n вырос.
  await expect(card.locator('.ex-prog')).toHaveText('0/4')

  // − убирает (последний пустой — без confirm).
  await card.getByRole('button', { name: 'убрать подход' }).click()
  await expect(rows).toHaveCount(3)
})

test('переключение «готово» (✓) туда-обратно', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  const row = rows.nth(1)

  await doneBtn(row).click()
  await expect(row).toHaveAttribute('data-done', '')
  // Прогресс «Жим ногами» 1/3.
  await expect(exerciseCard(page, 'Жим ногами').locator('.ex-prog')).toHaveText('1/3')

  // Снять ✓.
  await doneBtn(row).click()
  await expect(row).not.toHaveAttribute('data-done', '')
  await expect(exerciseCard(page, 'Жим ногами').locator('.ex-prog')).toHaveText('0/3')
})

test('выбор RPE', async ({ page }) => {
  await open(page)
  const row = setRows(page).nth(1)
  await rpeSelect(row).selectOption('8')
  await expect(rpeSelect(row)).toHaveValue('8')
})

test('saveSession НЕ вызывается во время логирования — только при финише', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // Логируем несколько подходов и метим ✓ — SyncLine всё время в idle (черновик) СКРЫТА,
  // т.е. saveSession не дёргался (любая отправка перевела бы в sync/ok/off и показала плашку).
  await repsInput(rows.nth(1)).fill('10')
  await expect(syncLine(page)).toHaveCount(0)
  await rpeSelect(rows.nth(1)).selectOption('7')
  await expect(syncLine(page)).toHaveCount(0)
  await doneBtn(rows.nth(2)).click()
  await expect(syncLine(page)).toHaveCount(0)
  // Ещё раз убеждаемся — плашки статуса нет (черновик стабилен).
  await expect(syncLine(page)).toHaveCount(0)

  // Только финиш отправляет.
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
})

test('ручной ретрай: offline-финиш → клик «Повторить» (онлайн) → успех + lock', async ({ page }) => {
  await enableOffline(page)
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('10')
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'off')

  // Снимаем offline и жмём «Повторить отправку» в SyncLine.
  await disableOffline(page)
  await syncLine(page).getByRole('button', { name: 'Повторить отправку' }).click()

  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(syncLine(page)).toContainText('Отправлено в таблицу')
  await expect(finishBtn(page)).toBeDisabled()
})

test('авто-ретрай по событию online', async ({ page }) => {
  await enableOffline(page)
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('10')
  await finishStrength(page, 7)
  // Offline → не отправлено, ретрай.
  await expect(syncLine(page)).toHaveAttribute('data-s', 'off')

  // Снимаем offline и эмулируем событие online → store сам вызывает syncNow.
  await disableOffline(page)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))

  // Авто-ретрай прошёл успешно → «Отправлено в таблицу» + lock.
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(syncLine(page)).toContainText('Отправлено в таблицу')
  await expect(finishBtn(page)).toBeDisabled()
})
