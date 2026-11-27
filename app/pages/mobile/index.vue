<script setup>
useMobileDesign("m-gallery-html", "#ebebeb");
useHead({ title: "Семейный бюджет — мобильные экраны" });

const colors = [
  { hex: "#1A1A1A", name: "Карточки и панели", text: "#fcfcfc" },
  { hex: "#723FEB", name: "Главный акцент", text: "#fcfcfc" },
  { hex: "#97E0F7", name: "Второй акцент", text: "#1a1a1a" },
  { hex: "#FCFCFC", name: "Текст и светлые карточки", text: "#1a1a1a" }
];
const extraColors = [
  { hex: "#121212", name: "Фон", text: "#fcfcfc" },
  { hex: "#34C77B", name: "Пополнение", text: "#1a1a1a" },
  { hex: "#F0DC78", name: "Внимание", text: "#1a1a1a" },
  { hex: "#FF7A6E", name: "Удаление", text: "#1a1a1a" }
];

const groups = [
  { title: "Старт и обзор", frames: [
    { title: "Вход", note: "Логин и пароль без почты или код приглашения от владельца", screen: "welcome" },
    { title: "Обзор месяца", note: "Свободный остаток, обе выплаты, конверты и последние операции", screen: "home" },
    { title: "Выбор месяца", note: "Шторка поверх обзора", screen: "home", sheet: "month" }
  ] },
  { title: "Выплаты", frames: [
    { title: "Выплата 20-го", note: "Расчёт по рабочим дням и расходы с отметкой «оплачено»", screen: "payday", payday: 20 },
    { title: "Выплата 5-го", note: "Перенос на пятницу, если 5-е число выпадает на выходной", screen: "payday", payday: 5 },
    { title: "Расход", note: "Сумма, категория, выплата и отметка об оплате", screen: "payday", sheet: "expense" }
  ] },
  { title: "Конверты", frames: [
    { title: "Конверты и история", note: "Остатки, распределение и отмена операции свайпом", screen: "envelopes" },
    { title: "Новая операция", note: "Покупка или пополнение с цифровой клавиатурой", screen: "envelopes", sheet: "operation" },
    { title: "Конверт", note: "Название, категория, остаток и архив", screen: "envelopes", sheet: "envelope" }
  ] },
  { title: "Цели", frames: [
    { title: "Цели", note: "Сколько собрано и сколько откладываем в этом месяце", screen: "goals" },
    { title: "Карточка цели", note: "Сумма на месяц, выплата, срок, закрытие цели", screen: "goals", sheet: "goal" }
  ] },
  { title: "Аналитика и настройки", frames: [
    { title: "Куда уходит зарплата", note: "Категории расходов и нагрузка на каждую выплату", screen: "analytics" },
    { title: "Настройки", note: "Зарплата, десятина, рабочие дни и резервные копии", screen: "settings" },
    { title: "Семья", note: "Участники и одноразовые коды приглашения", screen: "settings", sheet: "family" },
    { title: "Аккаунт", note: "Имя и смена пароля", screen: "settings", sheet: "account" },
    { title: "Памятка", note: "Редактируемая заметка про кредитки", screen: "home", sheet: "note" }
  ] }
];

function prototypeLink(frame) {
  const query = new URLSearchParams({ screen: frame.screen });
  if (frame.sheet) query.set("sheet", frame.sheet);
  if (frame.payday) query.set("payday", String(frame.payday));
  return `/mobile/app?${query}`;
}
</script>

<template>
  <main class="g">
    <header class="g-head">
      <div>
        <p class="g-kicker">Семейный бюджет · мобильное приложение</p>
        <h1 class="g-title"><b>Экраны</b> приложения</h1>
        <p class="g-lead">Демо-данные в памяти: суммы придуманные, ничего не сохраняется. Внутри каждого телефона можно нажимать — переключать вкладки, записывать операции, отмечать оплату. Рабочее приложение с общим бюджетом открывается в корне сайта.</p>
      </div>
      <NuxtLink to="/mobile/app" class="g-cta">Открыть прототип <span aria-hidden="true">→</span></NuxtLink>
    </header>

    <section class="g-section" aria-label="Дизайн-система">
      <div class="g-rule"><h2 class="g-pill">Типографика</h2></div>
      <div class="g-type">
        <span class="g-aa" aria-hidden="true">Aa</span>
        <div class="g-type-name"><b>Manrope</b><span>Основной шрифт</span></div>
        <div class="g-type-sample">
          <p>АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ</p>
          <p>0123456789 ₽</p>
        </div>
      </div>
      <div class="g-rule g-rule--right"><h2 class="g-pill">Цвета</h2></div>
      <div class="g-colors">
        <div v-for="color in colors" :key="color.hex" class="g-swatch">
          <span class="g-circle" :style="{ background: color.hex, color: color.text }">{{ color.hex }}</span>
          <small>{{ color.name }}</small>
        </div>
      </div>
      <div class="g-colors g-colors--small">
        <div v-for="color in extraColors" :key="color.hex" class="g-swatch">
          <span class="g-circle" :style="{ background: color.hex, color: color.text }">{{ color.hex }}</span>
          <small>{{ color.name }}</small>
        </div>
      </div>
    </section>

    <section v-for="group in groups" :key="group.title" class="g-section">
      <div class="g-rule"><h2 class="g-pill">{{ group.title }}</h2></div>
      <div class="g-row">
        <figure v-for="frame in group.frames" :key="frame.title" class="g-frame">
          <div class="g-phone"><MobileApp :signed-out="frame.screen === 'welcome'" :screen="frame.screen === 'welcome' ? 'home' : frame.screen" :sheet="frame.sheet" :payday="frame.payday" /></div>
          <figcaption>
            <b>{{ frame.title }}</b>
            <span>{{ frame.note }}</span>
            <NuxtLink :to="prototypeLink(frame)">Открыть отдельно →</NuxtLink>
          </figcaption>
        </figure>
      </div>
    </section>
  </main>
