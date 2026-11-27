#!/bin/sh
# Replaces the database of the PocketBase pod with a local pb_data folder.
# PocketBase must be stopped on both sides: the pod is scaled to zero here,
# and the local copy must not be running, or its SQLite files may be torn.
#
# Usage: sh scripts/k8s-restore-data.sh pocketbase/pb_data     (KUBE_CONTEXT, default k0s-home)
set -eu

SRC="${1:?Usage: k8s-restore-data.sh <pb_data folder>}"
[ -f "$SRC/data.db" ] || { echo "$SRC has no data.db" >&2; exit 1; }
CONTEXT="${KUBE_CONTEXT:-k0s-home}"
kube() { kubectl --context "$CONTEXT" -n money "$@"; }

kube scale statefulset pocketbase --replicas=0
kube wait --for=delete pod/pocketbase-0 --timeout=120s 2>/dev/null || true

# A helper pod mounts the same volume (local-path pins it to the right node).
kube apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pocketbase-restore
  namespace: money
spec:
  restartPolicy: Never
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: restore
      image: alpine:3.22
      command: ["sleep", "3600"]
      securityContext:
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
      volumeMounts:
        - name: data
          mountPath: /pb
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-pocketbase-0
EOF
kube wait --for=condition=Ready pod/pocketbase-restore --timeout=180s

(cd "$SRC" && COPYFILE_DISABLE=1 tar -czf - .) | kube exec -i pocketbase-restore -- sh -c '
  set -eu
  rm -rf /pb/data.new /pb/data.old
  mkdir /pb/data.new
  tar xzf - -C /pb/data.new
  [ -d /pb/data ] && mv /pb/data /pb/data.old
  mv /pb/data.new /pb/data
  rm -rf /pb/data.old
  ls -la /pb/data'

kube delete pod pocketbase-restore --wait=true
kube scale statefulset pocketbase --replicas=1
kube rollout status statefulset/pocketbase --timeout=300s
