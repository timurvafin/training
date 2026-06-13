import {
  test,
  expect,
  open,
  finishStrength,
  expectActiveDay,
  dayTab,
  syncLine,
  setRows,
  repsInput,
} from './helpers'

// Guard потери прогресса при смене дня для НЕзавершённой сессии с прогрессом.
// selectDay/selectWeek зовут window.confirm, если есть несохранённый прогресс (_dirty/payload).

test('смена дня с прогрессом: cancel оставляет текущий день и прогресс', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  await repsInput(rows.nth(1)).fill('9')

  // Клик «Кардио 1» → confirm; ОТКЛОНЯЕМ (cancel) → остаёмся на «День 1».
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Несохранённый прогресс')
    d.dismiss()
  })
  await dayTab(page, 'Кардио 1').click()

  // Остались на «День 1» (его вкладка активна).
  await expectActiveDay(page, 'День 1')
  // Прогресс сохранён.
  await expect(repsInput(setRows(page).nth(1))).toHaveValue('9')
})

test('смена дня с прогрессом: confirm меняет день (прогресс потерян)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  await repsInput(rows.nth(1)).fill('9')

  // Клик «Кардио 1» → confirm; ПОДТВЕРЖДАЕМ → переходим на кардио.
  page.once('dialog', (d) => d.accept())
  await dayTab(page, 'Кардио 1').click()

  await expectActiveDay(page, 'Кардио 1')
  await expect(page.locator('[data-testid="cardio-form"]')).toBeVisible()
})

test('без прогресса смена дня НЕ спрашивает подтверждение', async ({ page }) => {
  await open(page)
  // Никакого прогресса — клик по «Кардио 1» переключает сразу, без диалога.
  let dialogFired = false
  page.on('dialog', (d) => {
    dialogFired = true
    d.dismiss()
  })
  await dayTab(page, 'Кардио 1').click()
  await expectActiveDay(page, 'Кардио 1')
  expect(dialogFired).toBe(false)
})

test('после завершения смена дня НЕ спрашивает подтверждение (терять нечего)', async ({ page }) => {
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('10')
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')

  // Завершённая (synced) сессия: переход на кардио без confirm.
  let dialogFired = false
  page.on('dialog', (d) => {
    dialogFired = true
    d.dismiss()
  })
  await dayTab(page, 'Кардио 1').click()
  await expectActiveDay(page, 'Кардио 1')
  expect(dialogFired).toBe(false)
})
