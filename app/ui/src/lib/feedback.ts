// Сигнал окончания отдыха: звук (Web Audio) + вибрация.
// Автоплей-политика браузеров запрещает звук без user-gesture, поэтому AudioContext
// создаётся/возобновляется ТОЛЬКО из unlockAudio(), который дёргаем по тапу пользователя
// (старт таймера / размьют). Всё в try/catch — фича необязательная и не должна ничего ронять
// (в т.ч. на iOS Safari, где navigator.vibrate отсутствует).

let ctx: AudioContext | null = null

function ACtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext || null
}

// Разблокировать/создать аудио-контекст по жесту пользователя.
export function unlockAudio(): void {
  try {
    const Ctor = ACtor()
    if (!Ctor) return
    if (!ctx) ctx = new Ctor()
    if (ctx.state === 'suspended') ctx.resume()
  } catch (e) {
    /* noop */
  }
}

// Короткий двухтоновый сигнал. Тихо выходит, если контекст не разблокирован.
export function beep(): void {
  try {
    if (!ctx || ctx.state !== 'running') return
    const t0 = ctx.currentTime
    const tones = [
      [880, 0.0], // частота, смещение от начала
      [1320, 0.14],
    ]
    for (const [freq, off] of tones) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = t0 + off
      // Плавная атака/спад через gain — без щелчков на старте/стопе.
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.14)
    }
  } catch (e) {
    /* noop */
  }
}

// Вибрация (Android Chrome; iOS Safari API не поддерживает — тихо игнорируется).
export function vibrate(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern)
    }
  } catch (e) {
    /* noop */
  }
}

// Единый сигнал окончания отдыха. muted=true → полный тихий режим (ни звука, ни вибрации).
export function signalRestEnd(muted: boolean): void {
  if (muted) return
  beep()
  vibrate([120, 60, 120])
}
