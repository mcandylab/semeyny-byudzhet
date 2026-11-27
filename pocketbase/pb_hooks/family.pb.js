/// <reference path="../pb_data/types.d.ts" />

// Server rules of the family budget that API rules alone cannot express,
// plus console commands for the master account, invites and data transfer.

// Joining the family: an invite code from the owner, a username and a password.
// Rate limited in settings (pb_migrations/1795806001_family_settings.js).
routerAdd("POST", "/api/family/join", (e) => {
  const family = require(`${__hooks}/family_lib.js`);
  const user = family.joinByInvite(e.app, e.requestInfo().body || {});
  return $apis.recordAuthResponse(e, user, "password");
}, $apis.bodyLimit(16 * 1024));

// The author, the expiry and the code (field autogeneration) of an invite come from the server.
onRecordCreateRequest((e) => {
  const family = require(`${__hooks}/family_lib.js`);
  if (!e.hasSuperuserAuth()) {
    e.record.set("created_by", e.auth ? e.auth.id : "");
    e.record.set("expires_at", new Date(Date.now() + family.INVITE_HOURS * 60 * 60 * 1000).toISOString());
  }
  e.record.set("code", "");
  e.next();
}, "invites");

// Operations move money, so they change only through these routes: the operation
// and the envelope balance are saved together (see recordOperation in family_lib.js).
// The collection itself is read-only for the app (pb_migrations/1795806002_family_operations.js).
routerAdd("POST", "/api/family/operations", (e) => {
  const family = require(`${__hooks}/family_lib.js`);
  return e.json(200, family.recordOperation(e.app, e.auth, e.requestInfo().body || {}));
}, $apis.requireAuth("users"), $apis.bodyLimit(16 * 1024));

routerAdd("DELETE", "/api/family/operations/{id}", (e) => {
  const family = require(`${__hooks}/family_lib.js`);
  return e.json(200, family.undoOperation(e.app, e.auth, e.request.pathValue("id")));
}, $apis.requireAuth("users"));

function familyCommand(use, short, run) {
  const command = new Command({ use, short, run });
  $app.rootCmd.addCommand(command);
  return command;
}

// family:owner <username> [Name] — creates the household (if needed) and its only master account.
familyCommand("family:owner", "Создать мастер-аккаунт семьи", (cmd, args) => {
  const family = require(`${__hooks}/family_lib.js`);
  try {
    const username = family.normalizeUsername(args[0]);
    if (!username) throw new Error("Укажите логин: family:owner <логин> [Имя]");
    if (family.findUser($app, username)) throw new Error(`Логин ${username} уже занят`);
    const given = $os.getenv("FAMILY_PASSWORD");
    const password = given || family.generatePassword();
    let household;
    $app.runInTransaction((txApp) => {
      household = family.singleHousehold(txApp, true);
      const owner = family.ownerOf(txApp, household);
      if (owner) throw new Error(`Мастер-аккаунт уже есть: ${owner.getString("username")}`);
      const user = new Record(txApp.findCollectionByNameOrId("users"));
      user.set("username", username);
      user.set("name", args.slice(1).join(" ").trim() || username);
      user.set("household", household.id);
      user.set("role", "owner");
      user.set("verified", true);
      user.setPassword(password);
      txApp.save(user);
    });
    console.log(`Мастер-аккаунт создан: ${username} (семья «${household.getString("name")}»)`);
    if (!given) console.log(`Пароль: ${password}\nСохраните его: он больше не будет показан. Сменить: family:password ${username}`);
  } catch (err) {
    console.error(`Ошибка: ${err.message || err}`);
    $os.exit(1);
  }
});

// family:password <username> — sets a new password and signs the account out everywhere.
familyCommand("family:password", "Задать новый пароль участнику", (cmd, args) => {
  const family = require(`${__hooks}/family_lib.js`);
  try {
    const user = family.findUser($app, args[0]);
    if (!user) throw new Error("Укажите логин существующего участника: family:password <логин>");
    const given = $os.getenv("FAMILY_PASSWORD");
    const password = given || family.generatePassword();
    user.setPassword(password);
    $app.save(user);
    console.log(`Пароль для ${user.getString("username")} обновлён, прежние входы на устройствах сброшены`);
    if (!given) console.log(`Новый пароль: ${password}`);
  } catch (err) {
    console.error(`Ошибка: ${err.message || err}`);
    $os.exit(1);
  }
});

// family:invite [hours] — prints a one-time invite code from the master account.
familyCommand("family:invite", "Создать код приглашения", (cmd, args) => {
  const family = require(`${__hooks}/family_lib.js`);
  try {
    const hours = args[0] ? Number(args[0]) : family.INVITE_HOURS;
    if (!(hours > 0 && hours <= 24 * 30)) throw new Error("Срок действия: от 1 до 720 часов");
    const household = family.singleHousehold($app, false);
    const owner = family.ownerOf($app, household);
    if (!owner) throw new Error("Сначала создайте мастер-аккаунт: family:owner <логин>");
    const invite = family.createInvite($app, household, owner, hours);
    console.log(`Код приглашения: ${family.formatCode(invite.getString("code"))}`);
    console.log(`Действует до ${invite.getString("expires_at")} (UTC), один раз`);
  } catch (err) {
    console.error(`Ошибка: ${err.message || err}`);
    $os.exit(1);
  }
});

// family:import <file> [--replace] — loads pocketbase/import/legacy-import.json in one transaction.
const importCommand = familyCommand("family:import", "Перенести бюджет из файла legacy-import.json", (cmd, args) => {
  const family = require(`${__hooks}/family_lib.js`);
  try {
    if (!args[0]) throw new Error("Укажите файл: family:import <legacy-import.json> [--replace]");
    const data = JSON.parse(toString($os.readFile(args[0])));
    const counts = family.importBudget($app, data, cmd.flags().getBool("replace"));
    console.log(`Перенесено: ${JSON.stringify(counts)}`);
  } catch (err) {
    console.error(`Ошибка: ${err.message || err}`);
    $os.exit(1);
  }
});
importCommand.flags().bool("replace", false, "заменить уже перенесённые записи бюджета (участники и приглашения сохраняются)");

// family:export [file] — writes the budget in the old app's backup format (stdout without a file).
familyCommand("family:export", "Выгрузить бюджет в формате резервной копии старого приложения", (cmd, args) => {
  const family = require(`${__hooks}/family_lib.js`);
  try {
    const json = JSON.stringify(family.exportBudget($app), null, 2);
    if (args[0]) {
      $os.writeFile(args[0], `${json}\n`, 0o600);
      console.log(`Сохранено: ${args[0]}`);
    } else {
      console.log(json);
    }
  } catch (err) {
    console.error(`Ошибка: ${err.message || err}`);
    $os.exit(1);
  }
});
