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
import random


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

    def predict_city(self, data_dir: str, city_prefix: str, max_patches: Optional[int] = None) -> Dict:
        """
        Predice y agrega estadísticas para los patches de una ciudad.

        Args:
            data_dir: Ruta a la carpeta processed/
            city_prefix: Prefijo de la ciudad (ej: 'monterrey_mx')
            max_patches: Máximo de patches a procesar. None = todos.
                         Útil para CPU (50 patches) vs GPU (todos).

        Returns:
            Diccionario con estadísticas agregadas de la ciudad
        """
        data_path = Path(data_dir)
        city_dirs = [d for d in data_path.iterdir()
                     if d.is_dir() and d.name.startswith(city_prefix)]

        if not city_dirs:
            return {"error": f"No se encontraron datos para '{city_prefix}'"}

        # Recolectar todos los paths de imágenes
        all_img_paths = []
        for city_dir in sorted(city_dirs):
            for img_path in sorted(city_dir.glob("img_*.npy")):
                all_img_paths.append(img_path)

        if not all_img_paths:
            return {"error": f"No se encontraron imágenes para '{city_prefix}'"}

        # Si hay límite, tomar una muestra aleatoria representativa
        total_available = len(all_img_paths)
        is_sample = False
        if max_patches is not None and total_available > max_patches:
            random.seed(42)
            all_img_paths = random.sample(all_img_paths, max_patches)
            is_sample = True

        total_pixels = {c: 0 for c in range(NUM_CLASSES)}
        total_patches = 0

        for img_path in all_img_paths:
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
            "total_patches_disponibles": total_available,
            "es_muestra": is_sample,
            "estaciones": [d.name for d in city_dirs],
            "total_pixeles": int(grand_total),
            "distribucion": {}
        }

        if is_sample:
            stats["nota"] = (
                f"Resultado basado en una muestra de {total_patches} patches "
                f"de {total_available} disponibles. Los porcentajes son representativos."
            )

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
                parts = d.name.rsplit("_", 1)
                if len(parts) == 2:
                    cities.add(parts[0])
        return sorted(list(cities))
