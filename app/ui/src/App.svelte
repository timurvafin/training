<script>
  import { onMount } from 'svelte'
  import { app, loadPlan, initOnlineListener, isLocked } from './lib/store.svelte.js'
  import Header from './lib/Header.svelte'
  import DayTabs from './lib/DayTabs.svelte'
  import SyncLine from './lib/SyncLine.svelte'
  import Banner from './lib/Banner.svelte'
  import ExerciseCard from './lib/ExerciseCard.svelte'
  import CardioForm from './lib/CardioForm.svelte'
  import EmptyDay from './lib/EmptyDay.svelte'
  import RestTimer from './lib/RestTimer.svelte'
  import LoadingScreen from './lib/LoadingScreen.svelte'
  import FinishSheet from './lib/FinishSheet.svelte'
  import SettingsSheet from './lib/SettingsSheet.svelte'

  onMount(() => {
    loadPlan()
    // initOnlineListener возвращает disposer (снимает online/visibilitychange/pagehide).
    // Возвращаем его из onMount — Svelte вызовет cleanup на destroy (нет дублей при HMR/remount).
    return initOnlineListener()
  })

  const locked = $derived(isLocked())
  const empty = $derived(!!(app.session && !app.session.cardio && !app.session.exercises.length))
</script>

<!-- Залипшая шапка: заголовок дня + кнопки (Завершить/Настройки) + вкладки дней + статус.
     Скроллится только контент ниже (main). -->
<div class="topbar">
  <Header />
  <DayTabs />
  <SyncLine />
  <Banner />
</div>

<main class="content scroll">
  {#if app.session && app.session.cardio}
    <CardioForm {locked} />
  {:else if empty}
    <EmptyDay />
  {:else}
    {#each app.session?.exercises ?? [] as ex (ex.exercise_id)}
      <ExerciseCard {ex} {locked} />
    {/each}
  {/if}
</main>

{#if app.timer}<RestTimer />{/if}

<LoadingScreen />
{#if app.showFinish}<FinishSheet />{/if}
{#if app.showSettings}<SettingsSheet />{/if}

<style>
  /* Шапка не скроллится (flex:0 0 auto в колонке #app). */
  .topbar {
    flex: 0 0 auto;
  }
  /* Лента контента — единственный скролл-контейнер (min-height:0 обязателен, иначе flex-ребёнок
     растёт вместо скролла). Поля экрана 18px, небольшой нижний отступ. */
  .content {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 4px 18px calc(18px + env(safe-area-inset-bottom));
  }
</style>
