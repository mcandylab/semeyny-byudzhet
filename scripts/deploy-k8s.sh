#!/bin/sh
# Builds the app and deploys it with PocketBase into the "money" namespace (deploy/k8s).
# The static app, pb_migrations and pb_hooks travel in the money-app ConfigMap;
# the pod restarts only when their contents change.
#
# Usage: npm run deploy:k8s            (kubectl context: k0s-home, or KUBE_CONTEXT)
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CONTEXT="${KUBE_CONTEXT:-k0s-home}"
kube() { kubectl --context "$CONTEXT" "$@"; }

npm run generate

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bundle"
cp -R .output/public "$TMP/bundle/public"
cp -R pocketbase/pb_migrations "$TMP/bundle/pb_migrations"
cp -R pocketbase/pb_hooks "$TMP/bundle/pb_hooks"
rm -f "$TMP/bundle/pb_hooks/"*.d.ts
# No macOS metadata files: PocketBase would try to load ._family.pb.js as a hook.
(cd "$TMP/bundle" && COPYFILE_DISABLE=1 tar -czf "$TMP/bundle.tgz" .)
SUM="$(cd "$TMP/bundle" && find . -type f | LC_ALL=C sort | xargs shasum -a 256 | shasum -a 256 | cut -c1-16)"
echo "Bundle $SUM, $(du -k "$TMP/bundle.tgz" | cut -f1) KB"

kube apply -f deploy/k8s/00-namespace.yaml
kube -n money create configmap money-app --from-file=bundle.tgz="$TMP/bundle.tgz" --dry-run=client -o yaml | kube apply -f -
kube apply -f deploy/k8s/
kube -n money patch statefulset pocketbase --type merge \
  -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"money.mcandylab.ru/bundle\":\"$SUM\"}}}}}"
kube -n money rollout status statefulset/pocketbase --timeout=300s
