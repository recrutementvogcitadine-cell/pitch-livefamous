#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=yyy bash scripts/setup-vercel-env.sh
# This script reads .env.local in the repo root and creates matching env vars in Vercel
# for both preview and production targets. It requires a Vercel personal token and
# the Vercel project id (you can get it from the Vercel dashboard or via the Vercel API).

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "VERCEL_TOKEN environment variable is required"
  exit 2
fi
if [ -z "${VERCEL_PROJECT_ID:-}" ]; then
  echo "VERCEL_PROJECT_ID environment variable is required"
  exit 2
fi

if [ ! -f "$ENV_FILE" ]; then
  echo ".env.local not found in project root ($ENV_FILE)"
  exit 2
fi

echo "Reading $ENV_FILE"

set -o allexport
source "$ENV_FILE"
set +o allexport

create_env() {
  key="$1"
  val="$2"
  echo "Creating env: $key"
  curl -s -X POST "https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env" \
    -H "Authorization: Bearer ${VERCEL_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"${key}\", \"value\": \"${val}\", \"target\": [\"preview\",\"production\"], \"type\": \"encrypted\" }" \
    | jq .
}

# List of env vars we'll add if defined in .env.local
declare -a KEYS=(
  "AGORA_APP_ID"
  "AGORA_APP_CERT"
  "AGORA_TOKEN_SECRET"
  "NEXT_PUBLIC_AGORA_APP_ID"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE"
)

for k in "${KEYS[@]}"; do
  v="${!k:-}"
  if [ -n "$v" ]; then
    create_env "$k" "$v"
  else
    echo "Skipping $k (not set in .env.local)"
  fi
done

echo "Done. Visit your Vercel dashboard to confirm environment variables and trigger a deployment."
