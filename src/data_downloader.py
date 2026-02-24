# Despues de configurar las ciudades, este codigo me permite descargarlas de Sentinel-2 con autenticación, 
# búsqueda por nubosidad y progreso visible.

import os
import time
import requests
import certifi
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

class Sentinel2Downloader:

    TOKEN_URL    = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
    SEARCH_URL   = "https://catalogue.dataspace.copernicus.eu/odata/v1/Products"
    DOWNLOAD_URL = "https://zipper.dataspace.copernicus.eu/odata/v1/Products"

    def __init__(self, output_dir: str = "data/raw"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.user     = os.getenv("COPERNICUS_USER")
        self.password = os.getenv("COPERNICUS_PASSWORD")
        self.session  = requests.Session()
        self.session.verify = certifi.where()
        self.token = None
        self._authenticate()

    def _authenticate(self):
        """Obtiene token de acceso."""
        print(" Autenticando...")
        response = self.session.post(
            self.TOKEN_URL,
            data={
                "client_id":  "cdse-public",
                "username":   self.user,
                "password":   self.password,
                "grant_type": "password",
            },
            timeout=30
        )
        if response.status_code != 200:
            raise Exception(f"Auth falló: {response.text}")

        self.token = response.json()["access_token"]
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(" Autenticación exitosa\n")

    def _refresh_token_if_needed(self):
        """Reautentica antes de cada descarga para evitar expiración."""
        self._authenticate()

    def search_images(self, bbox, date_start, date_end, max_cloud=10):
        """Busca imágenes via OData con query simplificado."""

        lon_min, lat_min, lon_max, lat_max = bbox
        polygon = (
            f"POLYGON(({lon_min} {lat_min},{lon_max} {lat_min},"
            f"{lon_max} {lat_max},{lon_min} {lat_max},{lon_min} {lat_min}))"
        )

        filter_query = (
            f"Collection/Name eq 'SENTINEL-2' and "
            f"ContentDate/Start gt {date_start}T00:00:00.000Z and "
            f"ContentDate/Start lt {date_end}T23:59:59.000Z and "
            f"OData.CSC.Intersects(area=geography'SRID=4326;{polygon}')"
        )

        params = {
            "$filter":  filter_query,
            "$orderby": "ContentDate/Start desc",
            "$top":     20,
            "$expand":  "Attributes"
        }

        response = self.session.get(
            self.SEARCH_URL, params=params, timeout=120
        )

        if response.status_code != 200:
            print(f"    Error en búsqueda: {response.status_code}")
            return []

        products = response.json().get("value", [])

        # Filtrar por tipo L2A y nubosidad manualmente
        filtered = []
        for p in products:
            if "MSIL2A" not in p.get("Name", ""):
                continue

            cloud = next(
                (a["Value"] for a in p.get("Attributes", [])
                 if a.get("Name") == "cloudCover"), 100
            )

            if float(cloud) <= max_cloud:
                p["_cloudCover"] = float(cloud)
                filtered.append(p)

        # Ordenar por menor nubosidad
        filtered.sort(key=lambda x: x["_cloudCover"])
        return filtered

    def download_image(self, product_id, product_name, dest_dir: Path):
        """Descarga una imagen con progreso visible en MB."""

        dest_dir.mkdir(parents=True, exist_ok=True)
        zip_path = dest_dir / f"{product_name}.zip"

        # Si ya existe y tiene tamaño real, saltar
        if zip_path.exists() and zip_path.stat().st_size > 1_000_000:
            print(f"   Descargado: {zip_path.name}")
            return True

        url = f"{self.DOWNLOAD_URL}({product_id})/$value"

        print(f"  Descargando: {product_name[:60]}...")

        # Refresca token antes de cada descarga
        self._refresh_token_if_needed()

        try:
            response = self.session.get(url, stream=True, timeout=300)

            if response.status_code != 200:
                print(f"   Error HTTP {response.status_code}: {response.text[:100]}")
                return False

            total_bytes = int(response.headers.get("content-length", 0))
            total_mb    = total_bytes / 1024 / 1024

            downloaded = 0
            start_time = time.time()
            last_print = 0

            with open(zip_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

                        # Imprime progreso cada 50MB
                        if downloaded - last_print >= 50 * 1024 * 1024:
                            elapsed = time.time() - start_time
                            speed   = (downloaded / 1024 / 1024) / elapsed if elapsed > 0 else 0
                            pct     = (downloaded / total_bytes * 100) if total_bytes else 0
                            print(f"    {downloaded/1024/1024:.0f}/{total_mb:.0f} MB "
                                  f"({pct:.1f}%) — {speed:.1f} MB/s")
                            last_print = downloaded

            final_size = zip_path.stat().st_size / 1024 / 1024
            print(f"   Completado: {final_size:.1f} MB → {zip_path}")
            return True

        except Exception as e:
            print(f"   Error durante descarga: {e}")
            if zip_path.exists():
                zip_path.unlink()
            return False

    def download_city_season(self, city_name, bbox, date_start, date_end, max_cloud=10):

        city_dir = self.output_dir / city_name
        print(f"\n {city_name} | {date_start} → {date_end}")

        results = self.search_images(bbox, date_start, date_end, max_cloud)

        if not results:
            print(f"    Sin imágenes disponibles con nubosidad <{max_cloud}%")
            return 0

        best         = results[0]
        product_id   = best["Id"]
        product_name = best["Name"]
        cloud        = best["_cloudCover"]

        print(f"    Nubosidad: {cloud}% — {product_name[:60]}")

        success = self.download_image(product_id, product_name, city_dir)
        return 1 if success else 0

    def download_all(self, cities, seasons):
        """Descarga todas las ciudades y estaciones."""

        total      = len(cities) * len(seasons)
        downloaded = 0
        failed     = []

        for city_name, bbox in cities.items():
            for season_name, (date_start, date_end) in seasons.items():
                try:
                    result = self.download_city_season(
                        f"{city_name}_{season_name}",
                        bbox, date_start, date_end
                    )
                    downloaded += result
                    time.sleep(3)

                except Exception as e:
                    print(f"   Error {city_name}/{season_name}: {e}")
                    failed.append(f"{city_name}_{season_name}")

        print(f"\n{'='*50}")
        print(f" Descarga completa: {downloaded}/{total}")
        if failed:
            print(f" Fallidas: {failed}")

        return downloaded, failed


if __name__ == "__main__":
    from cities_config import CITIES, SEASONS

    downloader = Sentinel2Downloader()
    downloader.download_all(CITIES, SEASONS)