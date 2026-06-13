import {
  test,
  expect,
  open,
  expectActiveDay,
  dayTab,
  syncLine,
  finishBtn,
} from './helpers'

// Кардио-форма и полный финиш кардио. finish() кардио использует window.confirm —
// принимаем диалог явным обработчиком.

async function gotoCardio(page) {
  await open(page)
  await dayTab(page, 'Кардио 1').click()
  await expectActiveDay(page, 'Кардио 1')
  await expect(page.locator('[data-testid="cardio-form"]')).toBeVisible()
}

test('кардио-форма: преднаполненная длительность (Неделя 2 → ровно 45) и поля', async ({ page }) => {
  await gotoCardio(page)
  const form = page.locator('[data-testid="cardio-form"]')

  // Длительность преднаполнена из плана: Неделя 2 = «45 мин» → ровно «45».
  await expect(form.getByRole('textbox', { name: 'длительность' })).toHaveValue('45')

  // Поля: вид (select), пульс, RPE (select).
  await expect(form.getByRole('combobox', { name: 'вид кардио' })).toBeVisible()
  await expect(form.getByRole('textbox', { name: 'пульс' })).toBeVisible()
  await expect(form.getByRole('combobox', { name: 'rpe' })).toBeVisible()

  // Заметка кардио из плана.
  await expect(form.locator('.ex-note')).toContainText('Пульс 120–135, разговорный темп')

  // Футер — «Завершить кардио», активен.
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить кардио')
  await expect(finishBtn(page)).toBeEnabled()
})

test('кардио-финиш полный: изменить вид/длительность/пульс/RPE → finish → отправлено + lock', async ({ page }) => {
  await gotoCardio(page)
  const form = page.locator('[data-testid="cardio-form"]')

  // Изменить поля.
  await form.getByRole('combobox', { name: 'вид кардио' }).selectOption('Эллипс')
  const dur = form.getByRole('textbox', { name: 'длительность' })
  await dur.fill('38')
  await form.getByRole('textbox', { name: 'пульс' }).fill('128')
  await form.getByRole('combobox', { name: 'rpe' }).selectOption('7')

  // Пока логируем — SyncLine черновик скрыта (save не вызывался).
  await expect(syncLine(page)).toHaveCount(0)

  // Финиш кардио → window.confirm (принять).
  page.once('dialog', (d) => d.accept())
  await finishBtn(page).click()

  // Успех: SyncLine «Отправлено в таблицу».
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(syncLine(page)).toContainText('Отправлено в таблицу')
  await expect(page.locator('.banner')).toContainText('завершена')

  // Lock: поля и кнопка финиша disabled.
  await expect(dur).toBeDisabled()
  await expect(form.getByRole('combobox', { name: 'вид кардио' })).toBeDisabled()
  await expect(finishBtn(page)).toBeDisabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Тренировка закрыта')
})

test('кардио: пустая длительность → finish даёт ошибку, не завершает', async ({ page }) => {
  await gotoCardio(page)
  const form = page.locator('[data-testid="cardio-form"]')

  // Очистить длительность.
  const dur = form.getByRole('textbox', { name: 'длительность' })
  await dur.fill('')
  await expect(dur).toHaveValue('')

  // Кнопка финиша становится disabled (finishDisabled = cardio && !duration).
  await expect(finishBtn(page)).toBeDisabled()

  // SyncLine остаётся черновиком (скрыта) — ничего не отправлено.
  await expect(syncLine(page)).toHaveCount(0)
  await expect(page.locator('.banner')).toHaveCount(0)
})
