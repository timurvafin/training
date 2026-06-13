import { defineConfig } from 'vitest/config'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Юнит-тесты (vitest + jsdom). Отдельно от e2e (Playwright) и от боевой сборки
// (vite.config.mjs с singleFile). svelte-плагин нужен, чтобы компилировать руны в
// .svelte.js/.svelte.ts модулях (store). logic.ts лежит в app/ (вне ui/) — fs.allow
// разрешает его читать из тестов так же, как dev-серверу в vite.config.mjs.
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{js,ts}', 'tests/**/*.test.{js,ts}'],
    restoreMocks: true,
  },
})
