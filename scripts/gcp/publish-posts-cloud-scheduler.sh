#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=adam-gcp-lib.sh
source "${ROOT}/scripts/gcp/adam-gcp-lib.sh"
adam_gcp_parse_args "$@"
adam_gcp_source_env "${ROOT}"
adam_gcp_require_project

JOB_NAME="${ADAM_PUBLISH_SCHEDULER_JOB_NAME:-dear-creative-publish-posts}"
BASE_URL="${DEAR_CREATIVE_API_BASE_URL:?DEAR_CREATIVE_API_BASE_URL must be set}"
API_TOKEN="${ADAM_API_TOKEN:?ADAM_API_TOKEN must be set}"
JOB_FLAGS=(
  --project="${GCP_PROJECT_ID}"
  --location="${GCP_REGION}"
  --schedule="* * * * *"
  --time-zone="Etc/UTC"
  --uri="${BASE_URL%/}/api/cron/publish-scheduled-posts"
  --http-method=GET
)

if gcloud scheduler jobs describe "${JOB_NAME}" --project="${GCP_PROJECT_ID}" --location="${GCP_REGION}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${JOB_NAME}" "${JOB_FLAGS[@]}" \
    --update-headers="Authorization=Bearer ${API_TOKEN}"
else
  gcloud scheduler jobs create http "${JOB_NAME}" "${JOB_FLAGS[@]}" \
    --headers="Authorization=Bearer ${API_TOKEN}"
fi
