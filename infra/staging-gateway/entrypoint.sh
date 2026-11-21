#!/bin/sh
set -eu

# Do not start a partially configured or accidentally public gateway.
: "${PUBLIC_HOST:?PUBLIC_HOST is required}"
: "${GATE_USER_ONE:?GATE_USER_ONE is required}"
: "${GATE_USER_TWO:?GATE_USER_TWO is required}"
: "${GATE_HASH_ONE:?GATE_HASH_ONE is required}"
: "${GATE_HASH_TWO:?GATE_HASH_TWO is required}"

fail() { printf '%s\n' 'Invalid staging gateway configuration.' >&2; exit 1; }
printf '%s' "$PUBLIC_HOST" | grep -Eq '^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$' || fail
for user in "$GATE_USER_ONE" "$GATE_USER_TWO"; do
  case "$user" in ''|*[!a-zA-Z0-9_-]*) fail ;; esac
  [ "${#user}" -le 64 ] || fail
done
[ "$GATE_USER_ONE" != "$GATE_USER_TWO" ] || fail
for hash in "$GATE_HASH_ONE" "$GATE_HASH_TWO"; do
  # bcrypt costs 10–16; fixed length also prevents Caddyfile interpolation injection.
  printf '%s' "$hash" | grep -Eq '^\$2[aby]\$1[0-6]\$[./A-Za-z0-9]{53}$' || fail
done
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
