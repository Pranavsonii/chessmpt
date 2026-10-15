#!/bin/sh
# Migrate (idempotent), optionally seed (idempotent), then start the API.
set -e
node dist/db/migrate.js
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/db/seed.js
fi
exec node dist/main
