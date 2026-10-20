#!/usr/bin/env bash
# Deploy Kokoro TTS to Cloud Run (CPU, min-instances=0). Requires gcloud auth — not run in CI.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=adam-gcp-lib.sh
source "${ROOT}/scripts/gcp/adam-gcp-lib.sh"

KOKORO_DEPLOY_IMAGE_ARG=""
KOKORO_SERVICE="${KOKORO_CLOUD_RUN_SERVICE:-dear-creative-kokoro-tts}"
KOKORO_TOKEN_SECRET="${KOKORO_SECRET_TTS_TOKEN:-dear-creative-kokoro-tts-token}"
KOKORO_CPU="${KOKORO_CPU:-2}"
KOKORO_MEMORY="${KOKORO_MEMORY:-2Gi}"
KOKORO_TIMEOUT="${KOKORO_REQUEST_TIMEOUT:-300}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)
      ADAM_GCP_PROJECT_ARG="${2:?}"
      shift 2
      ;;
    --project=*)
      ADAM_GCP_PROJECT_ARG="${1#*=}"
      shift
      ;;
    --image)
      KOKORO_DEPLOY_IMAGE_ARG="${2:?}"
      shift 2
      ;;
    --image=*)
      KOKORO_DEPLOY_IMAGE_ARG="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

adam_gcp_source_env "${ROOT}"
adam_gcp_require_project

if [[ -z "${KOKORO_DEPLOY_IMAGE_ARG}" ]]; then
  echo "Error: pass --image <region>-docker.pkg.dev/<project>/dear-creative/kokoro-tts:<tag>" >&2
  exit 1
fi

PROJECT="${GCP_PROJECT_ID}"
REGION="${GCP_REGION}"
SA_ID="${KOKORO_RUNTIME_SA:-dear-creative-kokoro-run}"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"

gcloud config set project "${PROJECT}" >/dev/null

if ! gcloud iam service-accounts describe "${SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_ID}" \
    --display-name="Dear Creative Kokoro TTS runtime"
fi

gcloud run deploy "${KOKORO_SERVICE}" \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --image "${KOKORO_DEPLOY_IMAGE_ARG}" \
  --platform managed \
  --service-account "${SA_EMAIL}" \
  --no-allow-unauthenticated \
  --cpu "${KOKORO_CPU}" \
  --memory "${KOKORO_MEMORY}" \
  --timeout "${KOKORO_TIMEOUT}" \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-secrets="KOKORO_TTS_TOKEN=${KOKORO_TOKEN_SECRET}:latest" \
  --set-env-vars="KOKORO_DEFAULT_VOICE=af_heart,KOKORO_LANG_CODE=a"

echo "Deployed ${KOKORO_SERVICE} in ${REGION}. Set KOKORO_TTS_BASE_URL to the service URL on Dear Creative."
