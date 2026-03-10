"""
Servicio de Inferencia — Carga el modelo U-Net y clasifica imágenes satelitales.
Urban Intelligence Platform - Fase 3

Uso:
    from phase3.inference import InferenceService
    service = InferenceService("models/best_model.pth")
    mask, stats = service.predict_patch("data/processed/monterrey_mx_spring/img_0001.npy")
"""
import numpy as np
import torch
import segmentation_models_pytorch as smp
from pathlib import Path
from typing import Dict, Tuple, Optional


# Clases LULC (4 clases)
CLASS_NAMES = {
    0: "Urbano/Construido",
    1: "Vegetación/Bosque",
    2: "Agua",
    3: "Suelo desnudo/Árido"
}

NUM_CLASSES = 4


class InferenceService:
    """Carga el modelo U-Net entrenado y realiza predicciones sobre patches."""

    def __init__(self, model_path: str, device: str = None):
        """
        Args:
            model_path: Ruta al archivo best_model.pth
            device: 'cuda' o 'cpu'. Si es None, detecta automáticamente.
        """
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)

        self.model = smp.Unet(
            encoder_name="efficientnet-b3",
            encoder_weights=None,
            in_channels=6,
            classes=NUM_CLASSES
        ).to(self.device)

        state_dict = torch.load(model_path, map_location=self.device, weights_only=True)
        self.model.load_state_dict(state_dict)
        self.model.eval()

        print(f"Modelo cargado en {self.device} desde {model_path}")

    def predict_patch(self, image_path: str) -> Tuple[np.ndarray, Dict]:
        """
        Predice la máscara LULC para un patch individual.

        Args:
            image_path: Ruta al archivo .npy del patch (shape: 6, 256, 256)

        Returns:
            mask: Máscara predicha (256, 256) con valores 0-3
            stats: Diccionario con distribución de clases
        """
        image = np.load(image_path).astype(np.float32)
        tensor = torch.from_numpy(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            output = self.model(tensor)
            mask = output.argmax(dim=1).squeeze(0).cpu().numpy()

        stats = self._compute_stats(mask)
        return mask, stats

    def predict_city(self, data_dir: str, city_prefix: str) -> Dict:
        """
        Predice y agrega estadísticas para todos los patches de una ciudad.

        Args:
            data_dir: Ruta a la carpeta processed/
            city_prefix: Prefijo de la ciudad (ej: 'monterrey_mx')

        Returns:
            Diccionario con estadísticas agregadas de la ciudad
        """
        data_path = Path(data_dir)
        city_dirs = [d for d in data_path.iterdir()
                     if d.is_dir() and d.name.startswith(city_prefix)]

        if not city_dirs:
            return {"error": f"No se encontraron datos para '{city_prefix}'"}

        total_pixels = {c: 0 for c in range(NUM_CLASSES)}
        total_patches = 0

        for city_dir in sorted(city_dirs):
            for img_path in sorted(city_dir.glob("img_*.npy")):
                mask, _ = self.predict_patch(str(img_path))
                for c in range(NUM_CLASSES):
                    total_pixels[c] += (mask == c).sum()
                total_patches += 1

        grand_total = sum(total_pixels.values())
        if grand_total == 0:
            return {"error": "No se encontraron píxeles válidos"}

        stats = {
            "ciudad": city_prefix,
            "patches_analizados": total_patches,
            "estaciones": [d.name for d in city_dirs],
            "total_pixeles": int(grand_total),
            "distribucion": {}
        }

        for c in range(NUM_CLASSES):
            stats["distribucion"][CLASS_NAMES[c]] = {
                "pixeles": int(total_pixels[c]),
                "porcentaje": round(100 * total_pixels[c] / grand_total, 2)
            }

        return stats

    def _compute_stats(self, mask: np.ndarray) -> Dict:
        """Calcula la distribución de clases de una máscara."""
        total = mask.size
        stats = {}
        for c in range(NUM_CLASSES):
            count = (mask == c).sum()
            stats[CLASS_NAMES[c]] = {
                "pixeles": int(count),
                "porcentaje": round(100 * count / total, 2)
            }
        return stats

    def get_available_cities(self, data_dir: str) -> list:
        """Devuelve la lista de ciudades disponibles en el dataset."""
        data_path = Path(data_dir)
        if not data_path.exists():
            return []

        cities = set()
        for d in data_path.iterdir():
            if d.is_dir():
                # Extraer nombre de ciudad sin la estación
                # Formato: ciudad_pais_estacion (ej: monterrey_mx_spring)
                parts = d.name.rsplit("_", 1)
                if len(parts) == 2:
                    cities.add(parts[0])
        return sorted(list(cities))
