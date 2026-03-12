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
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

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
    question: str

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
        response = chat(agent, request.question)
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
