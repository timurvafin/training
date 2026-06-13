import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

// iOS Safari: без хотя бы одного touch-листенера Safari не доставляет click-события для
// делегирования событий Svelte 5 — часть тапов «не нажимается». Пустой passive-листенер чинит.
document.addEventListener('touchstart', () => {}, { passive: true })

const app = mount(App, { target: document.getElementById('app') })

export default app
