#!/bin/sh
# Downloads the pinned PocketBase release into pocketbase/ and verifies its checksum.
set -eu

VERSION="0.40.6"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$ROOT/pocketbase/pocketbase"

case "$(uname -s)" in
  Darwin) OS="darwin" ;;
  Linux) OS="linux" ;;
  *) echo "Unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64) ARCH="amd64" ;;
  *) echo "Unsupported CPU: $(uname -m)" >&2; exit 1 ;;
esac

if [ -x "$TARGET" ] && "$TARGET" --version | grep -q "$VERSION"; then
  echo "PocketBase $VERSION is already installed"
  exit 0
fi

ARCHIVE="pocketbase_${VERSION}_${OS}_${ARCH}.zip"
BASE="https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -o "$TMP/$ARCHIVE" "$BASE/$ARCHIVE"
curl -fsSL -o "$TMP/checksums.txt" "$BASE/checksums.txt"
EXPECTED="$(grep " $ARCHIVE\$" "$TMP/checksums.txt" | cut -d ' ' -f 1)"
ACTUAL="$(shasum -a 256 "$TMP/$ARCHIVE" | cut -d ' ' -f 1)"
if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "Checksum mismatch for $ARCHIVE" >&2
  exit 1
fi

unzip -o -q "$TMP/$ARCHIVE" pocketbase -d "$TMP/out"
mv "$TMP/out/pocketbase" "$TARGET"
chmod +x "$TARGET"
"$TARGET" --version
