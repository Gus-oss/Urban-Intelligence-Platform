# src/preprocessor.py

import os
import sys
import shutil
import zipfile
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

sys.path.append(str(Path(__file__).parent))
from cities_config import CITIES

RAW_DIR        = Path("data/raw")
PROCESSED_DIR  = Path("data/processed")
WORLDCOVER_DIR = RAW_DIR / "worldcover"

PATCH_SIZE = 256
STRIDE     = 128

BANDS = ["B02", "B03", "B04", "B08", "B11", "B12"]

WC_TO_CLASS = {
    10: 1, 20: 1, 30: 1, 95: 1, 100: 1,
    80: 2, 90: 2, 70: 2,
    50: 0,
    40: 4, 60: 4,
}


def unzip_safe(zip_path: Path, dest_dir: Path) -> Path:

    safe_name = zip_path.stem
    safe_path = dest_dir / safe_name

    if safe_path.exists():
        print(f"    Ya descomprimido: {safe_name}")
        return safe_path

    print(f"    Descomprimiendo: {zip_path.name}")
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(dest_dir)

    return safe_path


def find_band_file(safe_dir: Path, band: str) -> Path:

    for res in ["R10m", "R20m", "R60m"]:
        matches = list(safe_dir.rglob(f"*_{band}_{res[:3]}*.jp2"))
        if matches:
            return matches[0]

    matches = list(safe_dir.rglob(f"*_{band}_*.jp2"))
    if matches:
        return matches[0]

    return None


def load_and_stack_bands(safe_dir: Path):

    b04_path = find_band_file(safe_dir, "B04")
    if b04_path is None:
        raise FileNotFoundError(f"No se encontro B04 en {safe_dir}")

    with rasterio.open(b04_path) as ref:
        ref_shape     = ref.shape
        ref_transform = ref.transform
        ref_crs       = ref.crs
        ref_profile   = ref.profile.copy()

    stacked = []

    for band in BANDS:
        band_path = find_band_file(safe_dir, band)
        if band_path is None:
            raise FileNotFoundError(f"No se encontro {band} en {safe_dir}")

        with rasterio.open(band_path) as src:
            if src.shape != ref_shape:
                data = np.zeros(ref_shape, dtype=np.float32)
                reproject(
                    source=rasterio.band(src, 1),
                    destination=data,
                    src_transform=src.transform,
                    src_crs=src.crs,
                    dst_transform=ref_transform,
                    dst_crs=ref_crs,
                    resampling=Resampling.bilinear
                )
            else:
                data = src.read(1).astype(np.float32)

            data = np.clip(data / 10000.0, 0, 1)
            stacked.append(data)

    image = np.stack(stacked, axis=0)
    return image, ref_profile


def load_worldcover_mask(city_name: str, ref_profile: dict, target_shape: tuple) -> np.ndarray:

    base_city = "_".join(city_name.split("_")[:-1])

    if base_city not in CITIES:
        raise ValueError(f"Ciudad no encontrada en config: {base_city}")

    lon_min, lat_min, lon_max, lat_max = CITIES[base_city]
    center_lat = (lat_min + lat_max) / 2
    center_lon = (lon_min + lon_max) / 2

    import math
    tile_lat = int(math.floor(center_lat / 3) * 3)
    tile_lon = int(math.floor(center_lon / 3) * 3)

    lat_str = f"N{abs(tile_lat):02d}" if tile_lat >= 0 else f"S{abs(tile_lat):02d}"
    lon_str = f"E{abs(tile_lon):03d}" if tile_lon >= 0 else f"W{abs(tile_lon):03d}"
    tile_id = f"{lat_str}{lon_str}"

    wc_path = WORLDCOVER_DIR / f"ESA_WorldCover_10m_2021_v200_{tile_id}_Map.tif"

    if not wc_path.exists():
        raise FileNotFoundError(f"Tile WorldCover no encontrado: {wc_path}")

    mask_data = np.zeros(target_shape, dtype=np.uint8)

    with rasterio.open(wc_path) as wc:
        reproject(
            source=rasterio.band(wc, 1),
            destination=mask_data,
            src_transform=wc.transform,
            src_crs=wc.crs,
            dst_transform=ref_profile["transform"],
            dst_crs=ref_profile["crs"],
            resampling=Resampling.nearest
        )

    return mask_data


