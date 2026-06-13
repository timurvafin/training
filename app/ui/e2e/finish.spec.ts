import {
  test,
  expect,
  open,
  finishStrength,
  expectActiveDay,
  dayTab,
  dayTabs,
  syncLine,
  finishBtn,
  exerciseCard,
  setRows,
  repsInput,
  doneBtn,
} from './helpers'

// Завершение силовой: log → finish → completed (lock полей + финиша, вкладки enabled).

test('log → finish → completed: lock полей и финиша, вкладки ENABLED', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // SyncLine в idle (черновик) скрыта, пока логируем (никаких save до финиша).
  await expect(syncLine(page)).toHaveCount(0)
  await repsInput(rows.nth(1)).fill('10')
  // Всё ещё черновик — saveSession не вызывался во время логирования, плашки нет.
  await expect(syncLine(page)).toHaveCount(0)

  await finishStrength(page, 7)

  // Успех: SyncLine «Отправлено в таблицу», Banner «завершена».
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(syncLine(page)).toContainText('Отправлено в таблицу')
  await expect(page.locator('.banner')).toContainText('✅ Тренировка завершена и отправлена. Перезаписать нельзя.')

  // Поля подходов и кнопка финиша залочены.
  await expect(repsInput(rows.nth(1))).toBeDisabled()
  await expect(finishBtn(page)).toBeDisabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Тренировка закрыта')

  // НО вкладки дней — ENABLED (недавний фикс).
  await expect(dayTab(page, 'День 1')).toBeEnabled()
  await expect(dayTab(page, 'Кардио 1')).toBeEnabled()
})

test('done-only подход: ✓ без ввода повторов → finish успешен', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // Отметить рабочий подход ✓ без ввода повторов.
  await doneBtn(rows.nth(1)).click()
  await expect(rows.nth(1)).toHaveAttribute('data-done', '')

  await finishStrength(page, 8)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  await expect(page.locator('.banner')).toContainText('завершена')
})

test('кнопка финиша DISABLED, пока нет данных → ввёл повтор → ENABLED → клик → finish-sheet', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // Ничего не введено: финиш в шапке disabled (нечего отправлять, collectSets пуст).
  await expect(finishBtn(page)).toBeDisabled()
  // FinishSheet, разумеется, ещё нет.
  await expect(page.locator('[data-testid="finish-sheet"]')).toHaveCount(0)
  // SyncLine в idle скрыта.
  await expect(syncLine(page)).toHaveCount(0)

  // Вводим повторы в рабочий подход → появилось что отправлять → финиш ENABLED.
  await repsInput(rows.nth(1)).fill('10')
  await expect(finishBtn(page)).toBeEnabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить тренировку')

  // Клик по активному финишу открывает FinishSheet (силовая → оценка 1..10).
  await finishBtn(page).click()
  await expect(page.locator('[data-testid="finish-sheet"]')).toBeVisible()
})

test('кнопка финиша ENABLED после ✓ (done-only, без ввода повторов)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)

  // Без данных — disabled.
  await expect(finishBtn(page)).toBeDisabled()
  // Отметить рабочий подход ✓ (без ввода повторов) → финиш ENABLED.
  await doneBtn(rows.nth(1)).click()
  await expect(rows.nth(1)).toHaveAttribute('data-done', '')
  await expect(finishBtn(page)).toBeEnabled()

  // И финиш открывает FinishSheet.
  await finishBtn(page).click()
  await expect(page.locator('[data-testid="finish-sheet"]')).toBeVisible()
})

test('startNew: «Начать заново» очищает поля и разблокирует', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  await repsInput(rows.nth(1)).fill('12')
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')

  // «Начать заново» из баннера.
  await page.locator('.banner').getByRole('button', { name: 'Начать заново' }).click()

  // Баннер исчез, SyncLine снова черновик (скрыта), поля разблокированы и очищены.
  await expect(page.locator('.banner')).toHaveCount(0)
  await expect(syncLine(page)).toHaveCount(0)
  // Финиш снова disabled (свежая сессия — данных нет) и с лейблом «Завершить тренировку».
  await expect(finishBtn(page)).toBeDisabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить тренировку')
  // Введённое значение сброшено.
  await expect(repsInput(setRows(page).nth(1))).toHaveValue('')
})

// ── Регресс-тест к недавнему багу: переключение дня ПОСЛЕ завершения ──
test('переключение дня после завершения: День 1 (locked) → Кардио 1 (fresh) → День 1 (fresh)', async ({ page }) => {
  await open(page)
  const rows = setRows(page)
  await repsInput(rows.nth(1)).fill('10')
  await finishStrength(page, 7)
  await expect(syncLine(page)).toHaveAttribute('data-s', 'ok')
  // День 1 залочен.
  await expect(finishBtn(page)).toBeDisabled()

  // Клик «Кардио 1» — без confirm (терять нечего, сессия synced) → свежая РАЗЛОЧЕННАЯ кардио-сессия.
  await dayTab(page, 'Кардио 1').click()
  await expectActiveDay(page, 'Кардио 1')
  await expect(page.locator('[data-testid="cardio-form"]')).toBeVisible()
  // SyncLine снова черновик (скрыта); кардио предзаполнено длительностью (45) → финиш активен.
  await expect(syncLine(page)).toHaveCount(0)
  await expect(finishBtn(page)).toBeEnabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить кардио')
  // Баннера «завершена» нет.
  await expect(page.locator('.banner')).toHaveCount(0)

  // Назад на «День 1» — свежая РАЗЛОЧЕННАЯ силовая сессия (а не залоченная прошлая).
  await dayTab(page, 'День 1').click()
  await expectActiveDay(page, 'День 1')
  await expect(syncLine(page)).toHaveCount(0)
  // Свежая силовая без данных → финиш disabled, лейбл «Завершить тренировку».
  await expect(finishBtn(page)).toBeDisabled()
  await expect(finishBtn(page)).toHaveAttribute('aria-label', 'Завершить тренировку')
  // Поля пустые/доступные (свежая сессия), ранее введённое «10» сброшено.
  await expect(repsInput(setRows(page).nth(1))).toHaveValue('')
  await expect(repsInput(setRows(page).nth(1))).toBeEnabled()
})
