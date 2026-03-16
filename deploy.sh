#!/bin/bash
# ============================================================
# Fase 5 — Deploy Urban Intelligence Platform a Cloud Run
# Ejecutar desde la raíz del proyecto en Google Cloud Shell
# o con gcloud CLI instalado y autenticado
# ============================================================

set -e  # salir si hay error

PROJECT_ID="urban-intelligence-platform"
REGION="us-central1"
BUCKET="urban-intelligence-lulc"

echo "============================================"
echo " Urban Intelligence Platform — Deploy Fase 5"
echo "============================================"
echo "Proyecto: $PROJECT_ID"
echo "Región:   $REGION"
echo ""

# ── PASO 1: Configurar proyecto ──────────────────────────────
echo "[1/7] Configurando proyecto GCP..."
gcloud config set project $PROJECT_ID

# ── PASO 2: Habilitar APIs necesarias ───────────────────────
echo "[2/7] Habilitando APIs de GCP..."
gcloud services enable \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com \
    containerregistry.googleapis.com \
    --quiet

# ── PASO 3: Guardar secretos en Secret Manager ───────────────
echo "[3/7] Guardando secretos..."
echo ""
echo ">> Introduce tu ANTHROPIC_API_KEY:"
read -s ANTHROPIC_KEY
echo $ANTHROPIC_KEY | gcloud secrets create ANTHROPIC_API_KEY \
    --data-file=- \
    --replication-policy=automatic 2>/dev/null || \
echo $ANTHROPIC_KEY | gcloud secrets versions add ANTHROPIC_API_KEY --data-file=-

echo ""
echo ">> Introduce tu SENTINEL_HUB_API_KEY:"
read -s SENTINEL_KEY
echo $SENTINEL_KEY | gcloud secrets create SENTINEL_HUB_API_KEY \
    --data-file=- \
    --replication-policy=automatic 2>/dev/null || \
echo $SENTINEL_KEY | gcloud secrets versions add SENTINEL_HUB_API_KEY --data-file=-
read -s MAPBOX_TOKEN
echo $MAPBOX_TOKEN | gcloud secrets create VITE_MAPBOX_TOKEN \
    --data-file=- \
    --replication-policy=automatic 2>/dev/null || \
echo $MAPBOX_TOKEN | gcloud secrets versions add VITE_MAPBOX_TOKEN --data-file=-

# ── PASO 4: Permisos de Cloud Build ─────────────────────────
echo "[4/7] Configurando permisos..."
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/storage.objectViewer" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/secretmanager.secretAccessor" --quiet

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/iam.serviceAccountUser" --quiet

# ── PASO 5: Permisos del backend para leer GCS ──────────────
echo "[5/7] Permisos del backend para GCS..."
RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gsutil iam ch "serviceAccount:${RUN_SA}:roles/storage.objectViewer" \
    gs://$BUCKET

# ── PASO 6: Copiar archivos de fase 5 ───────────────────────
echo "[6/7] Copiando archivos de deployment..."
cp src/phase3/inference_gcs.py  src/phase3/inference_gcs.py  2>/dev/null || true

# ── PASO 7: Lanzar Cloud Build ───────────────────────────────
echo "[7/7] Lanzando Cloud Build..."
gcloud builds submit \
    --config=cloudbuild.yaml \
    --timeout=3600s \
    .

echo ""
echo "============================================"
echo " ✅ Deploy completado"
echo "============================================"
echo ""
echo "URLs de los servicios:"
gcloud run services describe urban-intelligence-backend \
    --region=$REGION \
    --format='value(status.url)' | xargs -I{} echo "  Backend:  {}"
gcloud run services describe urban-intelligence-frontend \
    --region=$REGION \
    --format='value(status.url)' | xargs -I{} echo "  Frontend: {}"
