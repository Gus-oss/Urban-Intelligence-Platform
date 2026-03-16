"""
Sentinel Hub Service — descarga imágenes Sentinel-2 por coordenadas.
Urban Intelligence Platform - Fase 5

Usa OAuth2 (Client Credentials) para autenticación.
Documentación: https://docs.sentinel-hub.com/api/latest/api/process/
"""
import io
import time
import math
import numpy as np
import requests
from datetime import datetime, timedelta
from typing import Tuple, Optional


SENTINEL_HUB_URL   = "https://services.sentinel-hub.com/api/v1/process"
SENTINEL_HUB_TOKEN = "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token"

EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B02", "B03", "B04", "B08", "B11", "B12"],
      units: "REFLECTANCE"
    }],
    output: { bands: 6, sampleType: "FLOAT32" }
  };
}
function evaluatePixel(sample) {
  return [sample.B02, sample.B03, sample.B04,
          sample.B08, sample.B11, sample.B12];
}
"""

EVALSCRIPT_RGB = """
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


class SentinelHubService:
    """Descarga imágenes Sentinel-2 usando OAuth2 + Process API."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id     = client_id
        self.client_secret = client_secret
        self._token        = None
        self._token_expiry = 0

    def _get_token(self) -> str:
        """Obtiene o renueva el access token via OAuth2 client credentials."""
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        res = requests.post(
            SENTINEL_HUB_TOKEN,
            data={
                "grant_type":    "client_credentials",
                "client_id":     self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )

        if res.status_code != 200:
            raise RuntimeError(
                f"Error de autenticación Sentinel Hub ({res.status_code}): {res.text}"
            )

        data               = res.json()
        self._token        = data["access_token"]
        self._token_expiry = time.time() + data.get("expires_in", 3600)
        return self._token

    @property
    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type":  "application/json",
        }

    @property
    def _headers_png(self) -> dict:
        return {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type":  "application/json",
            "Accept":        "image/png",
        }

    def _coords_to_bbox(self, lat: float, lng: float, size_km: float) -> list:
        delta_lat = (size_km / 2) / 111.0
        delta_lng = (size_km / 2) / (111.0 * math.cos(math.radians(lat)))
        return [
            round(lng - delta_lng, 6),
            round(lat - delta_lat, 6),
            round(lng + delta_lng, 6),
            round(lat + delta_lat, 6),
        ]

    def _get_date_range(self, days_back: int) -> dict:
        end   = datetime.utcnow()
        start = end - timedelta(days=days_back)
        return {
            "from": start.strftime("%Y-%m-%dT00:00:00Z"),
            "to":   end.strftime("%Y-%m-%dT23:59:59Z"),
        }

    def _parse_tiff(self, content: bytes) -> np.ndarray:
        try:
            import rasterio
            with rasterio.open(io.BytesIO(content)) as src:
                return src.read().astype(np.float32)
        except ImportError:
            pass
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
            raise RuntimeError(f"No se pudo parsear el TIFF: {e}")

    def get_image_for_location(
        self,
        lat: float,
        lng: float,
        size_km: float = 10.0,
        max_cloud_coverage: float = 0.3,
        days_back: int = 90,
    ) -> Tuple[np.ndarray, dict]:
        """
        Descarga imagen Sentinel-2 (6 bandas) para unas coordenadas.
        Returns: (array numpy (6,256,256), metadata dict)
        """
        bbox  = self._coords_to_bbox(lat, lng, size_km)
        dates = self._get_date_range(days_back)

        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [{
                    "dataFilter": {
                        "timeRange": {"from": dates["from"], "to": dates["to"]},
                        "maxCloudCoverage": int(max_cloud_coverage * 100),
                        "mosaickingOrder": "leastCC",
                    },
                    "type": "sentinel-2-l2a",
                }],
            },
            "output": {
                "width": 256, "height": 256,
                "responses": [{
                    "identifier": "default",
                    "format": {"type": "image/tiff", "parameters": {"dataType": "float32"}},
                }],
            },
            "evalscript": EVALSCRIPT,
        }

        res = requests.post(
            SENTINEL_HUB_URL, json=payload,
            headers=self._headers, timeout=60,
        )

        if res.status_code == 200:
            image = self._parse_tiff(res.content)
            return image, {"bbox": bbox, "date_range": dates, "size_km": size_km, "shape": list(image.shape)}
        elif res.status_code == 400:
            raise ValueError(
                f"Sin imágenes disponibles para esta ubicación en los últimos {days_back} días. "
                f"Intenta aumentar el rango de fechas o reducir el filtro de nubosidad."
            )
        else:
            raise RuntimeError(f"Error de Sentinel Hub ({res.status_code}): {res.text}")

    def get_preview_rgb(self, lat: float, lng: float, size_km: float = 10.0) -> bytes:
        """Descarga imagen RGB (PNG) de vista previa."""
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
            "evalscript": EVALSCRIPT_RGB,
        }

        res = requests.post(
            SENTINEL_HUB_URL, json=payload,
            headers=self._headers_png, timeout=60,
        )

        if res.status_code == 200:
            return res.content
        raise RuntimeError(f"Error obteniendo preview ({res.status_code}): {res.text}")
