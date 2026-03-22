"""
API Fase 5 — Urban Intelligence Platform
Extiende la API de Fase 3 (10 ciudades) agregando:
  - POST /analyze-location  → análisis de cualquier ubicación via Sentinel Hub
  - GET  /sentinel/status   → estado del servicio Sentinel Hub

Ejecución:
    uvicorn src.phase5.api:app --reload --port 8000

Todos los endpoints de Fase 3 siguen disponibles.
"""
import os
import io
import numpy as np
from fastapi import HTTPException

# ── Importar app de Fase 3 (reutiliza todos sus endpoints) ──────────────────
from src.phase3.api import app, get_inference_service

# ── Credenciales Sentinel Hub (OAuth2) ───────────────────────────────────────
SENTINEL_CLIENT_ID     = os.getenv("SENTINEL_HUB_CLIENT_ID", "")
SENTINEL_CLIENT_SECRET = os.getenv("SENTINEL_HUB_CLIENT_SECRET", "")

_sentinel_service = None


def get_sentinel_service():
    """Inicializa el servicio Sentinel Hub de forma lazy."""
    global _sentinel_service
    if _sentinel_service is None and SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET:
        from src.phase5.sentinel_hub import SentinelHubService
        _sentinel_service = SentinelHubService(SENTINEL_CLIENT_ID, SENTINEL_CLIENT_SECRET)
    return _sentinel_service


# ── GET /sentinel/status ─────────────────────────────────────────────────────
@app.get("/sentinel/status", tags=["Phase 5 — Búsqueda dinámica"])
async def sentinel_status():
    """Verifica si Sentinel Hub está configurado y disponible."""
    configured = bool(SENTINEL_CLIENT_ID and SENTINEL_CLIENT_SECRET)
    return {
        "configured": configured,
        "message": (
            "Sentinel Hub activo — búsqueda dinámica disponible"
            if configured else
            "Configura SENTINEL_HUB_CLIENT_ID y SENTINEL_HUB_CLIENT_SECRET en .env"
        ),
    }


# ── POST /analyze-location ───────────────────────────────────────────────────
@app.post("/analyze-location", tags=["Phase 5 — Búsqueda dinámica"])
async def analyze_location(
    lat:                float,
    lng:                float,
    address:            str   = "",
    size_km:            float = 10.0,
    max_cloud_coverage: float = 0.3,
    days_back:          int   = 90,
):
    """
    Analiza el uso de suelo LULC de cualquier ubicación del mundo.

    Flujo:
      1. Descarga imagen Sentinel-2 de las coordenadas (via Sentinel Hub OAuth2)
      2. Ejecuta el modelo U-Net (mismo modelo que las 10 ciudades)
      3. Devuelve distribución LULC + imagen original en base64 + máscara

    Args:
        lat                : Latitud del centro
        lng                : Longitud del centro
        address            : Texto descriptivo (solo para mostrar)
        size_km            : Tamaño del área en km (default 10)
        max_cloud_coverage : Nubosidad máxima 0-1 (default 0.3)
        days_back          : Buscar imágenes de los últimos N días (default 90)
    """
    svc = get_inference_service()
    if svc is None:
        raise HTTPException(status_code=503, detail="El modelo U-Net no está cargado.")

    sentinel = get_sentinel_service()
    if sentinel is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "Sentinel Hub no está configurado. "
                "Agrega SENTINEL_HUB_CLIENT_ID y SENTINEL_HUB_CLIENT_SECRET al .env"
            ),
        )

    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        raise HTTPException(status_code=422, detail=f"Coordenadas inválidas: lat={lat}, lng={lng}")

    try:
        import base64, torch
        import torch.nn.functional as F
        from PIL import Image as PILImage

        # ── 1. Descargar imagen Sentinel-2 (6 bandas) ────────────────
        image, meta = sentinel.get_image_for_location(
            lat=lat, lng=lng,
            size_km=size_km,
            max_cloud_coverage=max_cloud_coverage,
            days_back=days_back,
        )

        # ── 2. Preview RGB en base64 ─────────────────────────────────
        original_base64 = None
        try:
            rgb_bytes       = sentinel.get_preview_rgb(lat, lng, size_km)
            original_base64 = base64.b64encode(rgb_bytes).decode()
        except Exception:
            # Fallback: generar desde bandas B02, B03, B04
            rgb      = image[:3].transpose(1, 2, 0)
            rgb_norm = ((rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-8) * 255).astype(np.uint8)
            pil_img  = PILImage.fromarray(rgb_norm)
            buf      = io.BytesIO()
            pil_img.save(buf, format="PNG")
            original_base64 = base64.b64encode(buf.getvalue()).decode()

        # ── 3. Inferencia U-Net ──────────────────────────────────────
        tensor = torch.from_numpy(image).unsqueeze(0)  # (1, 6, H, W)
        if tensor.shape[2] != 256 or tensor.shape[3] != 256:
            tensor = F.interpolate(tensor, size=(256, 256), mode="bilinear", align_corners=False)

        tensor = tensor.to(svc.device)
        with torch.no_grad():
            output = svc.model(tensor)
            mask   = output.argmax(dim=1).squeeze(0).cpu().numpy()

        stats = svc._compute_stats(mask)

        return {
            "address":         address,
            "lat":             lat,
            "lng":             lng,
            "size_km":         size_km,
            "meta":            meta,
            "bbox":            meta["bbox"],         # [minX, minY, maxX, maxY] para overlay en mapa
            "distribucion":    stats,
            "mask_flat":       mask.flatten().tolist(),
            "mask_size":       256,
            "original_base64": original_base64,
        }

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
