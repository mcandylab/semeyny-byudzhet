#!/bin/sh
# Moves the budget from the legacy Supabase storage into the local PocketBase:
# decrypt → import in one transaction → export back → compare with the source.
# Supabase is only read. Pass --replace to refresh an earlier transfer
# (budget records are replaced; family members and invites stay).
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PB="./pocketbase/pocketbase"
OPTS="--dir pocketbase/pb_data --migrationsDir pocketbase/pb_migrations --hooksDir pocketbase/pb_hooks"

[ -x "$PB" ] || sh scripts/pocketbase-install.sh
node --env-file=.env scripts/legacy-export.mjs
# shellcheck disable=SC2086
"$PB" migrate up $OPTS
# shellcheck disable=SC2086
"$PB" family:import pocketbase/import/legacy-import.json "$@" $OPTS
# shellcheck disable=SC2086
"$PB" family:export pocketbase/import/pocketbase-export.json $OPTS
node scripts/legacy-verify.mjs pocketbase/import/legacy-state.json pocketbase/import/pocketbase-export.json
