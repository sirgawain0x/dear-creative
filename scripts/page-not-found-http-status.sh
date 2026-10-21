#!/usr/bin/env bash
# Asserts missing /posts/[slug] and /authors/[id] return real HTTP 404 (not soft 200).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-file:./data/ci-dear-creative.db}"
export LOCAL_DATABASE_URL
PORT="${PORT:-$((32000 + RANDOM % 8000))}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${LOG_FILE:-/tmp/page-not-found-http-status.log}"
BOGUS_POST_SLUG="${BOGUS_POST_SLUG:-bogus-slug-notfound-check}"
BOGUS_AUTHOR_ID="${BOGUS_AUTHOR_ID:-author-does-not-exist-404}"

npm run db:migrate:local >/dev/null

if [[ ! -d .next ]]; then
  npx next build
fi

SERVER_PID=""
cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

: >"${LOG_FILE}"
NEXT_PUBLIC_SITE_URL="${BASE_URL}" npm run start -- -p "${PORT}" >>"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 45); do
  if grep -q "Ready in" "${LOG_FILE}" 2>/dev/null; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/" 2>/dev/null || true)"
    if [[ "${code}" =~ ^[0-9]+$ ]] && [[ "${code}" -ge 200 ]] && [[ "${code}" -lt 600 ]]; then
      ready=1
      break
    fi
  fi
  sleep 2
done
if [[ "${ready}" -ne 1 ]]; then
  echo "next start did not become ready on port ${PORT}" >&2
  tail -50 "${LOG_FILE}" >&2 || true
  exit 1
fi

echo "--- curl -I (missing post slug) ---"
curl -I -s "${BASE_URL}/posts/${BOGUS_POST_SLUG}" | head -n 1
POST_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/posts/${BOGUS_POST_SLUG}")"

echo "--- curl -I (/authors with flag off) ---"
curl -I -s "${BASE_URL}/authors/${BOGUS_AUTHOR_ID}" | head -n 1
AUTHOR_FLAG_OFF_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/authors/${BOGUS_AUTHOR_ID}")"

kill "${SERVER_PID}" 2>/dev/null || true
wait "${SERVER_PID}" 2>/dev/null || true
SERVER_PID=""
sleep 2

PORT=$((PORT + 1))
BASE_URL="http://127.0.0.1:${PORT}"
: >"${LOG_FILE}"
AUTHOR_PROFILES_ENABLED=true NEXT_PUBLIC_SITE_URL="${BASE_URL}" npm run start -- -p "${PORT}" >>"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 45); do
  if grep -q "Ready in" "${LOG_FILE}" 2>/dev/null; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/" 2>/dev/null || true)"
    if [[ "${code}" =~ ^[0-9]+$ ]] && [[ "${code}" -ge 200 ]] && [[ "${code}" -lt 600 ]]; then
      ready=1
      break
    fi
  fi
  sleep 2
done
if [[ "${ready}" -ne 1 ]]; then
  echo "next start (flag on) did not become ready" >&2
  exit 1
fi

echo "--- curl -I (/authors missing record, flag on) ---"
curl -I -s "${BASE_URL}/authors/${BOGUS_AUTHOR_ID}" | head -n 1
AUTHOR_FLAG_ON_CODE="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/authors/${BOGUS_AUTHOR_ID}")"

echo "POST ${POST_CODE} AUTHOR_FLAG_OFF ${AUTHOR_FLAG_OFF_CODE} AUTHOR_FLAG_ON ${AUTHOR_FLAG_ON_CODE}"

if [[ "${POST_CODE}" != "404" ]]; then
  echo "Expected HTTP 404 for missing post slug, got ${POST_CODE}" >&2
  exit 1
fi
if [[ "${AUTHOR_FLAG_OFF_CODE}" != "404" ]]; then
  echo "Expected HTTP 404 for /authors when flag off, got ${AUTHOR_FLAG_OFF_CODE}" >&2
  exit 1
fi
if [[ "${AUTHOR_FLAG_ON_CODE}" != "404" ]]; then
  echo "Expected HTTP 404 for missing author when flag on, got ${AUTHOR_FLAG_ON_CODE}" >&2
  exit 1
fi

echo "ok: page routes return HTTP 404"
