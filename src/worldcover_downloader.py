# Despues de saber cuales tiles descargar, este script se encarga de descargarlos desde el servidor de ESA WorldCover.
# Usa requests para descargar cada tile, mostrando el progreso de descarga. 
# Si el tile ya existe localmente y tiene un tamaño razonable, lo omite. 
# Al final, imprime un resumen de la descarga.

import os
import time
import requests
import certifi
from pathlib import Path

os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
os.environ["SSL_CERT_FILE"]      = certifi.where()

TILES = [
    'N03W075', 'N12E099', 'N18E072', 'N18W099', 'N18W102',
    'N24E054', 'N24W102', 'N27W096', 'N30W096', 'N39W006',
    'N51E003', 'S03E036'
]

OUTPUT_DIR = Path("data/raw/worldcover")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL  = "https://esa-worldcover.s3.amazonaws.com/v200/2021/map"
MAX_RETRY = 5

session = requests.Session()
session.verify = certifi.where()


def download_tile(tile: str, max_retries: int = MAX_RETRY) -> bool:

    filename = f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
    url      = f"{BASE_URL}/{filename}"
    out_path = OUTPUT_DIR / filename
    tmp_path = OUTPUT_DIR / f"{filename}.part"

    if out_path.exists() and out_path.stat().st_size > 1_000_000:
        print(f"Ya existe: {filename}")
        return True

    for attempt in range(1, max_retries + 1):

        try:
            # Reanuda desde donde quedo si existe archivo parcial
            headers = {}
            resume_pos = 0
            if tmp_path.exists():
                resume_pos = tmp_path.stat().st_size
                headers["Range"] = f"bytes={resume_pos}-"
                print(f"  Reanudando desde {resume_pos / 1024 / 1024:.1f} MB")

            response = session.get(
                url,
                headers=headers,
                stream=True,
                timeout=60
            )

            if response.status_code == 404:
                print(f"  Tile no encontrado en servidor: {tile}")
                return False

            if response.status_code not in (200, 206):
                print(f"  Error HTTP {response.status_code} — intento {attempt}/{max_retries}")
                time.sleep(5 * attempt)
                continue

            total_bytes = int(response.headers.get("content-length", 0)) + resume_pos
            total_mb    = total_bytes / 1024 / 1024
            downloaded  = resume_pos
            last_print  = resume_pos
            start_time  = time.time()

            mode = "ab" if resume_pos > 0 else "wb"

            with open(tmp_path, mode) as f:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)

                        if downloaded - last_print >= 30 * 1024 * 1024:
                            elapsed = time.time() - start_time
                            speed   = ((downloaded - resume_pos) / 1024 / 1024) / elapsed if elapsed > 0 else 0
                            pct     = (downloaded / total_bytes * 100) if total_bytes else 0
                            print(f"    {downloaded/1024/1024:.0f}/{total_mb:.0f} MB ({pct:.1f}%) - {speed:.1f} MB/s")
                            last_print = downloaded

            # Renombra de .part a .tif cuando termina bien
            tmp_path.rename(out_path)
            final_mb = out_path.stat().st_size / 1024 / 1024
            print(f"  Completado: {final_mb:.1f} MB -> {out_path.name}")
            return True

        except KeyboardInterrupt:
            print(f"\n  Descarga pausada. El archivo parcial se guardo en {tmp_path}")
            print(f"  Vuelve a ejecutar el script para reanudar.")
            raise

        except Exception as e:
            print(f"  Error en intento {attempt}/{max_retries}: {e}")
            time.sleep(5 * attempt)

    print(f"  Fallo despues de {max_retries} intentos: {tile}")
    return False


print(f"Descargando {len(TILES)} tiles WorldCover\n")
print("=" * 50)

exitosos = 0
fallidos = []

for tile in TILES:
    print(f"\nTile: {tile}")
    success = download_tile(tile)
    if success:
        exitosos += 1
    else:
        fallidos.append(tile)

print("\n" + "=" * 50)
print(f"Completado: {exitosos}/{len(TILES)} tiles")
if fallidos:
    print(f"Fallidos: {fallidos}")