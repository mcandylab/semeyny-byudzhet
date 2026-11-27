/// <reference path="../pb_data/types.d.ts" />

// Operations change envelope balances, so the app records and undoes them only
// through POST /api/family/operations and DELETE /api/family/operations/{id}
// (pb_hooks/family.pb.js), which save the operation and the balance in one
// transaction. The collection stays readable for the household.

migrate((app) => {
  const operations = app.findCollectionByNameOrId("operations");
  operations.createRule = null;
  operations.updateRule = null;
  operations.deleteRule = null;
  app.save(operations);
}, (app) => {
  const viaEnvelope = "@request.auth.id != '' && envelope.household = @request.auth.household";
  const serverFields = "@request.body.envelope_name:isset = false && @request.body.created_by:isset = false";
  const operations = app.findCollectionByNameOrId("operations");
  operations.createRule = `${viaEnvelope} && ${serverFields}`;
  operations.updateRule = `${viaEnvelope} && @request.body.envelope:isset = false && ${serverFields}`;
  operations.deleteRule = viaEnvelope;
  app.save(operations);
});
