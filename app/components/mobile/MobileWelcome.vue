<script setup>
defineEmits(["go"]);

const coins = [0, 1, 2, 3];
</script>

<template>
  <div class="m-welcome">
    <div class="m-welcome-orbits" aria-hidden="true"><i /><i /><i /></div>

    <svg class="m-welcome-art" viewBox="0 0 340 300" aria-hidden="true">
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
        <text x="74" y="190" font-size="27" font-weight="700" fill="#fff" letter-spacing="-0.8">81 000 ₽</text>
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
      <p class="m-welcome-text">Две зарплаты, обязательные платежи, конверты и цели — в одном месте и у обоих под рукой.</p>
    </div>

    <button class="m-start" type="button" @click="$emit('go', 'home')">
      <span class="m-start-handle"><MobileIcon name="arrow-right" :size="24" /></span>
      <span class="m-start-label">Создать бюджет</span>
      <span class="m-start-arrows" aria-hidden="true"><MobileIcon name="chevron-right" :size="18" /><MobileIcon name="chevron-right" :size="18" /><MobileIcon name="chevron-right" :size="18" /></span>
      <span class="m-start-lock" aria-hidden="true"><MobileIcon name="lock" :size="22" /></span>
    </button>
    <button class="m-welcome-secondary" type="button"><MobileIcon name="upload" :size="18" />Восстановить из резервной копии</button>
    <p class="m-welcome-hint">Есть семейная ссылка? Откройте её целиком, вместе с частью после #.</p>
  </div>
</template>
