"""
API FastAPI — Endpoints para el Urban Intelligence Platform.
Urban Intelligence Platform - Fase 3

Endpoints:
    POST /chat                  — Envía una pregunta al agente, recibe respuesta
    POST /predict               — Clasifica un patch individual
    GET  /cities                — Lista ciudades disponibles
    GET  /stats/{ciudad}        — Estadísticas de una ciudad
    GET  /classify/{ciudad}     — Clasificación LULC de una ciudad con el modelo U-Net
    GET  /health                — Health check

Ejecución:
    cd Urban-Intelligence-Platform
    uvicorn src.phase3.api:app --reload --port 8000

Documentación automática:
    http://localhost:8000/docs
"""
import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import numpy as np
import tempfile
import shutil

# Agregar el directorio raíz al path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

load_dotenv(ROOT_DIR / ".env")

from src.phase3.inference import InferenceService, CLASS_NAMES
from src.phase3.tools import DATASET_STATS
from src.phase3.agent import create_agent, chat

# ── Configuración ────────────────────────────────────────────────────
MODEL_PATH = str(ROOT_DIR / "models" / "best_model.pth")
DATA_DIR = str(ROOT_DIR / "data" / "processed")

# ── FastAPI App ──────────────────────────────────────────────────────
app = FastAPI(
    title="Urban Intelligence Platform",
    description=(
        "API para clasificación de uso de suelo urbano (LULC) "
        "con imágenes satelitales Sentinel-2 y agente de IA."
    ),
    version="1.0.0"
)

# CORS para permitir requests desde frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Variables globales ───────────────────────────────────────────────
agent = None
inference_service = None


# ── Modelos de request/response ──────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    city: str | None = None

    class Config:
        json_schema_extra = {
            "example": {
                "question": "¿Cuál es la distribución de uso de suelo en Monterrey?"
            }
        }


class ChatResponse(BaseModel):
    response: str
    status: str = "ok"


class PredictRequest(BaseModel):
    image_path: str

    class Config:
        json_schema_extra = {
            "example": {
                "image_path": "data/processed/monterrey_mx_spring/img_0001.npy"
            }
        }


# ── Eventos de inicio ───────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    """Inicializa el modelo y el agente al arrancar el servidor."""
    global agent, inference_service

    print("Inicializando Urban Intelligence Platform...")

    # Cargar modelo de inferencia
    try:
        inference_service = InferenceService(MODEL_PATH, device="cpu")
    except Exception as e:
        print(f"Advertencia: No se pudo cargar el modelo: {e}")
        inference_service = None

    # Crear agente
    try:
        agent = create_agent(
            model_path=MODEL_PATH,
            data_dir=DATA_DIR
        )
        print("Agente inicializado correctamente")
    except Exception as e:
        print(f"Advertencia: No se pudo crear el agente: {e}")
        agent = None

    print("Servidor listo")


# ── Endpoints ────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Verifica que el servidor esté funcionando."""
    return {
        "status": "ok",
        "model_loaded": inference_service is not None,
        "agent_ready": agent is not None,
        "classes": CLASS_NAMES,
        "cities_available": len(DATASET_STATS)
    }


