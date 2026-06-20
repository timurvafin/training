import { test, expect, open, finishBtn, setRows, repsInput, dayTab } from './helpers'

// Read-only просмотр выполненного дня. Источник правды — факт на сервере (вкладки «Сессии»/«Кардио»),
// здесь мокается через localStorage.mock_progress (dev-mock в gas.ts; bootstrap/getProgress читают его).
// Черновики/таймер НЕ персистятся между reload — соответствующие старые кейсы удалены.

test('выполненный день — read-only из факта (инпуты disabled, ✓ в табе)', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mock_progress', JSON.stringify({
        'День 1': {
          sets: [{ exercise: 'Жим ногами', set_index: 1, is_warmup: false, reps: '10', weight: '120', rpe: '8', note: '' }],
          status: 'completed', feel: '7', date: '2026-06-10', session_id: 's1', cardio: false,
        },
      }))
    } catch (e) { /* noop */ }
  })
  await open(page)
  const reps = repsInput(setRows(page).nth(0))
  await expect(reps).toHaveValue('10') // факт показан
  await expect(reps).toBeDisabled() // read-only
  await expect(finishBtn(page)).toBeDisabled() // «Завершить» недоступно
  await expect(dayTab(page, 'День 1')).toHaveAttribute('data-done', '') // ✓-индикатор в табе
})

test('невыполненный день — обычная форма ввода (инпут активен)', async ({ page }) => {
  await open(page)
  await expect(repsInput(setRows(page).nth(0))).toBeEnabled()
})
