// API-слой: 4 серверных метода Apps Script через Promise-адаптер gas().
// Компоненты вызывают эти функции, а не google.script.run напрямую.
import { gas, isAppsScript } from './gas.js'
import type { Plan, SessionPayload, CardioPayload, SaveResult } from './types.ts'

export { isAppsScript }

export const listPlans = (): Promise<string[]> => gas<string[]>('listPlans')
export const getPlan = (name: string): Promise<Plan> => gas<Plan>('getPlan', name)
export const saveSession = (payload: SessionPayload): Promise<SaveResult> => gas<SaveResult>('saveSession', payload)
export const saveCardio = (payload: CardioPayload): Promise<SaveResult> => gas<SaveResult>('saveCardio', payload)
