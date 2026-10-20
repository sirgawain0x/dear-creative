#!/usr/bin/env bash
# Idempotent Kokoro TTS deploy for Cloud Shell (Bearer-only auth on a public Cloud Run URL).
# Requires gcloud auth — not run by agents or CI deploy.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

KOKORO_DEPLOY_IMAGE_ARG=""
KOKORO_SKIP_BUILD=false
KOKORO_SERVICE="${KOKORO_CLOUD_RUN_SERVICE:-dear-creative-kokoro-tts}"
KOKORO_TOKEN_SECRET="${KOKORO_SECRET_TTS_TOKEN:-dear-creative-kokoro-tts-token}"
KOKORO_CPU="${KOKORO_CPU:-2}"
KOKORO_MEMORY="${KOKORO_MEMORY:-2Gi}"
KOKORO_TIMEOUT="${KOKORO_REQUEST_TIMEOUT:-300}"
KOKORO_AR_REPO="${KOKORO_ARTIFACT_REPO:-dear-creative}"
KOKORO_IMAGE_NAME="${KOKORO_IMAGE_NAME:-kokoro-tts}"
KOKORO_IMAGE_TAG="${KOKORO_IMAGE_TAG:-latest}"

ADAM_GCP_PROJECT_ARG=""

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
    --skip-build)
      KOKORO_SKIP_BUILD=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -f "${ROOT}/scripts/gcp/adam-gcp.env" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT}/scripts/gcp/adam-gcp.env"
fi

PROJECT="${ADAM_GCP_PROJECT_ARG:-${GCP_PROJECT_ID:-creative-ai-491118}}"
REGION="${GCP_REGION:-us-east4}"

if [[ -z "${PROJECT}" ]]; then
  echo "Error: set GCP_PROJECT_ID or pass --project <id>." >&2
  exit 1
fi

export GCP_PROJECT_ID="${PROJECT}"
export GCP_REGION="${REGION}"

SA_ID="${KOKORO_RUNTIME_SA:-dear-creative-kokoro-run}"
SA_EMAIL="${SA_ID}@${PROJECT}.iam.gserviceaccount.com"
AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_URI="${AR_HOST}/${PROJECT}/${KOKORO_AR_REPO}/${KOKORO_IMAGE_NAME}:${KOKORO_IMAGE_TAG}"

gcloud config set project "${PROJECT}" >/dev/null

echo "Enabling required APIs (idempotent)…"
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project "${PROJECT}"

echo "Ensuring Artifact Registry repository ${KOKORO_AR_REPO}…"
if ! gcloud artifacts repositories describe "${KOKORO_AR_REPO}" \
  --location="${REGION}" \
  --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${KOKORO_AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT}" \
    --description="Dear Creative container images"
fi

if ! gcloud iam service-accounts describe "${SA_EMAIL}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SA_ID}" \
    --project="${PROJECT}" \
    --display-name="Dear Creative Kokoro TTS runtime"
fi

if ! gcloud secrets describe "${KOKORO_TOKEN_SECRET}" --project="${PROJECT}" >/dev/null 2>&1; then
  echo "Creating Secret Manager secret ${KOKORO_TOKEN_SECRET} (value not printed)…"
  openssl rand -hex 32 | gcloud secrets create "${KOKORO_TOKEN_SECRET}" \
    --project="${PROJECT}" \
    --data-file=-
else
  echo "Secret ${KOKORO_TOKEN_SECRET} already exists (skipping create)."
fi

echo "Granting secretAccessor on ${KOKORO_TOKEN_SECRET} to ${SA_EMAIL}…"
gcloud secrets add-iam-policy-binding "${KOKORO_TOKEN_SECRET}" \
  --project="${PROJECT}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet >/dev/null

DEPLOY_IMAGE="${KOKORO_DEPLOY_IMAGE_ARG}"
if [[ -z "${DEPLOY_IMAGE}" ]]; then
  if [[ "${KOKORO_SKIP_BUILD}" == true ]]; then
    DEPLOY_IMAGE="${IMAGE_URI}"
  else
    echo "Building and pushing ${IMAGE_URI} via Cloud Build…"
    gcloud builds submit "${ROOT}/services/kokoro-tts" \
      --project="${PROJECT}" \
      --tag "${IMAGE_URI}"
    DEPLOY_IMAGE="${IMAGE_URI}"
  fi
fi

echo "Deploying Cloud Run service ${KOKORO_SERVICE}…"
gcloud run deploy "${KOKORO_SERVICE}" \
  --project "${PROJECT}" \
  --region "${REGION}" \
  --image "${DEPLOY_IMAGE}" \
  --platform managed \
  --service-account "${SA_EMAIL}" \
  --allow-unauthenticated \
  --cpu "${KOKORO_CPU}" \
  --memory "${KOKORO_MEMORY}" \
  --timeout "${KOKORO_TIMEOUT}" \
  --concurrency 1 \
  --min-instances 0 \
  --max-instances 2 \
  --set-secrets="KOKORO_TTS_TOKEN=${KOKORO_TOKEN_SECRET}:latest" \
  --set-env-vars="KOKORO_DEFAULT_VOICE=af_heart,KOKORO_LANG_CODE=a"

SERVICE_URL="$(
  gcloud run services describe "${KOKORO_SERVICE}" \
    --project "${PROJECT}" \
    --region "${REGION}" \
    --format='value(status.url)'
)"

echo ""
echo "Kokoro TTS service URL:"
echo "${SERVICE_URL}"
echo ""
echo "Set on Vercel: KOKORO_TTS_BASE_URL=${SERVICE_URL}"
echo "Set on Vercel: KOKORO_TTS_TOKEN=<same as Secret Manager ${KOKORO_TOKEN_SECRET}>"
echo ""

echo "Post-deploy auth check (expect HTTP 401 without Bearer token)…"
HTTP_CODE="$(
  curl -sS -o /dev/null -w "%{http_code}" \
    -X POST "${SERVICE_URL}/v1/synthesize" \
    -H "Content-Type: application/json" \
    -d '{"text":"auth probe","voice":"af_heart","format":"mp3"}'
)"
if [[ "${HTTP_CODE}" != "401" ]]; then
  echo "Error: expected 401 from unauthenticated synthesize, got ${HTTP_CODE}" >&2
  exit 1
fi
echo "OK: unauthenticated POST /v1/synthesize returned 401."