@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Envía una pregunta al agente de IA sobre uso de suelo.
    El agente decide qué herramientas usar para responder.
    """
    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="El agente no está disponible. Verifica la API key de Anthropic."
        )

    try:
        response = chat(agent, request.message)
        return ChatResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict")
async def predict_endpoint(request: PredictRequest):
    """
    Clasifica un patch individual usando el modelo U-Net.
    Devuelve la distribución de clases LULC.
    """
    if inference_service is None:
        raise HTTPException(status_code=503, detail="El modelo no está cargado.")

    image_path = Path(request.image_path)
    if not image_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Archivo no encontrado: {request.image_path}"
        )

    try:
        mask, stats = inference_service.predict_patch(str(image_path))
        return {
            "image_path": str(image_path),
            "shape": list(mask.shape),
            "distribucion": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cities")
async def list_cities():
    """Lista todas las ciudades disponibles en el dataset."""
    cities = []
    for key, stats in DATASET_STATS.items():
        cities.append({
            "id": key,
            "nombre": stats["nombre_completo"],
            "region": stats["region"],
            "estaciones": stats["estaciones"],
            "patches": stats["patches"]
        })

    return {
        "total_ciudades": len(cities),
        "total_patches": sum(c["patches"] for c in cities),
        "ciudades": cities
    }


@app.get("/stats/{city_name}")
async def city_stats(city_name: str):
    """
    Devuelve estadísticas del dataset para una ciudad específica.
    Incluye: nombre, región, estaciones, patches.
    Para obtener la distribución LULC del modelo, usar /classify/{city_name}.
    """
    city_key = _find_city(city_name)
    if city_key is None:
        raise HTTPException(
            status_code=404,
            detail=f"Ciudad '{city_name}' no encontrada. "
                   f"Disponibles: {list(DATASET_STATS.keys())}"
        )

    return {
        "id": city_key,
        **DATASET_STATS[city_key]
    }


@app.get("/classify/{city_name}")
async def classify_city(city_name: str, max_patches: int = 50):
    """
    Clasifica el uso de suelo de una ciudad con el modelo U-Net.
    Procesa una muestra representativa de patches (por defecto 50).

    Advertencia: Puede tardar 1-3 minutos en CPU.

    Args:
        city_name: Prefijo de la ciudad (ej: monterrey_mx, amsterdam_nl)
        max_patches: Máximo de patches a analizar (default: 50)
    """
    if inference_service is None:
        raise HTTPException(
            status_code=503,
            detail="El modelo no está cargado."
        )

    city_key = _find_city(city_name)
    if city_key is None:
        raise HTTPException(
            status_code=404,
            detail=f"Ciudad '{city_name}' no encontrada. "
                   f"Disponibles: {list(DATASET_STATS.keys())}"
        )

    try:
        result = inference_service.predict_city(
            DATA_DIR,
            city_key,
            max_patches=max_patches
        )
        if "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])

        # Agregar info de la ciudad
        result["ciudad_info"] = DATASET_STATS[city_key]
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-classify")
async def upload_classify(file: UploadFile = File(...)):
    """
    Clasifica una imagen subida por el usuario usando el modelo U-Net.

    Formatos aceptados:
    - .npy        : array numpy (6, H, W) o (H, W, 6), dtype float32
    - .tif/.tiff  : GeoTIFF Sentinel-2 con 6 bandas (requiere rasterio)
    - .jpg/.jpeg/.png : imagen RGB — se convierte a 6 bandas automáticamente

    Devuelve:
    - distribucion    : porcentaje de cada clase LULC
    - mask_flat       : máscara predicha como lista plana
    - mask_size       : tamaño del lado de la máscara (256)
    - original_base64 : imagen original en base64 para visualización
    - original_size   : [width, height] de la imagen original
    """
    if inference_service is None:
        raise HTTPException(status_code=503, detail="El modelo no está cargado.")

    ext = Path(file.filename).suffix.lower()
    ALLOWED = [".npy", ".tif", ".tiff", ".jpg", ".jpeg", ".png"]
    if ext not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail=f"Formato no soportado: {ext}. Usa: {', '.join(ALLOWED)}"
        )

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        from PIL import Image as PILImage
        import base64, io, torch
        import torch.nn.functional as F

        original_base64 = None
        original_size   = None

        # ── Cargar imagen según formato ──────────────────────────────
        if ext == ".npy":
            image = np.load(tmp_path).astype(np.float32)
            # Generar preview RGB desde bandas 0,1,2
            if image.ndim == 3:
                rgb_bands = image[:3] if image.shape[0] >= 3 else image
                rgb = rgb_bands.transpose(1, 2, 0) if rgb_bands.shape[0] == 3 else rgb_bands
                rgb_norm = ((rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-8) * 255).astype(np.uint8)
                pil_img = PILImage.fromarray(rgb_norm if rgb_norm.ndim == 3 else np.stack([rgb_norm]*3, axis=-1))
                buf = io.BytesIO()
                pil_img.save(buf, format='PNG')
                original_base64 = base64.b64encode(buf.getvalue()).decode()
                original_size   = [pil_img.width, pil_img.height]

        elif ext in [".tif", ".tiff"]:
            try:
                import rasterio
                with rasterio.open(tmp_path) as src:
                    image = src.read().astype(np.float32)
                # Preview RGB desde bandas 0,1,2
                rgb = image[:3].transpose(1, 2, 0)
                rgb_norm = ((rgb - rgb.min()) / (rgb.max() - rgb.min() + 1e-8) * 255).astype(np.uint8)
                pil_img = PILImage.fromarray(rgb_norm)
                buf = io.BytesIO()
                pil_img.save(buf, format='PNG')
                original_base64 = base64.b64encode(buf.getvalue()).decode()
                original_size   = [pil_img.width, pil_img.height]
            except ImportError:
                raise HTTPException(
                    status_code=422,
                    detail="Para .tif instala rasterio: pip install rasterio"
                )

        else:
            # JPG / PNG — convertir RGB a 6 bandas sintéticas
            pil_img = PILImage.open(tmp_path).convert('RGB')
            original_size = [pil_img.width, pil_img.height]

            # Guardar original como base64
            buf = io.BytesIO()
            pil_img.save(buf, format='PNG')
            original_base64 = base64.b64encode(buf.getvalue()).decode()

            # Convertir a array float normalizado
            rgb = np.array(pil_img).astype(np.float32) / 255.0  # (H, W, 3)
            R, G, B = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]

            # Aproximar 6 bandas Sentinel-2 desde RGB:
            # B2(Blue), B3(Green), B4(Red), B8(NIR), B11(SWIR1), B12(SWIR2)
            band2  = B                              # Blue
            band3  = G                              # Green
            band4  = R                              # Red
            band8  = (0.7*G + 0.3*R)               # NIR ≈ combinación verde-rojo
            band11 = (0.6*R + 0.4*B)               # SWIR1 ≈ rojo con algo de azul
            band12 = (0.5*R + 0.3*G + 0.2*B)       # SWIR2 ≈ mezcla ponderada

            image = np.stack([band2, band3, band4, band8, band11, band12], axis=0)  # (6, H, W)

        # ── Normalizar shape a (6, H, W) ────────────────────────────
        if image.ndim == 3 and image.shape[2] == 6:
            image = image.transpose(2, 0, 1)

        if image.ndim != 3 or image.shape[0] != 6:
            raise HTTPException(
                status_code=422,
                detail=f"Se esperan 6 bandas. Shape recibido: {image.shape}"
            )

        # ── Inferencia ───────────────────────────────────────────────
        tensor = torch.from_numpy(image).unsqueeze(0)  # (1, 6, H, W)
        if tensor.shape[2] != 256 or tensor.shape[3] != 256:
            tensor = F.interpolate(tensor, size=(256, 256), mode='bilinear', align_corners=False)

        tensor = tensor.to(inference_service.device)
        with torch.no_grad():
            output = inference_service.model(tensor)
            mask   = output.argmax(dim=1).squeeze(0).cpu().numpy()  # (256, 256)

        stats = inference_service._compute_stats(mask)

        return {
            "filename":       file.filename,
            "shape_original": list(image.shape),
            "mask_size":      256,
            "mask_flat":      mask.flatten().tolist(),
            "distribucion":   stats,
            "original_base64": original_base64,
            "original_size":   original_size,
        }

    finally:
        Path(tmp_path).unlink(missing_ok=True)


@app.get("/rankings")
async def get_rankings():
    """
    Devuelve los datos LULC de todas las ciudades para los rankings.
    Lee desde models/lulc_cache.json si existe.
    Ciudades sin clasificar aparecen con distribucion: null.
    """
    cache_path = ROOT_DIR / "models" / "lulc_cache.json"

    # Estructura base con todas las ciudades
    result = {}
    for key, stats in DATASET_STATS.items():
        result[key] = {
            "nombre":       stats["nombre_completo"],
            "region":       stats["region"],
            "distribucion": None,
        }

    # Cargar cache si existe
    if cache_path.exists():
        import json
        with open(cache_path) as f:
            cache = json.load(f)
        for key, data in cache.items():
            if key in result:
                result[key]["distribucion"] = data.get("distribucion")

    classified = sum(1 for v in result.values() if v["distribucion"])
    return {
        "cities":     result,
        "classified": classified,
        "total":      len(result),
    }


@app.post("/compute-rankings")
async def compute_rankings():
    """
    Clasifica todas las ciudades con el modelo U-Net y guarda los resultados
    en models/lulc_cache.json para los rankings.
    Advertencia: puede tardar 10-20 minutos en CPU.
    """
    if inference_service is None:
        raise HTTPException(status_code=503, detail="El modelo no está cargado.")

    import json
    cache_path = ROOT_DIR / "models" / "lulc_cache.json"

    # Cargar cache existente
    cache = {}
    if cache_path.exists():
        with open(cache_path) as f:
            cache = json.load(f)

    errors = []
    for city_key in DATASET_STATS:
        if city_key in cache:
            continue  # ya clasificada, saltar
        try:
            result = inference_service.predict_city(DATA_DIR, city_key, max_patches=50)
            if "error" not in result:
                cache[city_key] = {"distribucion": result.get("distribucion")}
        except Exception as e:
            errors.append(f"{city_key}: {str(e)}")

    # Guardar cache actualizado
    with open(cache_path, "w") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    return {
        "status":     "ok",
        "classified": len(cache),
        "total":      len(DATASET_STATS),
        "errors":     errors,
    }


# ── Helpers ─────────────────────────────────────────────────────────
def _find_city(city_name: str):
    """Busca una ciudad por nombre parcial."""
    for key in DATASET_STATS:
        if city_name.lower() in key or key in city_name.lower():
            return key
    return None


# ── Ejecución directa ───────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
