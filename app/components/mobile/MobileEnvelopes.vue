<script setup>
import { envelopes, fmt, operations, plural, summary } from "~/utils/mobile-mock";

defineEmits(["go", "open", "notify"]);

const swiped = ref("o1");
const share = item => Math.max(1, Math.round(item.amount / summary.balances * 100));

function toggleSwipe(id) {
  swiped.value = swiped.value === id ? "" : id;
}

function undoText(item) {
  return item.type === "deposit"
    ? `Пополнение отменено: −${fmt(item.amount)} ₽ из «${item.envelope}»`
    : `Покупка отменена: ${fmt(item.amount)} ₽ вернулись в «${item.envelope}»`;
}
</script>

<template>
  <div class="m-page">
    <section class="m-panel">
      <header class="m-top m-top--simple">
        <p class="m-label">Сейчас <b>отложено</b></p>
        <button class="m-icon-btn" type="button" aria-label="Новый конверт"><MobileIcon name="plus" /></button>
      </header>
      <p class="m-display m-display--xl"><MobileMoney :value="summary.balances" /></p>
      <div class="m-chips-row">
        <span class="m-chip m-chip--green m-chip--sm"><MobileIcon name="trend" :size="14" />+23 000 ₽ в ноябре</span>
        <span class="m-chip m-chip--sm">{{ plural(envelopes.length, ['конверт', 'конверта', 'конвертов']) }}</span>
      </div>
      <p class="m-panel-hint">Это уже имеющиеся деньги. Они не прибавляются к свободному остатку от будущей зарплаты.</p>
    </section>

    <div class="m-bar m-bar--lg m-mt" aria-hidden="true">
      <i v-for="item in envelopes" :key="item.id" :style="{ flexGrow: item.amount, background: item.color }" />
    </div>

    <div class="m-actions">
      <button class="m-btn m-btn--primary" type="button" @click="$emit('open', 'operation', { type: 'purchase' })"><MobileIcon name="minus" />Покупка</button>
      <button class="m-btn m-btn--surface" type="button" @click="$emit('open', 'operation', { type: 'deposit' })"><MobileIcon name="plus" />Пополнение</button>
    </div>

    <div class="m-section-head"><h2 class="m-h2">Мои <b>конверты</b></h2></div>
    <div class="m-env-grid">
      <button v-for="item in envelopes" :key="item.id" type="button" class="m-env" @click="$emit('open', 'operation', { envelope: item.id })">
        <span class="m-env-head">
          <span class="m-env-icon" :style="{ '--c': item.color }"><MobileIcon :name="item.icon" /></span>
          <span class="m-env-share">{{ share(item) }}%</span>
        </span>
        <span class="m-env-name">{{ item.name }}</span>
        <span class="m-env-amount"><MobileMoney :value="item.amount" /></span>
      </button>
      <button type="button" class="m-env m-env--add"><MobileIcon name="plus" /><span>Новый конверт</span></button>
    </div>

    <div class="m-section-head"><h2 class="m-h2">История <b>операций</b></h2></div>
    <p class="m-hint m-hint--flush">Смахните операцию влево, чтобы отменить её. Сумма вернётся в тот же конверт.</p>
    <section v-for="group in operations" :key="group.label">
      <p class="m-day-label">{{ group.label }}</p>
      <ul class="m-list">
        <li v-for="item in group.items" :key="item.id" class="m-swipe" :class="{ open: swiped === item.id }">
          <button class="m-swipe-action" type="button" :tabindex="swiped === item.id ? 0 : -1" @click="$emit('notify', undoText(item))">
            <MobileIcon name="undo" :size="20" />Отменить
          </button>
          <button class="m-swipe-row" type="button" :aria-expanded="swiped === item.id" @click="toggleSwipe(item.id)">
            <MobileOperation :item="item" />
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>
