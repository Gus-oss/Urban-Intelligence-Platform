# Despues de descargar las ciudades, este codigo me permite obtener los tiles de WorldCover necesarios para cubrir las ciudades. 
# WorldCover usa tiles de 3x3 grados, asi que este codigo redondea las coordenadas de las ciudades al múltiplo de 3 más cercano 
# hacia abajo para obtener los nombres de los tiles necesarios. 
# Al final, imprime los tiles necesarios por ciudad y el total de tiles únicos a descargar.
from cities_config import CITIES
import math

def bbox_to_worldcover_tiles(bbox):
    """
    WorldCover usa tiles de 3x3 grados nombrados como N/S + latitud, E/W + longitud.
    Ejemplo: N25W101 para Monterrey
    """
    lon_min, lat_min, lon_max, lat_max = bbox
    tiles = set()

    for lat in [lat_min, lat_max]:
        for lon in [lon_min, lon_max]:
            # Redondear al múltiplo de 3 hacia abajo
            tile_lat = int(math.floor(lat / 3) * 3)
            tile_lon = int(math.floor(lon / 3) * 3)

            lat_str = f"N{abs(tile_lat):02d}" if tile_lat >= 0 else f"S{abs(tile_lat):02d}"
            lon_str = f"E{abs(tile_lon):03d}" if tile_lon >= 0 else f"W{abs(tile_lon):03d}"

            tiles.add(f"{lat_str}{lon_str}")

    return tiles

print("Tiles WorldCover necesarios por ciudad:\n")
all_tiles = set()
for city, bbox in CITIES.items():
    tiles = bbox_to_worldcover_tiles(bbox)
    all_tiles.update(tiles)
    print(f"  {city:20s}: {tiles}")

print(f"\nTotal tiles únicos a descargar: {len(all_tiles)}")
print(f"Tiles: {sorted(all_tiles)}")