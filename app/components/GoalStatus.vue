<script setup>
import { money } from "../utils/budget";

const { goal } = defineProps({ goal: { type: Object, required: true } });
const covered = computed(() => goal.saved + goal.planned);
const remaining = computed(() => Math.max(0, goal.target - covered.value));
const progress = computed(() => goal.target > 0 ? Math.min(100, covered.value / goal.target * 100) : 0);
</script>

<template>
  <span v-if="goal.closed" class="pill gold">Закрыта</span>
  <template v-else>
    <strong>{{ remaining > 0 ? money(remaining) : "Цель закрыта" }}</strong>
    <div class="meter"><span :style="{ width: progress + '%' }"></span></div>
  </template>
</template>
