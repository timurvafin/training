<script>
  // Плейсхолдер для дня без подходов на выбранной неделе (exercises: []).
  // Чистая презентация — без стора и пропсов.
</script>

<div class="empty" data-testid="empty-day">
  <div class="e-ic" aria-hidden="true">
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="9.5" y1="14.5" x2="14.5" y2="19.5" />
      <line x1="14.5" y1="14.5" x2="9.5" y2="19.5" />
    </svg>
  </div>
  <div class="e-title">Подходов нет</div>
  <div class="e-sub">Тренер ещё не заполнил план на эту неделю. Выбери другой день или неделю.</div>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 14px;
    padding: 56px 28px;
    margin: 0 auto;
    max-width: 320px;
  }
  .e-ic {
    width: 84px;
    height: 84px;
    border-radius: 22px;
    border: 1.6px dashed var(--hair-2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-3);
  }
  .e-title {
    font-size: 19px;
    font-weight: 700;
    color: var(--text);
  }
  .e-sub {
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-2);
  }
</style>
