#!/usr/bin/env bash
# Деплой трекера в Apps Script через clasp.
# Требует один раз: включить Apps Script API (https://script.google.com/home/usersettings)
# и `npx @google/clasp login`. Дальше — просто ./deploy.sh
#
# UI на Svelte+Vite собирается в ОДИН index.html (vite-plugin-singlefile) и пушится
# вместе с Code.gs / logic.js (→ logic.gs) / appsscript.json. Существующее боевое
# развёртывание обновляется (URL /exec не меняется).
set -euo pipefail
cd "$(dirname "$0")"

# SPREADSHEET_ID — из локального .env (gitignored, не в публичном репо). Шаблон — .env.example.
# deploy.sh уже cd'нул в свою директорию (см. выше), .env читается оттуда.
# shellcheck source=/dev/null
if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ -z "${SPREADSHEET_ID:-}" ]; then
  echo "❌ SPREADSHEET_ID не задан. Скопируй .env.example → .env и впиши ID таблицы Google Sheets." >&2
  exit 1
fi
CLASP="npx --yes @google/clasp"

if ! $CLASP show-authorized-user >/dev/null 2>&1; then
  echo "❌ Не залогинен в clasp. Выполни: npx @google/clasp login" >&2
  exit 1
fi

if [ ! -f .clasp.json ]; then
  echo "▶ Создаю привязанный скрипт к таблице…"
  [ -f appsscript.json ] && cp appsscript.json appsscript.json.bak
  $CLASP create-script --parentId "$SPREADSHEET_ID" --title "Тренировка-трекер" --rootDir .
  [ -f appsscript.json.bak ] && mv -f appsscript.json.bak appsscript.json
fi

echo "▶ Тесты чистой логики (logic.ts)…"
npm test

echo "▶ Сборка UI + типчек (logic.ts/server.ts) + генерация серверных .gs (logic.gs, server.gs)…"
( cd ui && npm install --no-audit --no-fund --silent && npm run build && npm run check && npm run typecheck && npm run gen:gs )
cp ui/dist/index.html index.html

echo "▶ Проверка: в бандле нет eval/new Function (CSP песочницы Apps Script)…"
if grep -nE 'eval\(|new Function|Function\(' index.html; then
  echo "❌ Найден eval/new Function в бандле — Apps Script CSP это запретит." >&2
  exit 1
fi

echo "▶ Push (index.html, server.gs + logic.gs (из *.ts), appsscript.json)…"
$CLASP push -f

# Обновляем существующее боевое (versioned, не @HEAD) развёртывание, чтобы URL не менялся.
DEP_ID="$($CLASP list-deployments 2>/dev/null | grep -v '@HEAD' | grep -oE 'AKfyc[A-Za-z0-9_-]+' | head -1 || true)"
if [ -n "$DEP_ID" ]; then
  echo "▶ Обновляю развёртывание $DEP_ID …"
  $CLASP create-deployment -i "$DEP_ID" -d "deploy"
else
  echo "▶ Создаю первое развёртывание…"
  OUT="$($CLASP create-deployment -d "v1" 2>&1)"; echo "$OUT"
  DEP_ID="$(printf '%s' "$OUT" | grep -oE 'AKfyc[A-Za-z0-9_-]+' | head -1 || true)"
fi

if [ -n "$DEP_ID" ]; then
  echo ""
  echo "✅ URL веб-приложения: https://script.google.com/macros/s/$DEP_ID/exec"
else
  echo "⚠ Не удалось определить deploymentId — 'npx @google/clasp list-deployments'." >&2
fi
