import {
  test,
  expect,
  open,
  enableOffline,
  finishStrength,
  expectActiveDay,
  syncLine,
  finishBtn,
  setRows,
  repsInput,
  startRestTimer,
} from './helpers'

// Восстановление после reload. Init-script чистит localStorage только ОДИН раз за тест
// (sessionStorage-маркер), поэтому session_state / rest_timer переживают reload.

test('введённый прогресс переживает reload', async ({ page }) => {
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('11')
  // дождёмся, что значение записалось в стор (touch → save)
  await expect(repsInput(setRows(page).nth(1))).toHaveValue('11')

  await page.reload()
  await expectActiveDay(page, 'День 1')
  // Прогресс восстановлен.
  await expect(repsInput(setRows(page).nth(1))).toHaveValue('11')
})

test('synced-сессия после reload остаётся locked', async ({ page }) => {
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('10')
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')

  await page.reload()
  await expectActiveDay(page, 'День 1')
  // Всё ещё залочено после reload.
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(syncLine(page)).toContainText('Отправлено в таблицу')
  await expect(finishBtn(page)).toBeDisabled()
  await expect(repsInput(setRows(page).nth(1))).toBeDisabled()
  await expect(page.locator('.banner')).toContainText('завершена')
})

test('failed-offline payload → после reload виден ретрай', async ({ page }) => {
  await enableOffline(page)
  await open(page)
  await repsInput(setRows(page).nth(1)).fill('10')
  // Финиш в offline — mock отклоняет saveSession → состояние «off» + ретрай.
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'off')
  await expect(syncLine(page).getByRole('button', { name: 'Повторить отправку' })).toBeVisible()

  // Reload (всё ещё offline) → есть несинхронизированный payload → ретрай снова виден.
  await page.reload()
  await expectActiveDay(page, 'День 1')
  await expect(syncLine(page)).toHaveAttribute('data-s', 'off')
  await expect(syncLine(page).getByRole('button', { name: 'Повторить отправку' })).toBeVisible()
})

test('rest-таймер переживает reload', async ({ page }) => {
  await open(page)
  // Старт rest-таймера ✓ рабочего подхода (тап по # теперь переключает тип, не стартует таймер).
  await startRestTimer(setRows(page).nth(1))
  await expect(page.locator('[data-testid="rest-timer"]')).toBeVisible()

  await page.reload()
  await expectActiveDay(page, 'День 1')
  // Таймер восстановлен (моменты те же, доезжает по реальным часам).
  await expect(page.locator('[data-testid="rest-timer"]')).toBeVisible()
})
