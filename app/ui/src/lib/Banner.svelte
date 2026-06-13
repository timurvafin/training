<script>
  import { app, startNew } from './store.svelte.js'
</script>

<div>
  {#if app.session?.synced}
    <div class="banner">
      ✅ Тренировка завершена и отправлена. Перезаписать нельзя.
      <button onclick={startNew}>Начать заново</button>
    </div>
  {:else if app.session?.finalizing}
    <div class="banner" style="border-color:var(--warn);color:var(--warn);background:rgba(245,158,11,.12)">
      ⏳ Тренировка завершена, идёт отправка (если не ушло — нажми ↻).
      <button
        class="banner-restart"
        disabled={app.session?._submitting}
        onclick={startNew}
      >Отменить, начать заново</button>
    </div>
  {/if}
</div>

<style>
  .banner-restart {
    border-color: var(--warn);
    color: var(--warn);
  }
</style>
