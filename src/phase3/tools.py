"""
Tools del Agente LangChain — Herramientas que el agente puede usar.
Urban Intelligence Platform - Fase 3

Tools:
    1. classify_city    — Clasifica el uso de suelo de una ciudad usando el modelo U-Net
    2. get_city_stats   — Consulta estadísticas precalculadas del dataset
    3. list_cities      — Lista las ciudades disponibles en el dataset
"""
from langchain_core.tools import tool
from typing import Optional
from src.phase3.inference import InferenceService, CLASS_NAMES
import json

# ── Variables globales (se inicializan en agent.py) ──
_inference_service: Optional[InferenceService] = None
_data_dir: Optional[str] = None

# Límite de patches para inferencia local (CPU)
# En la VM con GPU se puede subir a None para procesar todos
MAX_PATCHES = 50

# Estadísticas precalculadas del dataset (de la bitácora)
DATASET_STATS = {
    "amsterdam_nl": {
        "nombre_completo": "Ámsterdam, Países Bajos",
        "region": "Europa",
        "estaciones": 3,
        "patches": 17557
    },
    "bangkok_th": {
        "nombre_completo": "Bangkok, Tailandia",
        "region": "Asia",
        "estaciones": 4,
        "patches": 28224
    },
    "bogota_co": {
        "nombre_completo": "Bogotá, Colombia",
        "region": "Latinoamérica",
        "estaciones": 1,
        "patches": 7056
    },
    "mexico_city_mx": {
        "nombre_completo": "Ciudad de México, México",
        "region": "Latinoamérica",
        "estaciones": 2,
        "patches": 11796
    },
    "dubai_ae": {
        "nombre_completo": "Dubái, Emiratos Árabes",
        "region": "Medio Oriente",
        "estaciones": 3,
        "patches": 15950
    },
    "houston_us": {
        "nombre_completo": "Houston, Estados Unidos",
        "region": "Norteamérica",
        "estaciones": 1,
        "patches": 864
    },
    "madrid_es": {
        "nombre_completo": "Madrid, España",
        "region": "Europa",
        "estaciones": 4,
        "patches": 21146
    },
    "monterrey_mx": {
        "nombre_completo": "Monterrey, México",
        "region": "Latinoamérica",
        "estaciones": 4,
        "patches": 28224
    },
    "mumbai_in": {
        "nombre_completo": "Bombay, India",
        "region": "Asia",
        "estaciones": 3,
        "patches": 4668
    },
    "nairobi_ke": {
        "nombre_completo": "Nairobi, Kenia",
        "region": "África",
        "estaciones": 3,
        "patches": 15447
    }
}


def init_tools(inference_service: InferenceService, data_dir: str):
    """Inicializa los tools con el servicio de inferencia y la ruta de datos."""
    global _inference_service, _data_dir
    _inference_service = inference_service
    _data_dir = data_dir


@tool
def classify_city(city_name: str) -> str:
    """
    Clasifica el uso de suelo de una ciudad usando el modelo U-Net con imágenes Sentinel-2.
    Analiza una muestra representativa de patches de la ciudad y devuelve la distribución
    de 4 clases LULC: Urbano, Vegetación, Agua, Suelo desnudo.

    Args:
        city_name: Nombre de la ciudad en formato prefijo (ej: 'monterrey_mx', 'amsterdam_nl', 'dubai_ae')
    """
    if _inference_service is None:
        return "Error: El servicio de inferencia no está inicializado."

    if _data_dir is None:
        return "Error: No se ha configurado el directorio de datos."

    result = _inference_service.predict_city(_data_dir, city_name, max_patches=MAX_PATCHES)
    return json.dumps(result, ensure_ascii=False, indent=2)


@tool
def get_city_stats(city_name: str) -> str:
    """
    Obtiene estadísticas precalculadas del dataset para una ciudad:
    nombre completo, región geográfica, número de estaciones del año disponibles,
    y cantidad de patches (imágenes de 256x256 píxeles).

    Args:
        city_name: Nombre de la ciudad en formato prefijo (ej: 'monterrey_mx', 'amsterdam_nl')
    """
    # Buscar la ciudad (match parcial)
    city_key = None
    for key in DATASET_STATS:
        if city_name.lower() in key or key in city_name.lower():
            city_key = key
            break

    if city_key is None:
        available = ", ".join(DATASET_STATS.keys())
        return f"Ciudad '{city_name}' no encontrada. Ciudades disponibles: {available}"

    stats = DATASET_STATS[city_key]
    stats["prefijo"] = city_key
    return json.dumps(stats, ensure_ascii=False, indent=2)


@tool
def list_cities() -> str:
    """
    Lista todas las ciudades disponibles en el dataset con su información básica:
    nombre, región, estaciones disponibles y cantidad de patches.
    Útil para saber qué ciudades se pueden analizar.
    """
    result = {
        "total_ciudades": len(DATASET_STATS),
        "total_patches": sum(c["patches"] for c in DATASET_STATS.values()),
        "ciudades": {}
    }

    for key, stats in DATASET_STATS.items():
        result["ciudades"][key] = {
            "nombre": stats["nombre_completo"],
            "region": stats["region"],
            "patches": stats["patches"]
        }

    return json.dumps(result, ensure_ascii=False, indent=2)


# Lista de tools para el agente
ALL_TOOLS = [classify_city, get_city_stats, list_cities]
