// API-слой: 4 серверных метода Apps Script через Promise-адаптер gas().
// Компоненты вызывают эти функции, а не google.script.run напрямую.
import { gas, isAppsScript } from './gas.js'
import type { Plan, SessionPayload, CardioPayload, SaveResult, Prefs, BootstrapResult, ProgressMap } from './types.ts'

export { isAppsScript }

// Единый стартовый вызов: планы + prefs + план (+ progress) за один round-trip. planName — опц. hint выбора.
export const bootstrap = (name?: string): Promise<BootstrapResult> => gas<BootstrapResult>('bootstrap', name)
export const getPrefs = (): Promise<Prefs> => gas<Prefs>('getPrefs')
// Полный снимок prefs (last-write-wins на сервере, секрет не трогается).
export const setPrefs = (full: Prefs): Promise<{ ok: boolean }> => gas<{ ok: boolean }>('setPrefs', full)
// Факт выполненных дней (read-only) для плана+недели — при старте через bootstrap, при смене недели отдельно.
export const getProgress = (name: string, week: string): Promise<ProgressMap> => gas<ProgressMap>('getProgress', name, week)
export const listPlans = (): Promise<string[]> => gas<string[]>('listPlans')
export const getPlan = (name: string): Promise<Plan> => gas<Plan>('getPlan', name)
export const saveSession = (payload: SessionPayload): Promise<SaveResult> => gas<SaveResult>('saveSession', payload)
export const saveCardio = (payload: CardioPayload): Promise<SaveResult> => gas<SaveResult>('saveCardio', payload)
