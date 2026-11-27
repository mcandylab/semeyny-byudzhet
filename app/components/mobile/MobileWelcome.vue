<script setup>
const budget = useFamilyBudget();

const coins = [0, 1, 2, 3];
const mode = ref("login");
const busy = ref(false);
const error = ref("");
const form = reactive({ username: "", password: "", code: "", name: "", repeat: "" });

const joining = computed(() => mode.value === "join");
const canSubmit = computed(() => {
  if (!form.username.trim() || !form.password) return false;
  return !joining.value || (form.code.replace(/[^a-z0-9]/gi, "").length === 8 && form.password.length >= 8 && form.repeat === form.password);
});
const hint = computed(() => {
  if (!joining.value) return "";
  if (form.password && form.password.length < 8) return "Пароль — не короче 8 символов";
  if (form.repeat && form.repeat !== form.password) return "Пароли не совпадают";
  return "";
});

function switchMode(value) {
  mode.value = value;
  error.value = "";
}

async function submit() {
  if (!canSubmit.value || busy.value) return;
  busy.value = true;
  error.value = joining.value
    ? await budget.join({ code: form.code, name: form.name.trim(), username: form.username, password: form.password, passwordConfirm: form.repeat })
    : await budget.login(form.username, form.password);
  busy.value = false;
}
</script>

<template>
  <div class="m-welcome">
    <div class="m-welcome-orbits" aria-hidden="true"><i /><i /><i /></div>

    <svg class="m-welcome-art m-welcome-art--compact" viewBox="0 30 340 240" aria-hidden="true">
      <defs>
        <linearGradient id="m-w-purple" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8E63F8" />
          <stop offset="1" stop-color="#5B2CD3" />
        </linearGradient>
        <linearGradient id="m-w-cyan" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#C2EFFC" />
          <stop offset="1" stop-color="#83D4EF" />
        </linearGradient>
        <clipPath id="m-w-front"><rect x="52" y="122" width="184" height="116" rx="22" /></clipPath>
      </defs>
      <ellipse cx="170" cy="178" rx="138" ry="104" fill="#0C0C0D" />
      <ellipse cx="170" cy="178" rx="158" ry="120" fill="none" stroke="rgba(252,252,252,.09)" />

      <g transform="rotate(11 205 150)">
        <rect x="120" y="82" width="176" height="112" rx="22" fill="url(#m-w-cyan)" />
        <rect x="140" y="104" width="32" height="24" rx="7" fill="rgba(26,26,26,.16)" />
        <text x="140" y="172" font-size="14" font-weight="700" fill="#1A1A1A">Выплата 5-го</text>
      </g>

      <g transform="rotate(-9 144 180)">
        <rect x="52" y="122" width="184" height="116" rx="22" fill="url(#m-w-purple)" />
        <g clip-path="url(#m-w-front)" fill="none" stroke="rgba(255,255,255,.18)">
          <circle cx="236" cy="122" r="46" />
          <circle cx="236" cy="122" r="74" />
          <circle cx="52" cy="238" r="52" />
        </g>
        <text x="74" y="156" font-size="13" font-weight="600" fill="rgba(255,255,255,.78)">Выплата 20-го</text>
        <text x="74" y="190" font-size="27" font-weight="700" fill="#fff" letter-spacing="-0.8">₽ ₽ ₽</text>
        <rect x="74" y="204" width="70" height="20" rx="10" fill="rgba(255,255,255,.18)" />
      </g>

      <g v-for="coin in coins" :key="coin" :transform="`translate(0 ${-coin * 11})`">
        <path d="M238 248v9a32 11 0 0 0 64 0v-9" fill="#D9D9DE" stroke="#1A1A1A" stroke-width="2" />
        <ellipse cx="270" cy="248" rx="32" ry="11" fill="#FCFCFC" stroke="#1A1A1A" stroke-width="2" />
      </g>
      <text x="270" y="219" text-anchor="middle" font-size="13" font-weight="800" fill="#1A1A1A">₽</text>

      <g transform="translate(74 82)">
        <circle r="25" fill="#FCFCFC" stroke="#1A1A1A" stroke-width="2" />
        <circle r="18" fill="none" stroke="rgba(26,26,26,.25)" stroke-width="1.5" />
        <text y="8" text-anchor="middle" font-size="22" font-weight="800" fill="#1A1A1A">₽</text>
      </g>
      <path d="M306 76l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#97E0F7" />
      <path d="M34 196l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#B49BFA" />
      <circle cx="292" cy="140" r="3" fill="#FCFCFC" opacity=".5" />
    </svg>

    <div class="m-welcome-copy">
      <h1 class="m-welcome-title"><b>Семейный бюджет</b> под контролем</h1>
      <p class="m-welcome-text">Две зарплаты, платежи, конверты и цели — общие для всей семьи.</p>
    </div>

    <form class="m-login" @submit.prevent="submit">
      <div class="m-segment" role="tablist" aria-label="Вход">
        <button type="button" role="tab" :aria-selected="!joining" :class="{ on: !joining }" @click="switchMode('login')">Вход</button>
        <button type="button" role="tab" :aria-selected="joining" :class="{ on: joining }" @click="switchMode('join')">По приглашению</button>
      </div>
      <template v-if="joining">
        <input v-model="form.code" class="m-input m-input--code" placeholder="Код: XXXX-XXXX" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" aria-label="Код приглашения">
        <input v-model="form.name" class="m-input" placeholder="Как вас зовут" autocomplete="given-name" aria-label="Имя">
      </template>
      <input v-model="form.username" class="m-input" placeholder="Логин" autocomplete="username" autocapitalize="none" spellcheck="false" aria-label="Логин">
      <input v-model="form.password" class="m-input" type="password" :placeholder="joining ? 'Придумайте пароль' : 'Пароль'" :autocomplete="joining ? 'new-password' : 'current-password'" aria-label="Пароль">
      <input v-if="joining" v-model="form.repeat" class="m-input" type="password" placeholder="Пароль ещё раз" autocomplete="new-password" aria-label="Пароль ещё раз">
      <p v-if="error || hint" class="m-login-error" :class="{ 'm-login-error--hint': !error }" role="alert">{{ error || hint }}</p>
      <button class="m-btn m-btn--primary m-login-submit" type="submit" :disabled="!canSubmit || busy">
        {{ busy ? 'Подождите…' : joining ? 'Присоединиться к семье' : 'Войти' }}<MobileIcon v-if="!busy" name="arrow-right" :size="20" />
      </button>
      <p class="m-welcome-hint">{{ joining ? 'Код приглашения даёт владелец бюджета в настройках. Он действует один раз.' : 'Почта не нужна: только логин и пароль.' }}</p>
    </form>
  </div>
</template>
