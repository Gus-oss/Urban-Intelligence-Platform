# test_search.py — pon en la raíz y ejecuta
import requests
import certifi
import os
from dotenv import load_dotenv

load_dotenv()

session = requests.Session()
session.verify = certifi.where()

# Autenticar
token_response = session.post(
    "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
    data={
        "client_id": "cdse-public",
        "username": os.getenv("COPERNICUS_USER"),
        "password": os.getenv("COPERNICUS_PASSWORD"),
        "grant_type": "password",
    },
    timeout=30
)
token = token_response.json()["access_token"]
session.headers.update({"Authorization": f"Bearer {token}"})

# Query simplificado al máximo
filter_query = (
    "Collection/Name eq 'SENTINEL-2' and "
    "ContentDate/Start gt 2023-01-01T00:00:00.000Z and "
    "ContentDate/Start lt 2023-02-28T23:59:59.000Z and "
    "OData.CSC.Intersects(area=geography'SRID=4326;POLYGON((-100.5 25.5,-100.1 25.5,-100.1 25.9,-100.5 25.9,-100.5 25.5))')"
)

params = {
    "$filter": filter_query,
    "$top": 3,
    "$orderby": "ContentDate/Start desc"
}

response = session.get(
    "https://catalogue.dataspace.copernicus.eu/odata/v1/Products",
    params=params,
    timeout=120
)

print(f"Status: {response.status_code}")
print(f"Respuesta: {response.text[:500]}")