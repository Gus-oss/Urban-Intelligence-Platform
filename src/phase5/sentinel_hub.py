"""
Sentinel Hub Service — descarga imágenes Sentinel-2 por coordenadas.
Urban Intelligence Platform - Fase 5

Documentación: https://docs.sentinel-hub.com/api/latest/api/process/
"""
import os
import io
import numpy as np
import requests
from datetime import datetime, timedelta
from typing import Tuple, Optional


SENTINEL_HUB_URL = "https://services.sentinel-hub.com/api/v1/process"

# Evalscript: devuelve las 6 bandas que necesita el modelo U-Net
# B02=Blue, B03=Green, B04=Red, B08=NIR, B11=SWIR1, B12=SWIR2
EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B02", "B03", "B04", "B08", "B11", "B12"],
      units: "REFLECTANCE"
    }],
    output: {
      bands: 6,
      sampleType: "FLOAT32"
    }
  };
}
function evaluatePixel(sample) {
  return [sample.B02, sample.B03, sample.B04,
          sample.B08, sample.B11, sample.B12];
}
"""


class SentinelHubService:
    """Descarga imágenes Sentinel-2 usando la API de Sentinel Hub."""

    def __init__(self, api_key: str):
        self.api_key  = api_key
        self.headers  = {
            "Authorization": f"ApiKey {api_key}",
            "Content-Type":  "application/json",
            "Accept":        "application/tar",
        }

    def get_image_for_location(
        self,
        lat: float,
        lng: float,
        size_km: float = 10.0,
        max_cloud_coverage: float = 0.3,
        days_back: int = 90,
    ) -> Tuple[np.ndarray, dict]:
        """
        Descarga la imagen Sentinel-2 más reciente para unas coordenadas.

        Args:
            lat               : Latitud del centro
            lng               : Longitud del centro
            size_km           : Tamaño del área en km (cuadrado)
            max_cloud_coverage: Cobertura máxima de nubes (0-1)
            days_back         : Buscar imágenes de los últimos N días

        Returns:
            image: Array numpy (6, 256, 256) float32 listo para el modelo
            meta : Metadata (fecha, nubosidad, bbox)
        """
        bbox   = self._coords_to_bbox(lat, lng, size_km)
        dates  = self._get_date_range(days_back)

        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "dataFilter": {
                        "timeRange": {
                            "from": dates["from"],
                            "to":   dates["to"],
                        },
                        "maxCloudCoverage": max_cloud_coverage * 100,
                        "mosaickingOrder": "leastCC",  # menos nubes primero
                    },
                    "type": "sentinel-2-l2a",
                }],
            },
            "output": {
                "width":  256,
                "height": 256,
                "responses": [{
                    "identifier": "default",
                    "format": {"type": "image/tiff", "parameters": {"dataType": "float32"}},
                }],
            },
            "evalscript": EVALSCRIPT,
        }

        response = requests.post(
            SENTINEL_HUB_URL,
            json=payload,
            headers=self.headers,
            timeout=60,
        )

        if response.status_code == 200:
            image = self._parse_tiff_response(response.content)
            meta  = {
                "bbox":       bbox,
                "date_range": dates,
                "size_km":    size_km,
                "shape":      list(image.shape),
            }
            return image, meta

        elif response.status_code == 400:
            # Puede ser que no haya imágenes disponibles — ampliar rango
            raise ValueError(
                f"Sin imágenes disponibles para esta ubicación en los últimos "
                f"{days_back} días. Intenta aumentar el rango de fechas o "
                f"reducir el filtro de nubosidad. Detalle: {response.text}"
            )
        else:
            raise RuntimeError(
                f"Error de Sentinel Hub ({response.status_code}): {response.text}"
            )

    def _coords_to_bbox(self, lat: float, lng: float, size_km: float) -> list:
        """
        Convierte lat/lng + tamaño en km a bounding box [minX, minY, maxX, maxY].
        Aproximación: 1° lat ≈ 111 km, 1° lng ≈ 111 * cos(lat) km
        """
        import math
        delta_lat = (size_km / 2) / 111.0
        delta_lng = (size_km / 2) / (111.0 * math.cos(math.radians(lat)))
        return [
            round(lng - delta_lng, 6),
            round(lat - delta_lat, 6),
            round(lng + delta_lng, 6),
            round(lat + delta_lat, 6),
        ]

    def _get_date_range(self, days_back: int) -> dict:
        """Genera el rango de fechas para buscar imágenes."""
        end   = datetime.utcnow()
        start = end - timedelta(days=days_back)
        return {
            "from": start.strftime("%Y-%m-%dT00:00:00Z"),
            "to":   end.strftime("%Y-%m-%dT23:59:59Z"),
        }

    def _parse_tiff_response(self, content: bytes) -> np.ndarray:
        """
        Parsea la respuesta TIFF de Sentinel Hub a array numpy (6, 256, 256).
        Intenta con rasterio primero, luego con PIL como fallback.
        """
        try:
            import rasterio
            with rasterio.open(io.BytesIO(content)) as src:
                image = src.read().astype(np.float32)  # (bands, H, W)
            return image
        except ImportError:
            pass

        # Fallback con PIL (solo para imágenes RGB, no multi-banda)
        try:
            from PIL import Image
            img = Image.open(io.BytesIO(content))
            arr = np.array(img).astype(np.float32)
            if arr.ndim == 2:
                arr = arr[np.newaxis, ...]
            elif arr.ndim == 3:
                arr = arr.transpose(2, 0, 1)
            return arr
        except Exception as e:
            raise RuntimeError(f"No se pudo parsear la imagen TIFF: {e}")

    def get_preview_rgb(self, lat: float, lng: float, size_km: float = 10.0) -> bytes:
        """
        Descarga una imagen RGB (PNG) de vista previa para mostrar en el frontend.
        Usa las bandas B04 (R), B03 (G), B02 (B).
        """
        evalscript_rgb = """
        //VERSION=3
        function setup() {
          return {
            input: [{ bands: ["B04", "B03", "B02"], units: "REFLECTANCE" }],
            output: { bands: 3, sampleType: "UINT8" }
          };
        }
        function evaluatePixel(sample) {
          return [
            Math.min(255, sample.B04 * 3.5 * 255),
            Math.min(255, sample.B03 * 3.5 * 255),
            Math.min(255, sample.B02 * 3.5 * 255)
          ];
        }
        """
        bbox  = self._coords_to_bbox(lat, lng, size_km)
        dates = self._get_date_range(90)

        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "dataFilter": {
                        "timeRange": {"from": dates["from"], "to": dates["to"]},
                        "maxCloudCoverage": 30,
                        "mosaickingOrder": "leastCC",
                    },
                    "type": "sentinel-2-l2a",
                }],
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{
                    "identifier": "default",
                    "format": {"type": "image/png"},
                }],
            },
            "evalscript": evalscript_rgb,
        }

        headers = {**self.headers, "Accept": "image/png"}
        response = requests.post(
            SENTINEL_HUB_URL, json=payload, headers=headers, timeout=60
        )

        if response.status_code == 200:
            return response.content
        raise RuntimeError(f"Error obteniendo preview ({response.status_code}): {response.text}")
