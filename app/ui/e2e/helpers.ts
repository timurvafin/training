import { test as base, expect, type Page, type Locator } from '@playwright/test'

// ──────────────────────────────────────────────────────────────────────────
// Общий init-helper для e2e нового DOM (тема «Графит», hifi-v2).
//
// Стабильные селекторы только: data-testid / getByRole / aria-label.
// Mock-бэкенд — src/lib/gas.js (offline-переключатель localStorage.mock_offline='1').
// Mock-план «fullbody»: дни «День 1» (упр. «Жим ногами» с заметкой 💡, «Жим в хаммере
// на грудь») и «Кардио 1»; недели «Неделя 1»/«Неделя 2» (по умолчанию последняя — «Неделя 2»).
// ──────────────────────────────────────────────────────────────────────────

// ИЗОЛЯЦИЯ: перед каждым тестом чистим localStorage (там — только dev-mock переключатели
// mock_offline / mock_delay / mock_progress; рантайм-персиста в localStorage больше нет).
// addInitScript выполняется до загрузки приложения на КАЖДОЙ навигации (в т.ч. reload),
// поэтому чистим только ОДИН раз за тест — через sessionStorage-маркер.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('__e2e_cleared')) {
          localStorage.clear()
          sessionStorage.setItem('__e2e_cleared', '1')
        }
      } catch (e) {
        /* noop */
      }
    })
    await use(page)
  },
})

export { expect }

// Включить mock-offline ДО загрузки приложения. Добавляет init-script ПОСЛЕ
// общего clear (порядок addInitScript сохраняется), поэтому ключ переживёт clear.
// Вызывать строго до open()/goto().
export async function enableOffline(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('mock_offline', '1')
    } catch (e) {
      /* noop */
    }
  })
}

// Снять offline в рантайме (после загрузки) — для проверки успешного ретрая.
export async function disableOffline(page: Page) {
  await page.evaluate(() => localStorage.setItem('mock_offline', '0'))
}

// Дойти до экрана с загруженным планом. По умолчанию ждём, что активна вкладка «День 1».
// ВАЖНО (новый дизайн): крупного заголовка-программы в шапке БОЛЬШЕ НЕТ. Слева в шапке —
// крупный селект НЕДЕЛИ (week-select). Какой день выбран — видно только по активной вкладке
// (day-tab[aria-pressed="true"]). Поэтому ждём именно активную вкладку.
export async function open(page: Page, day = 'День 1') {
  await page.goto('/')
  await expectActiveDay(page, day)
}

// ——— Стабильные локаторы нового DOM ———

// Селект НЕДЕЛИ в ШАПКЕ — крупный дропдаун слева (перенесён из настроек). Его value =
// текущая неделя (метка «Неделя N»), смена недели перерисовывает дни/подходы сразу.
export function weekSelect(page: Page): Locator {
  return page.locator('[data-testid="week-select"]')
}

// Вкладка дня по имени (aria-label = имя дня).
export function dayTab(page: Page, name: string): Locator {
  return page.locator('[data-testid="day-tab"]', { hasText: name })
}

// Все вкладки дней.
export function dayTabs(page: Page): Locator {
  return page.locator('[data-testid="day-tab"]')
}

// Активная (выбранная) вкладка дня — единственный источник правды «какой день открыт».
export function activeDayTab(page: Page): Locator {
  return page.locator('[data-testid="day-tab"][aria-pressed="true"]')
}

// Проверка «открыт день N»: его вкладка существует и aria-pressed=true.
export async function expectActiveDay(page: Page, name: string) {
  await expect(dayTab(page, name)).toHaveAttribute('aria-pressed', 'true')
}

// SyncLine: data-s = idle|sync|ok|off.
export function syncLine(page: Page): Locator {
  return page.locator('[data-testid="sync-line"]')
}

// Кнопка финиша (синий флаг в ШАПКЕ, рядом с ⚙). testid сохранён.
export function finishBtn(page: Page): Locator {
  return page.locator('[data-testid="finish"]')
}

// Карточка упражнения по имени (в .ex-name).
export function exerciseCard(page: Page, name: string): Locator {
  return page
    .locator('[data-testid="exercise-card"]')
    .filter({ has: page.locator('.ex-name', { hasText: name }) })
}

// Все строки подходов на экране.
export function setRows(page: Page): Locator {
  return page.locator('[data-testid="set-row"]')
}

// Поле повторов в конкретной строке подхода.
export function repsInput(row: Locator): Locator {
  return row.getByRole('textbox', { name: 'повторы' })
}
export function weightInput(row: Locator): Locator {
  return row.getByRole('textbox', { name: 'вес' })
}
export function rpeSelect(row: Locator): Locator {
  return row.getByRole('combobox', { name: 'rpe' })
}
export function doneBtn(row: Locator): Locator {
  return row.getByRole('button', { name: 'готово' })
}
// Кнопка # (номер/🔥 + длительность отдыха). Тап ПЕРЕКЛЮЧАЕТ тип подхода
// (разминка ↔ рабочий, toggleWarmup) — таймер по ней больше НЕ стартует.
export function idxBtn(row: Locator): Locator {
  return row.getByRole('button', { name: 'переключить тип подхода' })
}
// Запустить rest-таймер: единственный способ — ✓ рабочего (не разминочного) подхода.
// Возвращает строку, по ✓ которой стартовал таймер (для последующих проверок).
export async function startRestTimer(row: Locator) {
  await doneBtn(row).click()
}

// ——— Силовой финиш через FinishSheet (оценка-сетка 1..10) ———
export async function finishStrength(page: Page, rating = 7) {
  await finishBtn(page).click()
  const sheet = page.locator('[data-testid="finish-sheet"]')
  await expect(sheet).toBeVisible()
  await sheet.locator(`[data-testid="rating-${rating}"]`).click()
  // Кнопка подтверждения «Отправить».
  await sheet.getByRole('button', { name: 'Отправить' }).click()
}