def remap_mask(mask: np.ndarray) -> np.ndarray:
    remapped = np.full_like(mask, 255, dtype=np.uint8)
    for wc_val, class_val in WC_TO_CLASS.items():
        remapped[mask == wc_val] = class_val
    return remapped


def extract_patches(image: np.ndarray, mask: np.ndarray) -> list:

    _, H, W = image.shape
    patches  = []

    for y in range(0, H - PATCH_SIZE + 1, STRIDE):
        for x in range(0, W - PATCH_SIZE + 1, STRIDE):
            img_patch  = image[:, y:y+PATCH_SIZE, x:x+PATCH_SIZE]
            mask_patch = mask[y:y+PATCH_SIZE, x:x+PATCH_SIZE]

            nodata_ratio = np.mean(mask_patch == 255)
            if nodata_ratio > 0.5:
                continue

            if img_patch.mean() < 0.01:
                continue

            patches.append((img_patch, mask_patch))

    return patches


def process_scene(scene_dir: Path):

    scene_name = scene_dir.name
    out_dir    = PROCESSED_DIR / scene_name

    if out_dir.exists() and len(list(out_dir.glob("img_*.npy"))) > 0:
        n = len(list(out_dir.glob("img_*.npy")))
        print(f"  Ya procesada: {scene_name} ({n} patches)")
        return n

    print(f"\nProcesando: {scene_name}")

    zips = list(scene_dir.glob("*.zip"))
    if not zips:
        print(f"  Sin .zip en {scene_dir}")
        return 0

    zip_path  = zips[0]
    safe_dir  = None
    patches   = []

    try:
        safe_dir = unzip_safe(zip_path, scene_dir)

        print(f"    Cargando bandas...")
        image, ref_profile = load_and_stack_bands(safe_dir)
        print(f"    Imagen: {image.shape} | dtype: {image.dtype}")

        print(f"    Cargando WorldCover...")
        raw_mask = load_worldcover_mask(scene_name, ref_profile, image.shape[1:])
        mask     = remap_mask(raw_mask)

        clases, counts = np.unique(mask[mask != 255], return_counts=True)
        print(f"    Clases: {dict(zip(clases.tolist(), counts.tolist()))}")

        print(f"    Extrayendo patches...")
        patches = extract_patches(image, mask)
        print(f"    Patches validos: {len(patches)}")

        # Libera RAM antes de escribir a disco
        del image, raw_mask, mask

        if len(patches) == 0:
            print(f"    Sin patches validos")
            return 0

        out_dir.mkdir(parents=True, exist_ok=True)
        for i, (img_patch, mask_patch) in enumerate(patches):
            np.save(out_dir / f"img_{i:04d}.npy",  img_patch)
            np.save(out_dir / f"mask_{i:04d}.npy", mask_patch)

        print(f"    Guardados: {len(patches)} patches en {out_dir}")

    except Exception as e:
        print(f"    Error durante procesamiento: {e}")
        # Borra output parcial si hubo error
        if out_dir.exists():
            shutil.rmtree(out_dir)
        return 0

    finally:
        # Borra el .SAFE siempre, haya error o no
        if safe_dir is not None and safe_dir.exists():
            shutil.rmtree(safe_dir)
            libre_gb = shutil.disk_usage(".").free / 1024**3
            print(f"    .SAFE borrado | Espacio libre: {libre_gb:.1f} GB")

    return len(patches)


def main():

    scenes = [d for d in RAW_DIR.iterdir()
              if d.is_dir() and d.name != "worldcover"]

    print(f"Escenas encontradas: {len(scenes)}")
    print("=" * 50)

    total_patches = 0
    failed        = []

    for scene_dir in sorted(scenes):
        try:
            n = process_scene(scene_dir)
            total_patches += n
        except Exception as e:
            print(f"  Error en {scene_dir.name}: {e}")
            failed.append(scene_dir.name)

    print("\n" + "=" * 50)
    print(f"Preprocesamiento completo")
    print(f"Total patches generados: {total_patches}")
    print(f"Escenas fallidas: {len(failed)}")
    if failed:
        for f in failed:
            print(f"  - {f}")


if __name__ == "__main__":
    main()