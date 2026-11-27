<script setup>
import { fmt, monthInfo, plural } from "~/utils/family";

defineEmits(["go", "open"]);

const PAGE = 40;
const budget = useFamilyBudget();
const month = computed(() => monthInfo(budget.month));
const swiped = ref("");
const busy = ref("");
const limit = ref(PAGE);
const showArchive = ref(false);
const share = item => (budget.calc.balances ? Math.max(1, Math.round(item.amount / budget.calc.balances * 100)) : 0);

// The newest operations first, a page at a time, still grouped by day.
const groups = computed(() => {
  let left = limit.value;
  const result = [];
  for (const group of budget.operationGroups) {
    if (left <= 0) break;
    const items = group.items.slice(0, left);
    left -= items.length;
    result.push({ ...group, items });
  }
  return result;
});
const hasMore = computed(() => budget.operations.length > limit.value);

function toggleSwipe(id) {
  swiped.value = swiped.value === id ? "" : id;
}

let touch = null;
function touchStart(event, id) {
  touch = { id, x: event.touches[0].clientX, y: event.touches[0].clientY };
}
function touchEnd(event) {
  if (!touch) return;
  const dx = event.changedTouches[0].clientX - touch.x;
  const dy = event.changedTouches[0].clientY - touch.y;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) swiped.value = dx < 0 ? touch.id : "";
  touch = null;
}

async function undo(item) {
  busy.value = item.id;
  const done = await budget.undoOperation(item.id);
  busy.value = "";
  if (!done) return;
  swiped.value = "";
  budget.notify(item.type === "deposit"
    ? `Пополнение отменено: −${fmt(item.amount)} ₽ из «${item.envelope}»`
    : `Покупка отменена: ${fmt(item.amount)} ₽ вернулись в «${item.envelope}»`);
}
</script>

<template>
  <div class="m-page">
    <section class="m-panel">
      <header class="m-top m-top--simple">
        <p class="m-label">Сейчас <b>отложено</b></p>
        <button class="m-icon-btn" type="button" aria-label="Новый конверт" @click="$emit('open', 'envelope', { isNew: true })"><MobileIcon name="plus" /></button>
      </header>
      <p class="m-display m-display--xl"><MobileMoney :value="budget.calc.balances" /></p>
      <div class="m-chips-row">
        <span v-if="budget.monthFlow" class="m-chip m-chip--sm" :class="budget.monthFlow > 0 ? 'm-chip--green' : 'm-chip--warn'">
          <MobileIcon name="trend" :size="14" />{{ budget.monthFlow > 0 ? '+' : '−' }}{{ fmt(budget.monthFlow) }} ₽ в {{ month.prepositional }}
        </span>
        <span class="m-chip m-chip--sm">{{ plural(budget.envelopes.length, ['конверт', 'конверта', 'конвертов']) }}</span>
      </div>
      <p class="m-panel-hint">Это уже имеющиеся деньги. Они не прибавляются к свободному остатку от будущей зарплаты.</p>
    </section>

    <div class="m-bar m-bar--lg m-mt" aria-hidden="true">
      <i v-for="item in budget.envelopes" :key="item.id" :style="{ flexGrow: item.amount, background: item.color }" />
    </div>

    <div class="m-actions">
      <button class="m-btn m-btn--primary" type="button" @click="$emit('open', 'operation', { type: 'purchase' })"><MobileIcon name="minus" />Покупка</button>
      <button class="m-btn m-btn--surface" type="button" @click="$emit('open', 'operation', { type: 'deposit' })"><MobileIcon name="plus" />Пополнение</button>
    </div>

    <div class="m-section-head"><h2 class="m-h2">Мои <b>конверты</b></h2></div>
    <div class="m-env-grid">
      <div v-for="item in budget.envelopes" :key="item.id" class="m-env">
        <button type="button" class="m-env-main" :aria-label="`Операция с конвертом «${item.name}»`" @click="$emit('open', 'operation', { envelope: item.id })" />
        <span class="m-env-head">
          <span class="m-env-icon" :style="{ '--c': item.color }"><MobileIcon :name="item.icon" /></span>
          <button class="m-env-more" type="button" :aria-label="`Настроить конверт «${item.name}»`" @click="$emit('open', 'envelope', item)"><MobileIcon name="dots" /></button>
        </span>
        <span class="m-env-name">{{ item.name }}<small v-if="share(item)"> · {{ share(item) }}%</small></span>
        <span class="m-env-amount"><MobileMoney :value="item.amount" /></span>
      </div>
      <button type="button" class="m-env m-env--add" @click="$emit('open', 'envelope', { isNew: true })"><MobileIcon name="plus" /><span>Новый конверт</span></button>
    </div>

    <template v-if="budget.archivedEnvelopes.length">
      <button class="m-disclosure" type="button" :aria-expanded="showArchive" @click="showArchive = !showArchive">
        <span>В архиве · {{ budget.archivedEnvelopes.length }}</span>
        <MobileIcon :name="showArchive ? 'chevron-up' : 'chevron-down'" :size="20" />
      </button>
      <ul v-if="showArchive" class="m-list m-list--card">
        <li v-for="item in budget.archivedEnvelopes" :key="item.id" class="m-row is-done">
          <span class="m-row-icon m-row-icon--sm" :style="{ color: item.color }"><MobileIcon name="archive" :size="20" /></span>
          <button class="m-row-main" type="button" @click="$emit('open', 'envelope', item)">
            <span class="m-row-title">{{ item.name }}</span>
            <span class="m-row-meta"><MobileMoney :value="item.amount" /></span>
          </button>
          <button class="m-chip m-chip--button m-chip--sm" type="button" @click="budget.setEnvelopeArchived(item.id, false)">Вернуть</button>
        </li>
      </ul>
    </template>

    <div class="m-section-head"><h2 class="m-h2">История <b>операций</b></h2></div>
    <template v-if="groups.length">
      <p class="m-hint m-hint--flush">Смахните операцию влево, чтобы отменить её. Сумма вернётся в тот же конверт.</p>
      <section v-for="group in groups" :key="group.day">
        <p class="m-day-label">{{ group.label }}</p>
        <ul class="m-list">
          <li v-for="item in group.items" :key="item.id" class="m-swipe" :class="{ open: swiped === item.id }">
            <button class="m-swipe-action" type="button" :tabindex="swiped === item.id ? 0 : -1" :disabled="busy === item.id" @click="undo(item)">
              <MobileIcon name="undo" :size="20" />Отменить
            </button>
            <button
              class="m-swipe-row"
              type="button"
              :aria-expanded="swiped === item.id"
              @click="toggleSwipe(item.id)"
              @touchstart.passive="touchStart($event, item.id)"
              @touchend="touchEnd"
            >
              <MobileOperation :item="item" />
            </button>
          </li>
        </ul>
      </section>
      <button v-if="hasMore" class="m-add-row" type="button" @click="limit += PAGE">Показать ещё</button>
    </template>
    <p v-else class="m-empty">Здесь появятся покупки и пополнения.</p>
  </div>
</template>
