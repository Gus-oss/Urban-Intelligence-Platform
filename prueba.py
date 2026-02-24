import os
import requests
import certifi
from dotenv import load_dotenv

load_dotenv()

user = os.getenv("COPERNICUS_USER")
pwd  = os.getenv("COPERNICUS_PASSWORD")

print(f"Usuario cargado: {user}")
print(f"Password cargado: {'✅ Sí' if pwd else '❌ No encontrado'}")

# Sesión con certificados explícitos
session = requests.Session()
session.verify = certifi.where()

# Test 1: Internet
try:
    r = session.get("https://www.google.com", timeout=10)
    print(f"Internet: ✅ OK ({r.status_code})")
except Exception as e:
    print(f"Internet: ❌ {e}")

# Test 2: Servidor Copernicus
try:
    r = session.get(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/.well-known/openid-configuration",
        timeout=30
    )
    print(f"Servidor Copernicus: ✅ OK ({r.status_code})")
except Exception as e:
    print(f"Servidor Copernicus: ❌ {e}")

# Test 3: Autenticación
try:
    response = session.post(
        "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        data={
            "client_id": "cdse-public",
            "username":  user,
            "password":  pwd,
            "grant_type": "password",
        },
        timeout=30
    )
    
    if response.status_code == 200:
        print("Autenticación: ✅ Credenciales correctas")
    elif response.status_code == 401:
        print(f"Autenticación: ❌ Credenciales incorrectas")
        print(f"  Detalle: {response.json().get('error_description', '')}")
    else:
        print(f"Autenticación: ⚠️ Status {response.status_code}")
        print(f"  {response.text[:200]}")

except Exception as e:
    print(f"Autenticación: ❌ {e}")