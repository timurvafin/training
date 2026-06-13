import { defineConfig, devices } from '@playwright/test'

// iPhone 16 Pro Max: в реестре Playwright его ещё нет (максимум iPhone 15 Pro Max),
// поэтому кастомим на его базе с экраном 16 Pro Max (440×956 CSS-точек @3x, webkit).
const iPhone16ProMax = {
  ...devices['iPhone 15 Pro Max'],
  viewport: { width: 440, height: 763 }, // видимая web-область (956 − Safari UI)
  screen: { width: 440, height: 956 },
}

// E2E поверх локальной версии: Vite dev-сервер с offline-mock бэкендом (src/lib/gas.js).
// webServer переиспользует уже запущенный dev-сервер, если он есть (reuseExistingServer).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  // mobile-safari (iPhone 16 Pro Max) = реальное целевое окружение (движок Safari + touch +
  // мобильный вьюпорт), ловит iOS-специфику делегирования событий Svelte 5. chromium — быстрый
  // desktop-baseline. Запуск только Safari: `npm run e2e -- --project=mobile-safari`.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...iPhone16ProMax },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
