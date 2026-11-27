<script setup>
const emit = defineEmits(["close", "done"]);

const budget = useFamilyBudget();
const name = ref(budget.user?.name || "");
const passwords = reactive({ current: "", next: "", repeat: "" });
const busy = ref(false);

const nameChanged = computed(() => name.value.trim() && name.value.trim() !== budget.user?.name);
const passwordHint = computed(() => {
  if (passwords.next && passwords.next.length < 8) return "Новый пароль — не короче 8 символов";
  if (passwords.repeat && passwords.repeat !== passwords.next) return "Пароли не совпадают";
  return "";
});
const canChangePassword = computed(() => passwords.current && passwords.next.length >= 8 && passwords.repeat === passwords.next && !busy.value);

async function saveName() {
  busy.value = true;
  const done = await budget.renameMe(name.value);
  busy.value = false;
  if (done) emit("done", "Имя сохранено");
}

async function savePassword() {
  if (!canChangePassword.value) return;
  busy.value = true;
  const done = await budget.changePassword(passwords.current, passwords.next);
  busy.value = false;
  if (done) emit("done", "Пароль изменён. На других устройствах войдите заново");
}
</script>

<template>
  <MobileSheet title="Аккаунт" :eyebrow="`Логин @${budget.user?.username}`" @close="$emit('close')">
    <label class="m-field">
      <span class="m-field-label">Как вас зовут</span>
      <span class="m-inline">
        <input v-model="name" class="m-input" maxlength="80" autocomplete="given-name" @keydown.enter="nameChanged && saveName()">
        <button class="m-btn m-btn--surface m-btn--fit" type="button" :disabled="!nameChanged || busy" @click="saveName">Сохранить</button>
      </span>
    </label>

    <form class="m-field" @submit.prevent="savePassword">
      <span class="m-field-label">Сменить пароль</span>
      <input v-model="passwords.current" class="m-input" type="password" placeholder="Текущий пароль" autocomplete="current-password" aria-label="Текущий пароль">
      <input v-model="passwords.next" class="m-input" type="password" placeholder="Новый пароль" autocomplete="new-password" aria-label="Новый пароль">
      <input v-model="passwords.repeat" class="m-input" type="password" placeholder="Новый пароль ещё раз" autocomplete="new-password" aria-label="Новый пароль ещё раз">
      <p v-if="passwordHint" class="m-hint m-hint--flush m-hint--warn">{{ passwordHint }}</p>
      <button class="m-btn m-btn--primary" type="submit" :disabled="!canChangePassword">Сменить пароль</button>
    </form>
    <p class="m-hint m-hint--flush">Забыли пароль? Владелец может задать новый на сервере командой family:password.</p>
  </MobileSheet>
</template>
