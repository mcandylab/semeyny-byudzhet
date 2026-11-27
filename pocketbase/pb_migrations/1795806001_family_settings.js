/// <reference path="../pb_data/types.d.ts" />

// App settings for the family budget: batch requests for atomic multi-record
// changes, and rate limits that also cover joining by invite code.

migrate((app) => {
  const settings = app.settings();
  settings.meta.appName = "Семейный бюджет";
  settings.batch.enabled = true;
  settings.batch.maxRequests = 50;
  settings.batch.timeout = 3;
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules = [
    ...settings.rateLimits.rules.filter((rule) => rule.label !== "POST /api/family/join"),
    { label: "POST /api/family/join", audience: "", duration: 60, maxRequests: 5 }
  ];
  app.save(settings);
}, (app) => {
  const settings = app.settings();
  settings.batch.enabled = false;
  settings.rateLimits.enabled = false;
  settings.rateLimits.rules = settings.rateLimits.rules.filter((rule) => rule.label !== "POST /api/family/join");
  app.save(settings);
});
