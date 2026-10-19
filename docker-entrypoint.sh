#!/bin/sh
set -eu

# Railway volumes can mount as root, replacing the image's /app/media directory.
chown node:node /app/media

# Do not serve the site if schema migration fails. Re-running is safe: Payload
# records completed migrations in Postgres and skips them on later restarts.
su-exec node:node npm run payload -- migrate
exec su-exec node:node node server.js
