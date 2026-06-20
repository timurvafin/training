import {
  test,
  expect,
  open,
  weekSelect,
  dayTab,
} from './helpers'

// Настройки: выбор плана, секрет, звук (недели здесь НЕТ — она в шапке). Плюс экран загрузки.
// Выбор недели теперь в ШАПКЕ (week-select) — см. соответствующие тесты ниже.

const settings = (page) => page.locator('[data-testid="settings-sheet"]')

async function openSettings(page) {
  await page.getByRole('button', { name: 'Настройки' }).click()
  await expect(settings(page)).toBeVisible()
}

test('загрузка: при первом старте виден экран загрузки loading-screen', async ({ page }) => {
  await page.goto('/')
  // LoadingScreen показывается на первом старте (LOAD_FIRST ~1.7с), затем гаснет.
  await expect(page.locator('[data-testid="loading-screen"]')).toBeVisible()
  // После загрузки — план виден (селект недели в шапке), активна вкладка «День 1»,
  // оверлей исчез.
  await expect(weekSelect(page)).toBeVisible()
  await expect(dayTab(page, 'День 1')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-testid="loading-screen"]')).toHaveCount(0)
})

test('настройки открываются кнопкой open-settings и содержат план/звук (недели и секрета тут НЕТ)', async ({ page }) => {
  await open(page)
  await openSettings(page)

  // Выбор плана.
  await expect(settings(page).getByRole('combobox', { name: 'план' })).toBeVisible()
  // Недели в настройках БОЛЬШЕ НЕТ — она перенесена в шапку (week-select).
  await expect(settings(page).getByRole('combobox', { name: 'неделя' })).toHaveCount(0)
  // Поля секрета БОЛЬШЕ НЕТ — секрет записи приходит с сервера автоматически.
  await expect(settings(page).getByLabel('секрет записи')).toHaveCount(0)
  // Тоггл звука сигнала отдыха.
  await expect(settings(page).locator('[data-testid="mute-toggle"]')).toBeVisible()
})

test('смена недели в ШАПКЕ → корректная неделя в плане (Неделя 1, кардио 40 мин)', async ({ page }) => {
  await open(page)

  // Изначально кардио на Неделе 2 = 45 мин; сменим неделю на «Неделя 1» (40 мин) — в ШАПКЕ.
  await expect(weekSelect(page)).toHaveValue('Неделя 2')
  await weekSelect(page).selectOption('Неделя 1')
  // Селект недели отражает текущую неделю.
  await expect(weekSelect(page)).toHaveValue('Неделя 1')

  // Проверяем план Недели 1 на кардио: длительность ровно 40.
  await dayTab(page, 'Кардио 1').click()
  await expect(page.locator('[data-testid="cardio-form"]')).toBeVisible()
  await expect(
    page.locator('[data-testid="cardio-form"]').getByRole('textbox', { name: 'длительность' })
  ).toHaveValue('40')
})

test('смена недели в ШАПКЕ возвращает корректные веса плана (Неделя 1 → вес 120)', async ({ page }) => {
  await open(page)
  await weekSelect(page).selectOption('Неделя 1')
  await expect(weekSelect(page)).toHaveValue('Неделя 1')

  // «Жим ногами» на Неделе 1: вес = 120 (на Неделе 2 был 125).
  const legpress = page
    .locator('[data-testid="exercise-card"]')
    .filter({ has: page.locator('.ex-name', { hasText: 'Жим ногами' }) })
  await expect(
    legpress.locator('[data-testid="set-row"]').nth(0).getByRole('textbox', { name: 'вес' })
  ).toHaveValue('120')
})

test('селект недели — в ШАПКЕ, а не в настройках; смена недели меняет веса (W1=120, W2=125)', async ({ page }) => {
  await open(page)

  // В шапке есть селект недели.
  await expect(weekSelect(page)).toBeVisible()

  const legpressWeight = () =>
    page
      .locator('[data-testid="exercise-card"]')
      .filter({ has: page.locator('.ex-name', { hasText: 'Жим ногами' }) })
      .locator('[data-testid="set-row"]')
      .nth(0)
      .getByRole('textbox', { name: 'вес' })

  // По умолчанию — последняя неделя «Неделя 2»: вес «Жим ногами» = 125.
  await expect(weekSelect(page)).toHaveValue('Неделя 2')
  await expect(legpressWeight()).toHaveValue('125')

  // Смена на «Неделя 1» в шапке → вес 120.
  await weekSelect(page).selectOption('Неделя 1')
  await expect(weekSelect(page)).toHaveValue('Неделя 1')
  await expect(legpressWeight()).toHaveValue('120')

  // В настройках недели НЕТ (план/звук остались).
  await openSettings(page)
  await expect(settings(page).getByRole('combobox', { name: 'неделя' })).toHaveCount(0)
  await expect(settings(page).getByRole('combobox', { name: 'план' })).toBeVisible()
})
