<script>
  import { app } from './store.svelte.js'
</script>

{#if app.loading.on}
  <div class="loading" data-testid="loading-screen" role="status" aria-live="polite">
    <div class="brand">
      <span class="mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <polygon points="13 2 4 14 11 14 10 22 20 9 13 9" fill="currentColor" />
        </svg>
      </span>
      <span class="brand-name">Тренировки</span>
    </div>

    <div class="ringwrap"><div class="ring"></div></div>

    <div class="lstatus">{app.loading.label}</div>

    <div class="lbar"><i style="width:{app.loading.pct}%"></i></div>
  </div>
{/if}

<style>
  .loading {
    position: fixed;
    inset: 0;
    z-index: 100;
    background:
      radial-gradient(120% 70% at 50% 0%, var(--accent-tint), transparent 60%),
      var(--app);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 22px;
    padding: 24px;
    padding-bottom: calc(24px + env(safe-area-inset-bottom));
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .mark {
    width: 38px;
    height: 38px;
    flex: 0 0 auto;
    border-radius: 11px;
    background: var(--accent);
    color: var(--on-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 18px var(--accent-tint);
  }
  .mark svg { width: 22px; height: 22px; }
  .brand-name {
    font-family: var(--f-ui);
    font-size: 23px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: var(--text);
  }

  .ringwrap {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 4px solid var(--hair-2);
    border-top-color: var(--accent);
    animation: spin 0.8s linear infinite;
  }

  .lstatus {
    font-family: var(--f-ui);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-2);
    text-align: center;
    min-height: 21px;
  }

  .lbar {
    width: min(240px, 70vw);
    height: 5px;
    border-radius: var(--r-pill);
    background: var(--hair);
    overflow: hidden;
  }
  .lbar i {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: inherit;
    transition: width 0.35s ease;
  }
</style>
