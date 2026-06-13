// Генерирует серверные .gs из .ts: esbuild снимает TS-типы, затем убираются ESM import/export →
// top-level глобальные функции/константы (как требует Apps Script — там нет модулей).
//   logic.ts  → ../logic.gs
//   server.ts → ../server.gs
// .gs — сгенерированные артефакты (в .gitignore). Запуск: node gen-gs.mjs (из app/ui).
import { transformSync } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = [
  { src: '../logic.ts', out: '../logic.gs' },
  { src: '../server.ts', out: '../server.gs' },
]

function toGs(src) {
  const { code } = transformSync(src, { loader: 'ts', format: 'esm', target: 'es2019', charset: 'utf8' })
  return code
    // убрать ESM import-стейтменты (в т.ч. многострочные) — логика берётся из глобального logic.gs
    .replace(/^import\b[\s\S]*?from\s*["'][^"']+["'];?/gm, '')
    .replace(/^import\s+["'][^"']+["'];?/gm, '')
    // убрать `export ` у деклараций и любые `export { ... }`
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+(?=(function|const|let|var|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n'
}

for (const f of FILES) {
  const src = readFileSync(new URL(f.src, import.meta.url), 'utf8')
  const gs = '// СГЕНЕРИРОВАНО из ' + f.src.replace('../', '') + ' (ui/gen-gs.mjs) — НЕ редактировать вручную.\n' + toGs(src)
  writeFileSync(new URL(f.out, import.meta.url), gs)
  console.log(f.out.replace('../', ''), '←', f.src.replace('../', ''), ':', gs.length, 'байт')
}
