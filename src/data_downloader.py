# src/data_downloader.py

import os
import time
from pathlib import Path
from dotenv import load_dotenv
from cdsetool.credentials import Credentials
from cdsetool.query import query_features
from cdsetool.download import download_features
import geopandas as gpd
from shapely.geometry import box

load_dotenv()

class Sentinel2Downloader:
    
    def __init__(self, output_dir: str = "data/raw"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        self.credentials = Credentials(
            os.getenv("COPERNICUS_USER"),
            os.getenv("COPERNICUS_PASSWORD")
        )
    
    def build_polygon(self, bbox: tuple) -> str:
        """Convierte bbox (lon_min, lat_min, lon_max, lat_max) a WKT."""
        lon_min, lat_min, lon_max, lat_max = bbox
        return box(lon_min, lat_min, lon_max, lat_max).wkt
    
    def download_city_season(
        self, 
        city_name: str, 
        bbox: tuple, 
        date_start: str, 
        date_end: str,
        max_cloud_cover: int = 10
    ):
        """Descarga imágenes para una ciudad y temporada específica."""
        
        city_dir = self.output_dir / city_name
        city_dir.mkdir(exist_ok=True)
        
        print(f"\n📡 Buscando imágenes: {city_name} | {date_start} → {date_end}")
        
        features = list(query_features(
            "Sentinel2",
            {
                "startDate": date_start,
                "completionDate": date_end,
                "processingLevel": "S2MSI2A",      # Level-2A = ya corregido atmosféricamente
                "cloudCover": f"[0,{max_cloud_cover}]",
                "geometry": self.build_polygon(bbox),
            }
        ))
        
        if not features:
            print(f"  ⚠️  Sin imágenes disponibles para {city_name} en este período")
            return 0
        
        # Toma solo la mejor imagen (menor nubosidad)
        best = sorted(
            features, 
            key=lambda x: x["properties"].get("cloudCover", 100)
        )[0]
        
        cloud_pct = best["properties"].get("cloudCover", "?")
        print(f"  ✅ Mejor imagen encontrada — Nubosidad: {cloud_pct}%")
        
        download_features(
            iter([best]),
            city_dir,
            {"credentials": self.credentials}
        )
        
        return 1
    
    def download_all(self, cities: dict, seasons: dict):
        """Descarga todas las ciudades y estaciones."""
        
        total = len(cities) * len(seasons)
        downloaded = 0
        failed = []
        
        for city_name, bbox in cities.items():
            for season_name, (date_start, date_end) in seasons.items():
                
                try:
                    result = self.download_city_season(
                        f"{city_name}_{season_name}",
                        bbox,
                        date_start,
                        date_end
                    )
                    downloaded += result
                    time.sleep(2)  # Respeta rate limits de la API
                    
                except Exception as e:
                    print(f"  ❌ Error en {city_name}/{season_name}: {e}")
                    failed.append(f"{city_name}_{season_name}")
        
        print(f"\n{'='*50}")
        print(f"Descarga completa: {downloaded}/{total} exitosas")
        if failed:
            print(f"Fallidas: {failed}")
        
        return downloaded, failed


# Script de ejecución
if __name__ == "__main__":
    from cities_config import CITIES, SEASONS
    
    downloader = Sentinel2Downloader()
    downloader.download_all(CITIES, SEASONS)