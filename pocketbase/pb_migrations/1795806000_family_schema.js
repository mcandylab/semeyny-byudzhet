/// <reference path="../pb_data/types.d.ts" />

// Normalized schema of the family budget.
//
//   households ─┬─< users (role: owner | member)
//               ├─< invites
//               ├─< expenses ──< expense_payments (one row per paid month)
//               ├─< envelopes ──< operations (purchases and deposits)
//               ├─< goals
//               └─< workday_overrides (one row per month)
//   categories ─┬─< expenses
//               └─< envelopes
//
// Every budget record belongs to exactly one household, and the API rules only
// let a signed-in user reach records of their own household.

migrate((app) => {
  const MONTH = "^\\d{4}-(0[1-9]|1[0-2])$";
  const PAYDAYS = ["5", "20"];
  const signedIn = "@request.auth.id != ''";
  const sameHousehold = `${signedIn} && household = @request.auth.household`;
  const keepHousehold = `${sameHousehold} && (@request.body.household:isset = false || @request.body.household = @request.auth.household)`;
  const timestamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true }
  ];
  const householdRules = { listRule: sameHousehold, viewRule: sameHousehold, createRule: sameHousehold, updateRule: keepHousehold, deleteRule: sameHousehold };

  const households = new Collection({
    type: "base",
    name: "households",
    fields: [
      { name: "name", type: "text", required: true, max: 120 },
      { name: "salary", type: "number", min: 0 },
      { name: "tithe_rate", type: "number", min: 0, max: 100 },
      { name: "credit_note", type: "text", max: 10000 },
      ...timestamps
    ]
  });
  app.save(households);

  // Sign-in by username and password only: no email, no OTP, no OAuth, no mail alerts.
  const users = app.findCollectionByNameOrId("users");
  users.fields.removeByName("avatar");
  users.fields.getByName("email").required = false;
  users.fields.add(new TextField({ name: "username", required: true, min: 3, max: 32, pattern: "^[a-z0-9][a-z0-9._-]*$" }));
  users.fields.add(new RelationField({ name: "household", required: true, collectionId: households.id, maxSelect: 1, cascadeDelete: false }));
  users.fields.add(new SelectField({ name: "role", required: true, maxSelect: 1, values: ["owner", "member"] }));
  users.addIndex("idx_users_username", true, "`username`", "");
  users.addIndex("idx_users_household", false, "`household`", "");
  users.passwordAuth.enabled = true;
  users.passwordAuth.identityFields = ["username"];
  users.authAlert.enabled = false;
  users.otp.enabled = false;
  users.mfa.enabled = false;
  users.oauth2.enabled = false;
  users.authToken.duration = 30 * 24 * 60 * 60;
  users.listRule = sameHousehold;
  users.viewRule = sameHousehold;
  // New accounts appear only through POST /api/family/join or the family:owner command.
  users.createRule = null;
  users.updateRule = "id = @request.auth.id && @request.body.household:isset = false && @request.body.role:isset = false";
  users.deleteRule = `${sameHousehold} && @request.auth.role = 'owner' && role = 'member'`;
  users.manageRule = null;
  app.save(users);

  const ownerOnly = `${sameHousehold} && @request.auth.role = 'owner'`;
  const invites = new Collection({
    type: "base",
    name: "invites",
    listRule: ownerOnly,
    viewRule: ownerOnly,
    // The code, author and expiry are set by the server (pb_hooks/family.pb.js).
    createRule: `${ownerOnly} && @request.body.code:isset = false && @request.body.created_by:isset = false && @request.body.expires_at:isset = false && @request.body.used_by:isset = false && @request.body.used_at:isset = false`,
    updateRule: null,
    deleteRule: ownerOnly,
    fields: [
      { name: "household", type: "relation", required: true, collectionId: households.id, maxSelect: 1, cascadeDelete: true },
      { name: "code", type: "text", required: true, min: 8, max: 8, pattern: "^[A-Z0-9]+$", autogeneratePattern: "[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}" },
      { name: "created_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "expires_at", type: "date", required: true },
      { name: "used_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      { name: "used_at", type: "date" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false }
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_invites_code` ON `invites` (`code`)",
      "CREATE INDEX `idx_invites_household` ON `invites` (`household`)"
    ]
  });
  app.save(invites);
  households.listRule = `${signedIn} && id = @request.auth.household`;
  households.viewRule = households.listRule;
  households.updateRule = households.listRule;
  households.createRule = null;
  households.deleteRule = null;
  app.save(households);

  const categories = new Collection({
    type: "base",
    name: "categories",
    listRule: signedIn,
    viewRule: signedIn,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "code", type: "text", required: true, max: 32, pattern: "^[a-z_]+$" },
      { name: "name", type: "text", required: true, max: 80 },
      { name: "position", type: "number", onlyInt: true, min: 0 }
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_categories_code` ON `categories` (`code`)"]
  });
  app.save(categories);
  [
    ["housing", "Жильё и связь"],
    ["bank", "Банки и переводы"],
    ["auto", "Автомобиль"],
    ["personal", "Личное и подписки"],
    ["food", "Продукты и дом"],
    ["family", "Семья"],
    ["pets", "Питомцы"],
    ["obligations", "Обязательное"],
    ["plans", "Планы и покупки"],
    ["other", "Другое"]
  ].forEach(([code, name], position) => {
    const record = new Record(categories);
    record.set("code", code);
    record.set("name", name);
    record.set("position", position);
    app.save(record);
  });

  const householdField = { name: "household", type: "relation", required: true, collectionId: households.id, maxSelect: 1, cascadeDelete: true };
  const categoryField = { name: "category", type: "relation", required: true, collectionId: categories.id, maxSelect: 1, cascadeDelete: false };
  const positionField = { name: "position", type: "number", onlyInt: true, min: 0 };

  // Regular payments planned from a payday: 20th covers days 1–15, 5th covers 16–end of month.
  const expenses = new Collection({
    type: "base",
    name: "expenses",
    ...householdRules,
    fields: [
      householdField,
      categoryField,
      { name: "name", type: "text", required: true, max: 200 },
      { name: "amount", type: "number", min: 0 },
      { name: "payday", type: "select", required: true, maxSelect: 1, values: PAYDAYS },
      positionField,
      ...timestamps
    ],
    indexes: ["CREATE INDEX `idx_expenses_household` ON `expenses` (`household`, `position`)"]
  });
  app.save(expenses);

  const viaExpense = `${signedIn} && expense.household = @request.auth.household`;
  const expensePayments = new Collection({
    type: "base",
    name: "expense_payments",
    listRule: viaExpense,
    viewRule: viaExpense,
    createRule: viaExpense,
    updateRule: null,
    deleteRule: viaExpense,
    fields: [
      { name: "expense", type: "relation", required: true, collectionId: expenses.id, maxSelect: 1, cascadeDelete: true },
      { name: "month", type: "text", required: true, pattern: MONTH },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false }
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_expense_payments_month` ON `expense_payments` (`expense`, `month`)"]
  });
  app.save(expensePayments);

  // Envelopes are archived instead of deleted, so their operations keep a valid reference.
  const envelopes = new Collection({
    type: "base",
    name: "envelopes",
    ...householdRules,
    fields: [
      householdField,
      categoryField,
      { name: "name", type: "text", required: true, max: 120 },
      { name: "balance", type: "number", min: 0 },
      { name: "archived", type: "bool" },
      positionField,
      ...timestamps
    ],
    indexes: ["CREATE INDEX `idx_envelopes_household` ON `envelopes` (`household`, `archived`, `position`)"]
  });
  app.save(envelopes);

  const viaEnvelope = `${signedIn} && envelope.household = @request.auth.household`;
  const serverFields = "@request.body.envelope_name:isset = false && @request.body.created_by:isset = false";
  const operations = new Collection({
    type: "base",
    name: "operations",
    listRule: viaEnvelope,
    viewRule: viaEnvelope,
    createRule: `${viaEnvelope} && ${serverFields}`,
    updateRule: `${viaEnvelope} && @request.body.envelope:isset = false && ${serverFields}`,
    deleteRule: viaEnvelope,
    fields: [
      // Required and not cascading: an envelope with operations cannot be deleted, only archived.
      { name: "envelope", type: "relation", required: true, collectionId: envelopes.id, maxSelect: 1, cascadeDelete: false },
      // Envelope name at the moment of the operation; envelopes can be renamed later.
      { name: "envelope_name", type: "text", required: true, max: 120 },
      { name: "type", type: "select", required: true, maxSelect: 1, values: ["purchase", "deposit"] },
      { name: "name", type: "text", required: true, max: 200 },
      { name: "amount", type: "number", min: 0 },
      { name: "days", type: "number", onlyInt: true, min: 0 },
      // Calendar date of the operation, stored as midnight UTC.
      { name: "date", type: "date", required: true },
      { name: "created_by", type: "relation", collectionId: users.id, maxSelect: 1, cascadeDelete: false },
      ...timestamps
    ],
    indexes: ["CREATE INDEX `idx_operations_envelope_date` ON `operations` (`envelope`, `date`)"]
  });
  app.save(operations);

  const goals = new Collection({
    type: "base",
    name: "goals",
    ...householdRules,
    fields: [
      householdField,
      { name: "name", type: "text", required: true, max: 200 },
      { name: "target", type: "number", min: 0 },
      { name: "saved", type: "number", min: 0 },
      { name: "planned", type: "number", min: 0 },
      { name: "due_date", type: "date" },
      // Empty means the planned amount is not tied to a payday yet.
      { name: "payday", type: "select", maxSelect: 1, values: PAYDAYS },
      { name: "closed", type: "bool" },
      positionField,
      ...timestamps
    ],
    indexes: ["CREATE INDEX `idx_goals_household` ON `goals` (`household`, `closed`, `position`)"]
  });
  app.save(goals);

  // Manual workday counts for a month; months without a row use the production calendar.
  const workdayOverrides = new Collection({
    type: "base",
    name: "workday_overrides",
    ...householdRules,
    fields: [
      householdField,
      { name: "month", type: "text", required: true, pattern: MONTH },
      { name: "first_days", type: "number", onlyInt: true, min: 0, max: 15 },
      { name: "second_days", type: "number", onlyInt: true, min: 0, max: 16 },
      ...timestamps
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_workday_overrides_month` ON `workday_overrides` (`household`, `month`)"]
  });
  app.save(workdayOverrides);
}, (app) => {
  ["workday_overrides", "goals", "operations", "envelopes", "expense_payments", "expenses", "categories", "invites"].forEach((name) => {
    app.delete(app.findCollectionByNameOrId(name));
  });

  const users = app.findCollectionByNameOrId("users");
  users.removeIndex("idx_users_username");
  users.removeIndex("idx_users_household");
  ["username", "household", "role"].forEach((name) => users.fields.removeByName(name));
  users.fields.add(new FileField({ name: "avatar", maxSelect: 1, maxSize: 0, mimeTypes: ["image/jpeg", "image/png", "image/svg+xml", "image/gif", "image/webp"] }));
  users.fields.getByName("email").required = true;
  users.passwordAuth.identityFields = ["email"];
  users.authAlert.enabled = true;
  users.authToken.duration = 432000;
  users.listRule = "id = @request.auth.id";
  users.viewRule = "id = @request.auth.id";
  users.createRule = "";
  users.updateRule = "id = @request.auth.id";
  users.deleteRule = "id = @request.auth.id";
  app.save(users);

  app.delete(app.findCollectionByNameOrId("households"));
});
