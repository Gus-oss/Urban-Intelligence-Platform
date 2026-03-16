"""
Servicio de Inferencia para producción — lee patches directamente desde
Google Cloud Storage en lugar del sistema de archivos local.

Urban Intelligence Platform - Fase 5 (Cloud Run)
"""
import io
import numpy as np
import torch
import segmentation_models_pytorch as smp
from pathlib import Path
from typing import Dict, Tuple, Optional
from google.cloud import storage

CLASS_NAMES = {
    0: "Urbano/Construido",
    1: "Vegetación/Bosque",
    2: "Agua",
    3: "Suelo desnudo/Árido",
}
NUM_CLASSES = 4


class InferenceService:
    """
    Carga el modelo U-Net desde GCS y clasifica patches también desde GCS.
    Compatible con Cloud Run (sin disco local).
    """

    def __init__(
        self,
        model_path: str,
        device: str = None,
        bucket_name: str = "urban-intelligence-lulc",
        gcs_processed_prefix: str = "processed",
    ):
        """
        Args:
            model_path     : Ruta local al modelo (descargado de GCS al arrancar)
            device         : 'cuda' o 'cpu'. None = autodetectar
            bucket_name    : Nombre del bucket GCS
            gcs_processed_prefix: Prefijo donde están los patches en GCS
        """
        self.bucket_name          = bucket_name
        self.gcs_processed_prefix = gcs_processed_prefix
        self.gcs_client           = None  # se inicializa lazy

        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model = smp.Unet(
            encoder_name="efficientnet-b3",
            encoder_weights=None,
            in_channels=6,
            classes=NUM_CLASSES,
        ).to(self.device)

        state_dict = torch.load(model_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state_dict)
        self.model.eval()
        print(f"Modelo cargado en {self.device}")

    def _get_gcs_client(self):
        """Inicializa el cliente GCS de forma lazy."""
        if self.gcs_client is None:
            self.gcs_client = storage.Client()
        return self.gcs_client

    def _load_npy_from_gcs(self, blob_path: str) -> np.ndarray:
        """Descarga y carga un .npy directamente desde GCS a memoria."""
        client = self._get_gcs_client()
        bucket = client.bucket(self.bucket_name)
        blob   = bucket.blob(blob_path)
        data   = blob.download_as_bytes()
        return np.load(io.BytesIO(data)).astype(np.float32)

    def _list_city_blobs(self, city_prefix: str, max_patches: Optional[int] = None):
        """Lista los blobs .npy de una ciudad en GCS."""
        client  = self._get_gcs_client()
        bucket  = client.bucket(self.bucket_name)
        prefix  = f"{self.gcs_processed_prefix}/{city_prefix}"
        blobs   = list(bucket.list_blobs(prefix=prefix))
        patches = [b for b in blobs if b.name.endswith(".npy") and "/img_" in b.name]
        patches.sort(key=lambda b: b.name)
        if max_patches:
            # Distribuir uniformemente entre estaciones
            step    = max(1, len(patches) // max_patches)
            patches = patches[::step][:max_patches]
        return patches

    def predict_patch_from_array(self, image: np.ndarray) -> Tuple[np.ndarray, Dict]:
        """Predice desde un array numpy ya cargado."""
        tensor = torch.from_numpy(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            output = self.model(tensor)
            mask   = output.argmax(dim=1).squeeze(0).cpu().numpy()
        return mask, self._compute_stats(mask)

    def predict_patch(self, image_path: str) -> Tuple[np.ndarray, Dict]:
        """
        Predice desde ruta local (compatibilidad con código existente).
        En producción usa predict_patch_from_array con GCS.
        """
        image = np.load(image_path).astype(np.float32)
        return self.predict_patch_from_array(image)

    def predict_city(
        self,
        data_dir: str,
        city_prefix: str,
        max_patches: Optional[int] = None,
        use_gcs: bool = True,
    ) -> Dict:
        """
        Clasifica todos los patches de una ciudad.

        En producción (use_gcs=True) lee desde GCS.
        En desarrollo (use_gcs=False) lee desde data_dir local.

        Args:
            data_dir    : Ruta local a processed/ (solo si use_gcs=False)
            city_prefix : Ej: 'monterrey_mx'
            max_patches : Límite de patches. None = todos
            use_gcs     : True en Cloud Run, False en local
        """
        if use_gcs:
            return self._predict_city_gcs(city_prefix, max_patches)
        else:
            return self._predict_city_local(data_dir, city_prefix, max_patches)

    def _predict_city_gcs(self, city_prefix: str, max_patches: Optional[int]) -> Dict:
        """Clasificación usando GCS."""
        blobs = self._list_city_blobs(city_prefix, max_patches)
        if not blobs:
            return {"error": f"No se encontraron patches para '{city_prefix}' en GCS"}

        total_pixels  = {c: 0 for c in range(NUM_CLASSES)}
        total_patches = 0
        estaciones    = set()

        for blob in blobs:
            try:
                image = self._load_npy_from_gcs(blob.name)
                mask, _ = self.predict_patch_from_array(image)
                for c in range(NUM_CLASSES):
                    total_pixels[c] += int((mask == c).sum())
                total_patches += 1
                # Extraer estación del path: processed/city_spring/img_0001.npy
                parts = blob.name.split("/")
                if len(parts) >= 2:
                    estaciones.add(parts[-2])
            except Exception as e:
                print(f"Error procesando {blob.name}: {e}")
                continue

        return self._build_stats(city_prefix, total_patches, total_pixels, list(estaciones))

    def _predict_city_local(
        self, data_dir: str, city_prefix: str, max_patches: Optional[int]
    ) -> Dict:
        """Clasificación usando archivos locales (desarrollo)."""
        data_path  = Path(data_dir)
        city_dirs  = [d for d in data_path.iterdir()
                      if d.is_dir() and d.name.startswith(city_prefix)]

        if not city_dirs:
            return {"error": f"No se encontraron datos para '{city_prefix}'"}

        all_patches = []
        for city_dir in sorted(city_dirs):
            all_patches.extend(sorted(city_dir.glob("img_*.npy")))

        if max_patches:
            step        = max(1, len(all_patches) // max_patches)
            all_patches = all_patches[::step][:max_patches]

        total_pixels  = {c: 0 for c in range(NUM_CLASSES)}
        total_patches = 0

        for img_path in all_patches:
            try:
                mask, _ = self.predict_patch(str(img_path))
                for c in range(NUM_CLASSES):
                    total_pixels[c] += int((mask == c).sum())
                total_patches += 1
            except Exception as e:
                print(f"Error procesando {img_path}: {e}")
                continue

        estaciones = [d.name for d in city_dirs]
        return self._build_stats(city_prefix, total_patches, total_pixels, estaciones)

    def _build_stats(
        self, city_prefix: str, total_patches: int,
        total_pixels: Dict, estaciones: list
    ) -> Dict:
        """Construye el diccionario de estadísticas."""
        grand_total = sum(total_pixels.values())
        if grand_total == 0:
            return {"error": "No se encontraron píxeles válidos"}

        distribucion = {}
        for c in range(NUM_CLASSES):
            distribucion[CLASS_NAMES[c]] = {
                "pixeles":     total_pixels[c],
                "porcentaje":  round(100 * total_pixels[c] / grand_total, 2),
            }

        return {
            "ciudad":              city_prefix,
            "patches_clasificados": total_patches,
            "estaciones":          sorted(estaciones),
            "total_pixeles":       int(grand_total),
            "distribucion":        distribucion,
        }

    def _compute_stats(self, mask: np.ndarray) -> Dict:
        """Calcula distribución de clases de una máscara."""
        total = mask.size
        return {
            CLASS_NAMES[c]: {
                "pixeles":    int((mask == c).sum()),
                "porcentaje": round(100 * (mask == c).sum() / total, 2),
            }
            for c in range(NUM_CLASSES)
        }

    def get_available_cities(self, data_dir: str) -> list:
        """Devuelve ciudades disponibles (local o GCS)."""
        try:
            client  = self._get_gcs_client()
            bucket  = client.bucket(self.bucket_name)
            blobs   = bucket.list_blobs(prefix=f"{self.gcs_processed_prefix}/", delimiter="/")
            cities  = set()
            for page in blobs.pages:
                for prefix in page.prefixes:
                    folder = prefix.rstrip("/").split("/")[-1]
                    parts  = folder.rsplit("_", 1)
                    if len(parts) == 2:
                        cities.add(parts[0])
            return sorted(list(cities))
        except Exception:
            # Fallback a local
            data_path = Path(data_dir)
            if not data_path.exists():
                return []
            cities = set()
            for d in data_path.iterdir():
                if d.is_dir():
                    parts = d.name.rsplit("_", 1)
                    if len(parts) == 2:
                        cities.add(parts[0])
            return sorted(list(cities))