</template>

<style scoped>
.g { min-height: 100vh; padding: 64px 0 120px; color: #0e0e10; background: #ebebeb; font-family: "Manrope", -apple-system, sans-serif; }
.g-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px; max-width: 1380px; margin: 0 auto; padding: 0 48px; }
.g-kicker { margin: 0 0 14px; color: #6b6b70; font-size: 15px; font-weight: 600; }
.g-title { margin: 0; font-size: 64px; font-weight: 400; line-height: 1; letter-spacing: -2.4px; }
.g-title b { font-weight: 700; }
.g-lead { max-width: 620px; margin: 18px 0 0; color: #55555a; font-size: 17px; line-height: 1.55; }
.g-cta {
  display: inline-flex; flex: none; align-items: center; gap: 12px; min-height: 60px; padding: 0 28px; border-radius: 999px;
  color: #fff; background: #723feb; box-shadow: 0 16px 36px rgba(114, 63, 235, .3); font-size: 17px; font-weight: 700; text-decoration: none;
}
.g-section { max-width: 1480px; margin: 0 auto; }
.g-rule { display: flex; align-items: center; margin: 88px 0 48px; }
.g-rule::before, .g-rule::after { content: ""; height: 2px; background: #0e0e10; }
.g-rule::before { flex: 0 0 120px; }
.g-rule::after { flex: 1; }
.g-rule--right::before { flex: 1; }
.g-rule--right::after { flex: 0 0 240px; }
.g-pill { margin: 0; padding: 14px 36px; border-radius: 999px; color: #fff; background: #0e0e10; font-size: 28px; font-weight: 500; letter-spacing: -.4px; white-space: nowrap; }

.g-type { display: grid; grid-template-columns: auto auto 1fr; align-items: center; gap: 56px; padding: 0 120px; }
.g-aa { font-size: 180px; font-weight: 700; line-height: .9; letter-spacing: -6px; }
.g-type-name b { display: block; font-size: 52px; font-weight: 500; }
.g-type-name span { display: block; margin-top: 18px; font-size: 18px; letter-spacing: .5px; text-transform: uppercase; }
.g-type-sample p { margin: 0; font-size: 32px; font-weight: 300; line-height: 1.6; letter-spacing: -.3px; overflow-wrap: anywhere; }

.g-colors { display: flex; flex-wrap: wrap; justify-content: center; gap: 48px; padding: 0 48px; }
.g-colors--small { margin-top: 44px; gap: 40px; }
.g-swatch { display: grid; justify-items: center; gap: 16px; }
.g-circle { display: grid; place-items: center; width: 220px; height: 220px; border-radius: 50%; font-size: 28px; font-weight: 600; }
.g-colors--small .g-circle { width: 104px; height: 104px; font-size: 14px; }
.g-swatch small { color: #55555a; font-size: 15px; font-weight: 600; }

.g-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 64px 48px; padding: 0 32px; }
.g-frame { display: grid; justify-items: center; gap: 22px; width: 390px; margin: 0; }
.g-phone {
  width: 390px; height: 844px; overflow: hidden; border-radius: 56px; background: #121212; transform: translateZ(0);
  box-shadow: 0 60px 90px -40px rgba(14, 14, 16, .55), 0 24px 50px -24px rgba(14, 14, 16, .35);
}
.g-frame figcaption { display: grid; gap: 6px; text-align: center; }
.g-frame figcaption b { font-size: 19px; }
.g-frame figcaption span { color: #6b6b70; font-size: 14.5px; line-height: 1.45; }
.g-frame figcaption a { color: #723feb; font-size: 14px; font-weight: 700; text-decoration: none; }

@media (max-width: 900px) {
  .g { padding-top: 36px; }
  .g-head { flex-direction: column; align-items: flex-start; padding: 0 20px; }
  .g-title { font-size: 44px; }
  .g-type { grid-template-columns: 1fr; gap: 20px; padding: 0 24px; }
  .g-aa { font-size: 120px; }
  .g-rule { margin: 64px 0 36px; }
  .g-rule::before { flex-basis: 20px; }
  .g-rule--right::after { flex-basis: 20px; }
  .g-pill { padding: 10px 24px; font-size: 20px; }
  .g-circle { width: 140px; height: 140px; font-size: 18px; }
}
@media (max-width: 430px) {
  .g-row { padding: 0 12px; }
  .g-frame, .g-phone { width: calc(100vw - 24px); }
}
</style>
