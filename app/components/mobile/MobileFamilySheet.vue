<script setup>
import { formatCode, formatStamp } from "~/utils/family";

defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const fresh = ref(null);
const busy = ref(false);
const confirming = ref("");
// The new code stays on top until someone uses it; the list shows the others.
const shown = computed(() => (fresh.value && budget.invites.some(item => item.id === fresh.value.id) ? fresh.value : null));
const others = computed(() => budget.invites.filter(item => item.id !== shown.value?.id));

async function invite() {
  busy.value = true;
  fresh.value = await budget.createInvite();
  busy.value = false;
}

async function copy(code) {
  try {
    await navigator.clipboard.writeText(formatCode(code));
    budget.notify("Код скопирован");
  } catch {
    budget.notify("Не удалось скопировать — перепишите код вручную", "error");
  }
}

async function remove(member) {
  if (confirming.value !== member.id) {
    confirming.value = member.id;
    return;
  }
  confirming.value = "";
  if (await budget.removeMember(member.id)) budget.notify(`${member.name || member.username} больше не видит бюджет`);
}

async function revoke(item) {
  if (await budget.deleteInvite(item.id)) {
    if (fresh.value?.id === item.id) fresh.value = null;
    budget.notify("Приглашение отменено");
  }
}
</script>

<template>
  <MobileSheet title="Семья" eyebrow="Кто видит и ведёт бюджет" @close="$emit('close')">
    <ul class="m-list m-list--card">
      <li v-for="member in budget.members" :key="member.id" class="m-row">
        <span class="m-row-icon m-row-icon--sm" :style="{ color: member.role === 'owner' ? 'var(--m-purple-light)' : 'var(--m-cyan)' }"><MobileIcon name="family" :size="20" /></span>
        <span class="m-row-main">
          <span class="m-row-title">{{ member.name || member.username }}<template v-if="member.id === budget.user?.id"> · вы</template></span>
          <span class="m-row-meta">@{{ member.username }} · {{ member.role === 'owner' ? 'владелец' : 'участник' }}</span>
        </span>
        <button
          v-if="budget.isOwner && member.role !== 'owner'"
          class="m-chip m-chip--button m-chip--sm"
          :class="{ 'm-chip--danger': confirming === member.id }"
          type="button"
          @click="remove(member)"
        >
          {{ confirming === member.id ? 'Точно удалить?' : 'Удалить' }}
        </button>
      </li>
    </ul>

    <template v-if="budget.isOwner">
      <div v-if="shown" class="m-invite">
        <span class="m-field-label">Новый код приглашения</span>
        <div class="m-link-box">
          <MobileIcon name="lock" :size="20" />
          <span class="m-link-text m-invite-code">{{ formatCode(shown.code) }}</span>
          <button class="m-icon-btn" type="button" aria-label="Скопировать код" @click="copy(shown.code)"><MobileIcon name="copy" :size="20" /></button>
        </div>
        <p class="m-hint m-hint--flush">Действует до {{ formatStamp(shown.expires_at) }} и только один раз. Второй человек открывает приложение, выбирает «По приглашению» и сам придумывает логин и пароль.</p>
      </div>

      <template v-if="others.length">
        <span class="m-field-label">Действующие приглашения</span>
        <ul class="m-list m-list--card">
          <li v-for="item in others" :key="item.id" class="m-row">
            <button class="m-row-main" type="button" @click="copy(item.code)">
              <span class="m-row-title m-invite-code">{{ formatCode(item.code) }}</span>
              <span class="m-row-meta">до {{ formatStamp(item.expires_at) }}</span>
            </button>
            <button class="m-chip m-chip--button m-chip--sm" type="button" @click="revoke(item)">Отменить</button>
          </li>
        </ul>
      </template>

      <div class="m-callout m-callout--warn">
        <MobileIcon name="shield" :size="20" />
        <p><b>Код открывает доступ к финансам.</b> Передавайте его только членам семьи, лучше лично или в переписке, где больше никого нет.</p>
      </div>
    </template>
    <p v-else class="m-hint m-hint--flush">Пригласить нового участника может владелец бюджета.</p>

    <template v-if="budget.isOwner" #footer>
      <button class="m-btn m-btn--primary" type="button" :disabled="busy" @click="invite"><MobileIcon name="plus" :size="20" />Создать код приглашения</button>
    </template>
  </MobileSheet>
</template>
