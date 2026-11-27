<script setup>
defineEmits(["close", "done"]);
</script>

<template>
  <MobileSheet title="Ссылка на бюджет" eyebrow="Передать доступ" @close="$emit('close')">
    <div class="m-share-hero">
      <span class="m-share-icon"><MobileIcon name="lock" :size="28" /></span>
      <p>Это постоянная ссылка на общий бюджет. Отправьте её мужу или жене один раз: новые изменения появятся у обоих автоматически.</p>
    </div>
    <div class="m-link-box">
      <MobileIcon name="link" :size="20" />
      <span class="m-link-text">…/#sync.7Hq2Lw9cR4tZ…xK9p</span>
      <button class="m-icon-btn" type="button" aria-label="Скопировать ссылку" @click="$emit('done', 'Ссылка скопирована')"><MobileIcon name="copy" :size="20" /></button>
    </div>
    <div class="m-callout m-callout--warn">
      <MobileIcon name="shield" :size="20" />
      <p><b>Ссылка открывает доступ к финансам.</b> Отправляйте её только членам семьи. Ключ расшифровки есть только в ней.</p>
    </div>
    <template #footer>
      <button class="m-btn m-btn--surface" type="button"><MobileIcon name="share" :size="20" />Поделиться</button>
      <button class="m-btn m-btn--primary" type="button" @click="$emit('done', 'Ссылка скопирована')"><MobileIcon name="copy" :size="20" />Скопировать</button>
    </template>
  </MobileSheet>
</template>
