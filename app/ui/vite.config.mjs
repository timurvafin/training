import { defineConfig } from 'vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'

// Build-инфо для экрана настроек (видно, какая версия задеплоена — против путаницы с кешем).
// Вычисляется на сборке: короткий git-хеш + флаг незакоммиченных правок app + время сборки.
function sh(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' }
}
const gitHash = sh('git rev-parse --short HEAD') || 'nogit'
const appDirty = sh('git status --porcelain -- ..') ? '+' : '' // незакоммиченные правки в app/
const buildTime = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
const BUILD_INFO = `${gitHash}${appDirty} · ${buildTime}`

// logic.ts — единый источник логики (TS, ESM). Клиент импортирует его напрямую (Vite/esbuild
// понимают .ts нативно). Серверный logic.gs генерируется отдельно (ui/gen-logic-gs.mjs).
export default defineConfig({
  define: { __BUILD_INFO__: JSON.stringify(BUILD_INFO) },
  plugins: [svelte({ preprocess: vitePreprocess() }), viteSingleFile()],
  // logic.ts лежит в app/ (вне ui/) — разрешаем dev-серверу его читать.
  server: { fs: { allow: ['..'] } },
  build: {
    target: 'es2018',
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
  },
})
