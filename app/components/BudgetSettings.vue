<script setup>
import { automaticWorkdays, parseMonth } from "../utils/budget";

const props = defineProps({
  state: { type: Object, required: true },
  workdays: { type: Object, required: true },
  shared: Boolean
});
defineEmits(["setting", "workday", "reset", "export", "import", "print"]);

const automatic = computed(() => automaticWorkdays(props.state.month));
const override = computed(() => props.state.workdays[props.state.month] || {});
const calendarKnown = computed(() => [2026, 2027].includes(parseMonth(props.state.month).year));
</script>

<template>
  <section class="settings-grid">
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Основные правила</p><h2>Зарплата и десятина</h2></div></div>
      <div class="settings-form">
        <label class="field"><span class="field-label">Зарплата за полный месяц</span><span class="input-with-suffix">
          <input class="settings-input" type="number" min="0" step="1" :value="state.settings.salary" @change="$emit('setting', 'salary', $event.target.value)"><span class="input-suffix">₽</span>
        </span></label>
        <label class="field"><span class="field-label">Десятина от каждой выплаты</span><span class="input-with-suffix">
          <input class="settings-input" type="number" min="0" step="0.1" :value="state.settings.titheRate" @change="$emit('setting', 'titheRate', $event.target.value)"><span class="input-suffix">%</span>
        </span></label>
        <div class="formula">Зарплата ÷ рабочие дни месяца × рабочие дни периода.<br>Периоды: с 1 по 15 число и с 16 по конец месяца.<br>Десятина рассчитывается отдельно от каждой выплаты.</div>
        <p class="field-hint">Расчёт ведётся по указанной формуле, без дополнительных налогов и удержаний.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Производственный календарь</p><h2>Рабочие дни</h2><p class="card-subtitle">Автоматически: {{ automatic.first }} + {{ automatic.second }} = {{ automatic.total }}</p></div></div>
      <div class="settings-form">
        <div class="workdays-inputs">
          <label class="field"><span class="field-label">С 1 по 15 число</span><input class="settings-input" type="number" min="0" max="15" :value="workdays.first" @change="$emit('workday', 'first', $event.target.value)"></label>
          <label class="field"><span class="field-label">С 16 по конец месяца</span><input class="settings-input" type="number" min="0" max="16" :value="workdays.second" @change="$emit('workday', 'second', $event.target.value)"></label>
        </div>
        <p class="field-hint">Можно изменить вручную, если график работы отличается от обычной пятидневной недели. Общее число дней пересчитается автоматически.</p>
        <button class="button ghost small" style="justify-self:start" :disabled="override.first == null && override.second == null" @click="$emit('reset')">Вернуть автоматический расчёт</button>
        <p class="field-hint">
          {{ calendarKnown ? 'Официальные праздники и переносы на 2026–2027 годы учтены.' : 'Для этого года учтены стандартные праздники без будущих переносов. Проверьте число рабочих дней вручную.' }}
          Источник: <a href="https://www.consultant.ru/law/ref/calendar/proizvodstvennye/" target="_blank" rel="noopener">КонсультантПлюс</a>.
        </p>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Сохранность данных</p><h2>Копия и восстановление</h2></div></div>
      <p class="card-subtitle" style="margin-bottom:16px">Скачайте копию после важных изменений. Файл можно открыть здесь же на другом устройстве.</p>
      <div class="actions-list">
        <button class="button secondary" @click="$emit('export')">Скачать копию</button><button class="button secondary" @click="$emit('import')">Восстановить из файла</button><button class="button secondary" @click="$emit('print')">Печать</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><p class="eyebrow">Как работает ссылка</p><h2>Передача изменений</h2></div></div>
      <p class="card-subtitle">{{ shared ? 'Одна и та же ссылка работает на обоих устройствах. Изменения автоматически сохраняются в общем зашифрованном хранилище и подтягиваются при открытии страницы.' : 'Изменения автоматически сохраняются на текущем устройстве. Чтобы второй человек увидел именно новую версию, нажмите «Поделиться версией» и отправьте новую ссылку. Автоматической синхронизации между устройствами нет.' }}</p>
      <p class="privacy-note">{{ shared ? 'Данные хранятся в зашифрованном виде в общем онлайн-хранилище. Ключ расшифровки находится только в семейной ссылке. Храните её как личный документ.' : 'Финансовые данные находятся в части ссылки после # и не отправляются на сервер страницы. Храните ссылку как личный документ.' }}</p>
    </div>
  </section>
</template>
