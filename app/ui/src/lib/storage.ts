// Тонкий слой: реэкспорт серверных prefs-настроек (план/неделя/день/звук/секрет) из store/prefs.ts.
// localStorage больше НЕ используется (ломается в third-party iframe Apps Script на iOS):
// сессия, rest-таймер и кэш планов не персистятся — всё состояние идёт через сервер (bootstrap/setPrefs).
export {
  getMuted, setMuted, getPlanName, setPlanName,
  getLastWeek, setLastWeek, getLastDay, setLastDay, getSecret,
} from './store/prefs.js'
