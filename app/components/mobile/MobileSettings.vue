<script setup>
import { paydays, summary } from "~/utils/mobile-mock";

defineEmits(["go", "open", "notify"]);

const auto = { first: paydays[20].days, second: paydays[5].days };
const tithe = ref(summary.titheRate);
const first = ref(auto.first);
const second = ref(auto.second);
const manual = computed(() => first.value !== auto.first || second.value !== auto.second);

function reset() {
  first.value = auto.first;
  second.value = auto.second;
}
</script>

<template>
  <div class="m-page">
    <header class="m-top">
      <button class="m-icon-btn" type="button" aria-label="Назад" @click="$emit('go', 'home')"><MobileIcon name="arrow-left" /></button>
      <h1 class="m-top-heading"><b>Настройки</b></h1>
    </header>

    <section class="m-profile">
      <span class="m-avatar m-avatar--lg"><MobileIcon name="family" :size="30" /></span>
      <div>
        <p class="m-profile-title">Семейный бюджет</p>
        <p class="m-profile-meta"><i class="m-dot" />Общий доступ · шифрование</p>
      </div>
    </section>

    <p class="m-group-title">Зарплата</p>
    <div class="m-group">
      <button class="m-set-row" type="button">
        <span class="m-set-icon" style="--c: #A98BF5"><MobileIcon name="ruble" :size="20" /></span>
        <span class="m-set-label"><small>Зарплата за полный месяц</small><span class="m-set-big"><MobileMoney :value="summary.salary" /></span></span>
        <MobileIcon name="edit" :size="20" class="m-faint" />
      </button>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: #FCFCFC"><MobileIcon name="heart" :size="20" /></span>
        <span class="m-set-label">Десятина<small>От каждой выплаты</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Уменьшить десятину" @click="tithe = Math.max(0, tithe - 1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ tithe }}%</b>
          <button type="button" aria-label="Увеличить десятину" @click="tithe += 1"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
    </div>
    <p class="m-hint">Зарплата ÷ рабочие дни месяца × рабочие дни периода. Периоды: с 1 по 15 число и с 16 по конец месяца.</p>

    <p class="m-group-title">Рабочие дни · ноябрь</p>
    <div class="m-group">
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: #723FEB"><MobileIcon name="calendar" :size="20" /></span>
        <span class="m-set-label">С 1 по 15 число<small>Выплата 20-го</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Меньше дней" @click="first = Math.max(0, first - 1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ first }}</b>
          <button type="button" aria-label="Больше дней" @click="first = Math.min(15, first + 1)"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: #97E0F7"><MobileIcon name="calendar" :size="20" /></span>
        <span class="m-set-label">С 16 по 30 число<small>Выплата 5-го</small></span>
        <div class="m-stepper">
          <button type="button" aria-label="Меньше дней" @click="second = Math.max(0, second - 1)"><MobileIcon name="minus" :size="16" /></button>
          <b>{{ second }}</b>
          <button type="button" aria-label="Больше дней" @click="second = Math.min(16, second + 1)"><MobileIcon name="plus" :size="16" /></button>
        </div>
      </div>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: #8E8E93"><MobileIcon name="clock" :size="20" /></span>
        <span class="m-set-label">Всего {{ first + second }} дней<small>{{ manual ? 'Изменено вручную' : 'По календарю' }}</small></span>
        <button v-if="manual" class="m-chip m-chip--button m-chip--sm" type="button" @click="reset">Сбросить</button>
        <span v-else class="m-chip m-chip--green m-chip--sm"><MobileIcon name="check" :size="14" />Авто</span>
      </div>
    </div>
    <p class="m-hint">Праздники и переносы на 2026–2027 годы учтены. Источник: КонсультантПлюс.</p>

    <p class="m-group-title">Доступ</p>
    <div class="m-group">
      <button class="m-set-row" type="button" @click="$emit('open', 'share')">
        <span class="m-set-icon" style="--c: #97E0F7"><MobileIcon name="link" :size="20" /></span>
        <span class="m-set-label">Семейная ссылка<small>Одна ссылка для обоих устройств</small></span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
      <div class="m-set-row">
        <span class="m-set-icon" style="--c: #34C77B"><MobileIcon name="cloud" :size="20" /></span>
        <span class="m-set-label">Синхронизация<small>Изменения появляются у обоих</small></span>
        <span class="m-set-value m-set-value--ok">Включена</span>
      </div>
    </div>

    <p class="m-group-title">Данные</p>
    <div class="m-group">
      <button class="m-set-row" type="button" @click="$emit('notify', 'Резервная копия скачана')">
        <span class="m-set-icon" style="--c: #FCFCFC"><MobileIcon name="download" :size="20" /></span>
        <span class="m-set-label">Скачать копию<small>Файл .json с текущим бюджетом</small></span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
      <button class="m-set-row" type="button">
        <span class="m-set-icon" style="--c: #FCFCFC"><MobileIcon name="upload" :size="20" /></span>
        <span class="m-set-label">Восстановить из файла<small>Заменит текущие данные</small></span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
      <button class="m-set-row" type="button">
        <span class="m-set-icon" style="--c: #FCFCFC"><MobileIcon name="printer" :size="20" /></span>
        <span class="m-set-label">Распечатать</span>
        <MobileIcon name="chevron-right" :size="18" class="m-faint" />
      </button>
    </div>

    <p class="m-foot-note">Последнее изменение на этом устройстве: 27 ноября 2026, 21:14</p>
  </div>
</template>
