#!/bin/sh
# Refreshes the budget in the cluster from the legacy Supabase storage, the same
# way legacy-migrate.sh does locally: decrypt → import with --replace → export
# back → compare with the source. Family members and invites stay.
#
# Usage: npm run legacy:sync:k8s      (KUBE_CONTEXT, default k0s-home)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CONTEXT="${KUBE_CONTEXT:-k0s-home}"
kube() { kubectl --context "$CONTEXT" -n money "$@"; }
pb() { kube exec pocketbase-0 -c pocketbase -- /app/bin/pocketbase "$@" --dir /pb/data --migrationsDir /app/pb_migrations --hooksDir /app/pb_hooks --automigrate=false; }

node --env-file=.env scripts/legacy-export.mjs
kube exec -i pocketbase-0 -c pocketbase -- sh -c 'umask 077 && cat > /tmp/legacy-import.json' < pocketbase/import/legacy-import.json
pb family:import /tmp/legacy-import.json --replace
pb family:export /tmp/pocketbase-export.json
kube exec pocketbase-0 -c pocketbase -- cat /tmp/pocketbase-export.json > pocketbase/import/pocketbase-export.json
kube exec pocketbase-0 -c pocketbase -- rm -f /tmp/legacy-import.json /tmp/pocketbase-export.json
chmod 600 pocketbase/import/pocketbase-export.json
node scripts/legacy-verify.mjs pocketbase/import/legacy-state.json pocketbase/import/pocketbase-export.json
