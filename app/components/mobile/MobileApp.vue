<script setup>
import { createDemoApi } from "~/utils/family-demo";

const props = defineProps({
  // The real app passes a store over PocketBase; without it the screens show demo data.
  store: { type: Object, default: null },
  signedOut: Boolean,
  screen: { type: String, default: "home" },
  sheet: { type: String, default: "" },
  payday: { type: Number, default: 20 }
});

const budget = props.store || createFamilyBudget(createDemoApi({ signedIn: !props.signedOut }));
provideFamilyBudget(budget);

const tabs = [
  { key: "home", label: "Обзор", icon: "pie" },
  { key: "payday", label: "Выплаты", icon: "calendar" },
  { key: "envelopes", label: "Конверты", icon: "wallet" },
  { key: "goals", label: "Цели", icon: "target" }
];

const current = ref(props.screen);
const activePayday = ref(props.payday);
const sheet = ref(props.sheet);
const sheetData = ref(null);
const scroller = ref(null);

const ready = computed(() => budget.phase === "ready");
const showNav = computed(() => ready.value && tabs.some(tab => tab.key === current.value));

function go(screen, options = {}) {
  if (options.payday) activePayday.value = options.payday;
  sheet.value = "";
  if (current.value === screen) return;
  current.value = screen;
  scroller.value?.scrollTo({ top: 0 });
}

function open(name, data = null) {
  sheetData.value = data;
  sheet.value = name;
}

function close() {
  sheet.value = "";
}

function notify(message) {
  close();
  budget.notify(message);
}

// Signing out closes whatever was open; signing in starts on the overview.
watch(() => budget.phase, phase => {
  close();
  if (phase === "signed-out") current.value = "home";
});
</script>

<template>
  <div class="m-app" @keydown.esc="close">
    <div ref="scroller" class="m-scroll" :class="{ 'm-scroll--nav': showNav }">
      <Transition name="m-fade" mode="out-in">
        <MobileWelcome v-if="budget.phase === 'signed-out'" key="welcome" />
        <div v-else-if="budget.phase === 'loading'" key="loading" class="m-splash" role="status">
          <span class="m-splash-mark"><MobileIcon name="wallet" :size="30" /></span>
          <span>Загружаю бюджет…</span>
        </div>
        <div v-else-if="budget.phase === 'error'" key="error" class="m-splash">
          <span class="m-splash-mark m-splash-mark--warn"><MobileIcon name="alert" :size="30" /></span>
          <p>{{ budget.loadError }}</p>
          <button class="m-btn m-btn--primary" type="button" @click="budget.start()"><MobileIcon name="refresh" :size="20" />Повторить</button>
          <button class="m-text-btn" type="button" @click="budget.logout()">Войти под другим логином</button>
        </div>
        <MobileHome v-else-if="current === 'home'" key="home" @go="go" @open="open" />
        <MobilePayday v-else-if="current === 'payday'" key="payday" :payday="activePayday" @go="go" @open="open" />
        <MobileEnvelopes v-else-if="current === 'envelopes'" key="envelopes" @go="go" @open="open" />
        <MobileGoals v-else-if="current === 'goals'" key="goals" @go="go" @open="open" />
        <MobileAnalytics v-else-if="current === 'analytics'" key="analytics" @go="go" @open="open" />
        <MobileSettings v-else-if="current === 'settings'" key="settings" @go="go" @open="open" />
      </Transition>
    </div>

    <nav v-if="showNav" class="m-nav" aria-label="Разделы бюджета">
      <div class="m-nav-pill">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="m-nav-item"
          :class="{ on: current === tab.key }"
          :aria-label="tab.label"
          :aria-current="current === tab.key ? 'page' : undefined"
          @click="go(tab.key)"
        >
          <MobileIcon :name="tab.icon" :size="22" />
          <span class="m-nav-label">{{ tab.label }}</span>
        </button>
      </div>
      <button class="m-nav-add" type="button" aria-label="Записать операцию" @click="open('operation', { type: 'purchase' })">
        <MobileIcon name="plus" :size="26" />
      </button>
    </nav>

    <Transition name="m-slide" :duration="320">
      <div v-if="sheet && ready" class="m-overlay" @click.self="close">
        <MobileMonthSheet v-if="sheet === 'month'" @close="close" />
        <MobileExpenseSheet v-else-if="sheet === 'expense'" :data="sheetData" @close="close" @done="notify" />
        <MobileOperationSheet v-else-if="sheet === 'operation'" :data="sheetData" @close="close" @done="notify" />
        <MobileEnvelopeSheet v-else-if="sheet === 'envelope'" :data="sheetData" @close="close" @done="notify" />
        <MobileGoalSheet v-else-if="sheet === 'goal'" :data="sheetData" @close="close" @done="notify" />
        <MobileNoteSheet v-else-if="sheet === 'note'" @close="close" @done="notify" />
        <MobileSalarySheet v-else-if="sheet === 'salary'" @close="close" @done="notify" />
        <MobileFamilySheet v-else-if="sheet === 'family'" @close="close" @done="notify" />
        <MobileAccountSheet v-else-if="sheet === 'account'" @close="close" @done="notify" />
      </div>
    </Transition>

    <Transition name="m-toast">
      <div v-if="budget.toast" :key="budget.toast.id" class="m-toast" :class="{ 'm-toast--error': budget.toast.tone === 'error' }" role="status">
        <MobileIcon :name="budget.toast.tone === 'error' ? 'alert' : 'check'" :size="18" />{{ budget.toast.text }}
      </div>
    </Transition>
  </div>
</template>
