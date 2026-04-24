# UrbanAI — Plataforma de Clasificación de Uso de Suelo (LULC)
**Documentación Técnica Completa del Proyecto**

*Urban Intelligence Platform — 2026-04-08*

---

## Tabla de Contenidos

1. [Descripción General del Proyecto](#1-descripción-general-del-proyecto)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Fuente de Datos: Sentinel-2](#3-fuente-de-datos-sentinel-2)
4. [Clases LULC](#4-clases-lulc)
5. [Modelo de Machine Learning](#5-modelo-de-machine-learning)
6. [Métricas de Evaluación](#6-métricas-de-evaluación)
7. [Resultados](#7-resultados)
8. [Arquitectura del Sistema](#8-arquitectura-del-sistema)
9. [API — Endpoints Disponibles](#9-api--endpoints-disponibles)
10. [Componentes Frontend](#10-componentes-frontend)
11. [Agente Conversacional y RAG](#11-agente-conversacional-y-rag)
12. [Variables de Entorno](#12-variables-de-entorno)
13. [Comandos de Arranque](#13-comandos-de-arranque)
14. [Arquitectura en Google Cloud Platform](#14-arquitectura-en-google-cloud-platform-histórica)
15. [Fases del Proyecto](#15-fases-del-proyecto)
16. [Funcionalidades Implementadas](#16-funcionalidades-implementadas)
17. [Pendientes y Trabajo Futuro](#17-pendientes-y-trabajo-futuro)
18. [Bugs Conocidos y Soluciones](#18-bugs-conocidos-y-soluciones)
19. [Referencias](#19-referencias)

---

# 1. Descripción General del Proyecto

**UrbanAI** es una plataforma de clasificación de uso y cobertura del suelo (*Land Use Land Cover*, LULC) que combina imágenes satelitales Sentinel-2, un modelo de segmentación semántica basado en redes neuronales profundas, un agente conversacional con recuperación de información augmentada (RAG), y un frontend interactivo con visualización geoespacial.

El objetivo central de la plataforma es permitir a usuarios — desde investigadores hasta tomadores de decisiones urbanas — clasificar automáticamente el uso del suelo en cualquier ciudad del mundo, comparar zonas geográficas, analizar distribuciones de cobertura y, en su fase de extensión actual, estimar el impacto en calidad del aire ante escenarios de expansión urbana usando datos de Sentinel-5P.

## 1.1 Versión Actual

| Parámetro | Valor |
|---|---|
| Versión | Phase 5 — Final |
| Última sesión | 2026-04-06 |
| Estado GCP | ELIMINADO (proyecto borrado para evitar costos) |
| Entorno Python | `urban_intel_env` (Windows) |

---

# 2. Stack Tecnológico

## 2.1 Backend

| Componente | Tecnología |
|---|---|
| Framework API | FastAPI |
| Agente conversacional | LangChain |
| Modelo de lenguaje | Anthropic Claude `claude-sonnet-4-20250514` |
| Runtime ML | PyTorch |
| Librería de segmentación | `segmentation-models-pytorch` |
| Embeddings semánticos | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Base de datos vectorial | ChromaDB (28 fragmentos indexados) |
| Proveedor de imágenes satelitales | Sentinel Hub (OAuth2 Client Credentials) |

## 2.2 Frontend

| Componente | Tecnología |
|---|---|
| Framework UI | React + Vite |
| Visualización de mapas | Mapbox GL JS |
| Estilo de mapa base | Satellite Streets v12 |
| Geocodificación | Mapbox Geocoding API v5 |
| Isocronas | Mapbox Isochrone API v1 |

## 2.3 Infraestructura (estado histórico — GCP eliminado)

El proyecto fue desplegado en Google Cloud Platform durante fases de desarrollo. Actualmente corre completamente en local. La sección de arquitectura GCP se documenta para referencia futura en caso de redespliegue.

---

# 3. Fuente de Datos: Sentinel-2

## 3.1 Descripción del Sensor

Sentinel-2 es una misión de observación terrestre de la Agencia Espacial Europea (ESA), parte del programa Copernicus. Proporciona imágenes multiespectrales de alta resolución ideal para análisis de cobertura del suelo.

### 3.1.1 Ciudades de Entrenamiento

| Ciudad | País | Característica climática |
|---|---|---|
| Amsterdam | Países Bajos | Oceánico, alta vegetación |
| Bangkok | Tailandia | Tropical húmedo, ríos |
| Bogotá | Colombia | Altiplano, zona montañosa |
| Dubai | Emiratos Árabes | Árido, expansión urbana rápida |
| Houston | EE.UU. | Subtropical, ciudad extensa |
| Madrid | España | Mediterráneo continental |
| Ciudad de México | México | Altiplano, megaciudad |
| Monterrey | México | Semiárido, montañoso |
| Mumbai | India | Monzónico, costera |
| Nairobi | Kenia | Tropical de altitud |

La diversidad geográfica y climática de las ciudades es intencional: garantiza que el modelo aprenda características LULC que generalicen a cualquier ubicación analizada mediante el endpoint `/analyze-location`.

## 3.2 Características Técnicas

| Parámetro | Valor |
|---|---|
| Resolución espacial | 10 m / pixel (bandas RGB + NIR) |
| Resolución temporal | 5 días (revisita) |
| Bandas utilizadas | B02 (Azul), B03 (Verde), B04 (Rojo), B08 (NIR) |
| Tipo de dato | Reflectancia de superficie (TOA / BOA) |
| Formato de descarga | GeoTIFF |
| Rango de valores | 0.0 – 1.0 (reflectancia normalizada) |
| Cobertura de nubes | Se descarta imagen si supera umbral definido |
| Proveedor de acceso | Copernicus Dataspace|

> A parti del 22/04/2026 se dejo de utilizar Sentinel Hub (OAuth2) y se cambio por Copernicus Dataspace

## 3.3 Preprocesamiento de Imágenes (Queda pendiente de cambiar)

Las imágenes se obtienen mediante el servicio Sentinel Hub, que entrega los recortes geográficos ya ortorrectificados y en reflectancia de superficie. El pipeline de preprocesamiento incluye:

1. Definición del bounding box a partir de coordenadas (lat, lng) y tamaño en km.
2. Solicitud mediante `SentinelHubService.get_image_for_location()`.
3. Filtrado por porcentaje máximo de cobertura de nubes (`max_cloud_coverage`).
4. Conversión a patches de 256×256 píxeles con solapamiento para inferencia.
5. Normalización de valores entre 0 y 1.

## 3.4 Estructura del Patch de Entrenamiento

Cada patch de entrenamiento tiene dimensiones `[4, 256, 256]` (4 bandas, 256×256 píxeles). El label correspondiente es una máscara de segmentación `[256, 256]` con valores enteros de 0 a 3.

```
patch.shape  → (4, 256, 256)   # [B, H, W] — 4 bandas espectrales
mask.shape   → (256, 256)      # etiqueta de clase por píxel
```

---

# 4. Clases LULC

La plataforma clasifica cada píxel en una de las siguientes cuatro categorías:

| ID | Clase | Color HEX | Descripción |
|---|---|---|---|
| 0 | Urbano / Construido | `#ff6b6b` | Edificios, calles, infraestructura impermeable |
| 1 | Vegetación / Bosque | `#51cf66` | Áreas verdes, parques, bosques, cultivos |
| 2 | Agua | `#339af0` | Cuerpos de agua, ríos, lagos, costas |
| 3 | Suelo desnudo / Árido | `#ffd43b` | Desiertos, zonas sin cobertura vegetal, tierra expuesta |

> **Nota:** La clase *Industrial* fue explorada pero presenta IoU = 0.0 en la versión actual del modelo. Está pendiente de reentrenamiento con class weights para corregir el desbalance de clases.

---

# 5. Modelo de Machine Learning

## 5.1 Arquitectura: U-Net + EfficientNet-B3

### 5.1.1 U-Net

U-Net es una arquitectura de red neuronal convolucional diseñada originalmente para segmentación semántica de imágenes médicas (Ronneberger et al., 2015). Su estructura en forma de "U" consiste en:

- **Encoder (contracción):** extrae features jerárquicas mediante bloques convolucionales y capas de pooling, reduciendo progresivamente la resolución espacial.
- **Decoder (expansión):** reconstruye la resolución espacial original mediante upsampling y convoluciones transpuestas.
- **Skip connections:** conexiones directas entre capas simétricas del encoder y decoder que preservan información espacial de alta resolución, fundamental para segmentación precisa.

La operación central del encoder puede expresarse como:

$$
\mathbf{F}_{l+1} = \text{MaxPool}\left(\text{Conv}_{3\times3}\left(\text{Conv}_{3\times3}\left(\mathbf{F}_l\right)\right)\right)
$$

Y el decoder realiza la operación inversa mediante convolución transpuesta:

$$
\mathbf{F}'_{l-1} = \text{Conv}_{3\times3}\left(\text{Concat}\left(\text{UpConv}_{2\times2}\left(\mathbf{F}'_l\right),\ \mathbf{F}_{l-1}\right)\right)
$$

donde $\mathbf{F}_{l-1}$ proviene del skip connection del encoder.

### 5.1.2 EfficientNet-B3 como Backbone

EfficientNet-B3 reemplaza el encoder estándar de U-Net. Es una familia de redes diseñada mediante *compound scaling* (Tan & Le, 2019), que escala simultáneamente la profundidad, anchura y resolución de la red de manera balanceada. Las ventajas sobre un encoder vanilla son:

- **Mayor capacidad representacional** con menos parámetros que ResNet-50 o VGG-16.
- **Preentrenamiento en ImageNet** que acelera la convergencia y mejora generalización.
- **Balance eficiencia/precisión** óptimo para imágenes satelitales multibanda.

La integración se realiza a través de la librería `segmentation-models-pytorch`:

```python
import segmentation_models_pytorch as smp

model = smp.Unet(
    encoder_name="efficientnet-b3",
    encoder_weights="imagenet",
    in_channels=4,          # 4 bandas Sentinel-2
    classes=4,              # 4 clases LULC
    activation=None         # logits crudos para CrossEntropyLoss
)
```

## 5.2 Datos de Entrenamiento

El conjunto de datos se dividió en **70% entrenamiento, 15% validación y 15% evaluación**

| Parámetro | Valor |
|---|---|
| Arquitectura | U-Net + EfficientNet-B3 |
| Optimizer | AdamW (lr = 1×10⁻⁴) |
| LR Scheduler | Cosine Annealing |
| Loss function | CrossEntropy + Dice (50/50) |
| Batch size | 16 |
| Épocas | 50 |
| Early Stopping | Patience = 10 |

### Configuración del dataset

| Parámetro | Valor |
|---|---|
| Total de patches | 105,652 |
| Tamaño de patch | 256 × 256 píxeles |
| Bandas de entrada | 6 (B02 – B12) |
| Ciudades incluidas | 10 |
| Semilla | 42 |
| Stride | 128 px (50% solapamiento) |
| Estaciones | 4 |

## 5.3 Función de Pérdida

Se utiliza `CrossEntropyLoss` estándar de PyTorch para clasificación multiclase:

$$
\mathcal{L}_{CE} = -\frac{1}{N}\sum_{i=1}^{N}\sum_{c=0}^{C-1} y_{ic} \cdot \log\hat{p}_{ic}
$$

donde $y_{ic}$ es la etiqueta one-hot del píxel $i$ para la clase $c$, y $\hat{p}_{ic}$ es la probabilidad predicha.

> **Pendiente:** Reentrenamiento con `class_weight` inversamente proporcional a la frecuencia de cada clase, especialmente para la clase *Industrial* que presenta IoU = 0.0 por desbalance severo.

---

# 6. Métricas de Evaluación

## 6.1 mIoU — Mean Intersection over Union

### Definición

La métrica principal del proyecto es el **mIoU** (*mean Intersection over Union*), también conocida como índice de Jaccard promediado sobre clases. Mide el solapamiento entre la máscara predicha y la máscara real para cada clase, promediando sobre todas las clases.

Para una clase $c$:

$$
\text{IoU}_c = \frac{|\hat{M}_c \cap M_c|}{|\hat{M}_c \cup M_c|} = \frac{TP_c}{TP_c + FP_c + FN_c}
$$

donde $TP_c$ son los verdaderos positivos, $FP_c$ los falsos positivos y $FN_c$ los falsos negativos para la clase $c$.

El mIoU promedia sobre las $C$ clases:

$$
\text{mIoU} = \frac{1}{C}\sum_{c=0}^{C-1}\text{IoU}_c
$$

### Interpretación

| Rango mIoU | Calidad del modelo |
|---|---|
| > 0.80 | Excelente |
| 0.65 – 0.80 | Bueno |
| 0.50 – 0.65 | Aceptable |
| < 0.50 | Insuficiente |

## 6.2 Métricas Secundarias

Adicionalmente se monitorean durante entrenamiento:

- **Pixel Accuracy:** fracción de píxeles correctamente clasificados (menos informativa que mIoU ante desbalance de clases).
- **Loss de validación:** para detectar sobreajuste.
- **Loss de entrenamiento:** para monitorear convergencia.


# 7. Resultados 
| Metrica | Valor |
| --- | --- |
| Número de clases | 4 | 
| Muestras de prueba | 22,639 |
| Test Loss | 0.2019 | 
| mIoU | 0.8239 |
| Mean F1 | 0.9000 |
| Exactitud global (pixel) | 92.6\%
| Tiempo (segundos) | 1,201.89 |


El resultado obtenido para mIoU caé en la catergoria de  **Excelente**, considerando que el modelo opera sobre 4 bandas de imágenes satelitales reales con variabilidad climática, estacional y geográfica alta.

## 7.1 IoU por Clase para el conjunto de prueba

| Clase | IoU  | Precisión | Recall | F1
|---|---|---|---|---|
| Urbano / Construido | 0.7536 | 0.8472 | 0.8691 | 0.8576 |
| Vegetación / Bosque | 0.8804 | 0.9367 | 0.9355 | 0.9360 |
| Agua | 0.8686 | 0.9322 | 0.9162 | 0.9231 | 
| Suelo desnudo / Árido | 0.7931 | 0.8902 | 0.8767 | 0.8832|

La clase Agua y Vegetación son las mejor clasificadas; Agua tiene buena separabilidad espectral; Suelo árido presenta mayor confusión con zonas urbanas de baja densidad.
---

# 8. Arquitectura del Sistema

## 8.1 Diagrama de Componentes

```
┌────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)            │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐  │
│  │  Map.jsx │ │CityCard  │ │ Isochrone │ │Floating  │  │
│  │ (Mapbox) │ │  .jsx    │ │ Panel.jsx │ │Chat.jsx  │  │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘  │
│       └────────────┴─────────────┴────────────┘        │
│                         App.jsx                        │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / REST
┌──────────────────────────▼──────────────────────────────┐
│                  BACKEND (FastAPI)                      │
│  ┌──────────────┐   ┌────────────────┐                  │
│  │  phase3/     │   │  phase5/       │                  │
│  │  api.py      │   │  api.py        │                  │
│  │  (base)      │◄──│  (extensión)   │                  │
│  └──────┬───────┘   └───────┬────────┘                  │
│         │                   │                           │
│  ┌──────▼───────┐   ┌───────▼────────┐                  │
│  │  U-Net +     │   │  SentinelHub   │                  │
│  │  EfficientB3 │   │  Service       │                  │
│  │  (PyTorch)   │   │  (OAuth2)      │                  │
│  └──────────────┘   └────────────────┘                  │
│                                                         │
│  ┌──────────────────────────────────────────┐           │
│  │  LangChain Agent + ChromaDB (RAG)        │           │
│  │  Claude claude-sonnet-4-20250514 (LLM)   │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              APIS EXTERNAS                              │
│  Sentinel Hub · Mapbox · Anthropic API · ERA5           │
└─────────────────────────────────────────────────────────┘
```

## 8.2 Estructura de Archivos del Proyecto

```
Urban-Intelligence-Platform/
├── problemas_autentication_test.py                 Verificar problemas de autenticación
├── .env
├── .gitignore
├── readme.md
├── requirements.txt 
├── notebooks/
├── experiments/  
├── Dockerfile.backend                              Backend para la phase5 
├── Dockerfile.frontend                             Frontend para la phase5
├── nginx.conf                                      Para la phase5
├── cloudbuild.yaml                                 Para la phase5 con GCP
├── deploy.sh                                       Para la phase5 con GCP 
├── documentation                                   Doucmentación del proyecto completo
├── references                                      Articulos de referencias para el proyecto
├── images/
│    ├── images_readme                              Imagenes mostradas en el readme              
│    └── images_test                                Imagenes prueba para subir a la plataforma
├── data/
│    ├── chroma_db/ 
│    ├── processed/                                 Carpeta de datos procesados
│    └── raw/                                       Carpeta de datos sin procesar 
├──  models/
│    ├── best_model.pth                             Mejor modelo obtenido
│    ├── lulc_cache.json                            Cache  
│    └── results_test_results.json                  Evaluacion del modelo 
├──  docs/
│    └── knowledge/
│        ├── doc_onu_habitat_estandares.txt   
│        ├── doc_lulc_sentinel2.txt  
│        └── doc_ciudades_perfil.txt                            
└── src/
    ├── cities_config.py                            Selección de las ciudades. 
    ├── data_downloader.py                          Descarga las imagnees del Sentinel-2
    ├── evaluate.py                                 Evaluación del modelo
    ├── get_worldcover_tiles.py                     Obten los tiles de WorldCover para las ciudades
    ├── preprocessor.py                             Preprosesamiento de las imagnees
    ├── prueba_autenticación.py                     Prueba de autenticación de Sentinel-2
    ├── train.py                                    Entrenamiento de modelo
    ├── worldcover_downloader.py                    Descarga de Titles de las imagenes  
    ├── phase3/                                     Fase de implementación de agentes con Anthropic
    │    ├── _init_.py
    │    ├── agent.py 
    │    ├── api.py
    │    ├── inference.py
    │    ├── rag.py
    │    └── tools.py
    ├── phase4/                                     Fase de Frontend
    │    ├── package.json                            
    │    ├── vite.config.js
    │    ├── index.html
    │    ├── main.jsx
    │    ├── App.jsx 
    │    └── components/
    │          ├── Map.jsx
    │          ├── FloatingChat.jsx
    │          ├── CityCard.jsx
    │          ├── SearchPanel.jsx
    │          ├── IsochronePanel.jsx 
    │          └── UploadModal.jsx
    └── phase5/
         ├── __init__.py
         ├── api.py
         ├── sentinel_hub.py
         └── inference_gcs.py
```

---

# 9. API — Endpoints Disponibles

## 9.1 Tabla de Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/health` | Estado del modelo y del agente |
| `POST` | `/chat` | Agente LangChain. Body: `{message: string, city: string\|null}` |
| `GET` | `/cities` | Lista de ciudades precargadas disponibles |
| `GET` | `/stats/{city}` | Metadata de una ciudad específica |
| `GET` | `/classify/{city}` | Clasificar ciudad con U-Net (ciudades precargadas) |
| `POST` | `/upload-classify` | Upload de imagen propia → clasificación LULC |
| `GET` | `/rankings` | Rankings LULC entre ciudades (lee `lulc_cache.json`) |
| `POST` | `/analyze-location` | Análisis de cualquier ubicación via Sentinel Hub |
| `GET` | `/sentinel/status` | Estado de conexión OAuth2 con Sentinel Hub |

## 9.2 Detalle: `/analyze-location`

Este endpoint es el corazón de la funcionalidad de Phase 5. Permite analizar cualquier ubicación del mundo mediante descarga dinámica de imágenes Sentinel-2.

**Parámetros de entrada:**

| Parámetro | Tipo | Descripción |
|---|---|---|
| `lat` | `float` | Latitud del punto central |
| `lng` | `float` | Longitud del punto central |
| `address` | `string` | Dirección legible (para display) |
| `size_km` | `float` | Tamaño del área en km (lado del cuadrado) |
| `max_cloud_coverage` | `float` | Porcentaje máximo de nubes tolerado |
| `days_back` | `int` | Días hacia atrás para buscar imagen |

**Respuesta:**

```json
{
  "address": "string",
  "lat": 0.0,
  "lng": 0.0,
  "size_km": 10.0,
  "meta": { "fecha": "...", "cobertura_nubes": 0.05 },
  "bbox": [lng_min, lat_min, lng_max, lat_max],
  "distribucion": {
    "Urbano/Construido": 0.45,
    "Vegetación/Bosque": 0.30,
    "Agua": 0.05,
    "Suelo desnudo/Árido": 0.20
  },
  "mask_flat": [0, 1, 2, ...],
  "mask_size": [H, W],
  "original_base64": "iVBORw0KGgo..."
}
```

---

# 10. Componentes Frontend

## 10.1 Estado Global (`App.jsx`)

| Variable de estado | Tipo | Descripción |
|---|---|---|
| `locationA` | `object\|null` | Ciudad/ubicación primaria en panel A |
| `locationB` | `object\|null` | Ciudad/ubicación secundaria en panel B |
| `mapTarget` | `object\|null` | Destino del mapa `{lat, lng, ts}` — campo `ts: Date.now()` fuerza re-render |
| `isochroneState` | `object` | Estado de isocronas activas |
| `showSearch` | `boolean` | Visibilidad del panel de búsqueda |
| `showCompare` | `boolean` | Modo comparación A/B |
| `showUpload` | `boolean` | Modal de upload visible |
| `showIsochrone` | `boolean` | Panel de isocronas visible |

## 10.2 Mapa (`Map.jsx`)

- Estilo base: `mapbox://styles/mapbox/satellite-streets-v12`
- Proyección: globo 3D habilitado
- Overlay LULC: renderizado sin parpadeo usando `updateImage()` + `useRef` para `prevOverlay` (compara antes de redibujar)
- Isocronas: renderizadas como polígonos o líneas según configuración del usuario

## 10.3 Diseño Visual

### Tipografía

| Uso | Fuente |
|---|---|
| Display / Títulos | Syne |
| Monoespaciado / Datos | Space Mono |

### Paleta de Colores

| Token | HEX | Uso |
|---|---|---|
| `bg_deep` | `#04080d` | Fondo principal de la app |
| `accent` | `#00d4ff` | Color de acento primario |
| `green` | `#00ff88` | Indicadores positivos |
| `amber` | `#ffaa00` | Alertas / valores medios |
| `red` | `#ff4444` | Alertas críticas |

### Colores de Isocronas por Modo

| Modo | Color | HEX |
|---|---|---|
| Walking (a pie) | Blanco | `#f0f0f0` |
| Cycling (bicicleta) | Rosa-rojo | `#ff2d78` |
| Driving (auto) | Carmesí | `#b30000` |
| Driving-traffic (tráfico) | Violeta | `#9b00e8` |

### Colores de Anillos de Isocrona

| Distancia / Tiempo | Color |
|---|---|
| 5 min / 1 km | `#ff3300` |
| 10 min / 5 km | `#ffe000` |
| 15 min / 25 km | `#00cfff` |
| 30 min / 100 km | `#4040ff` |

---

# 11. Agente Conversacional y RAG

## 11.1 Arquitectura RAG

El agente conversacional de UrbanAI implementa *Retrieval-Augmented Generation* (RAG) con los siguientes componentes:

| Componente | Implementación |
|---|---|
| LLM base | Anthropic Claude `claude-sonnet-4-20250514` |
| Framework de agente | LangChain |
| Modelo de embeddings | `paraphrase-multilingual-MiniLM-L12-v2` |
| Base de datos vectorial | ChromaDB |
| Número de fragmentos indexados | 28 |
| Idioma del corpus | Español + Inglés |

## 11.2 Funcionamiento

El agente recibe cada mensaje del usuario junto con el contexto de la ciudad activa (`city`). Realiza búsqueda semántica en ChromaDB para recuperar los fragmentos más relevantes de la documentación técnica, y los inyecta en el contexto del LLM antes de generar la respuesta. Esto permite respuestas contextualizadas sobre estadísticas LULC específicas de cada ciudad.

El endpoint `/chat` acepta:

```json
{
  "message": "¿Cuál es el porcentaje de vegetación en Amsterdam?",
  "city": "Amsterdam"
}
```

> **Bug resuelto:** El campo correcto es `message`, no `question`. Cambiar este campo en el body del request causaba error 422 Unprocessable Entity.

---

# 12. Variables de Entorno

| Variable | Descripción | Ubicación |
|---|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) | `.env` backend |
| `SENTINEL_HUB_CLIENT_ID` | OAuth2 Client ID de Sentinel Hub | `.env` backend |
| `SENTINEL_HUB_CLIENT_SECRET` | OAuth2 Client Secret de Sentinel Hub | `.env` backend |
| `VITE_MAPBOX_TOKEN` | Token público de Mapbox | `src/phase4/.env` |
| `USE_GCS` | `false` local, `true` para Cloud Run | `.env` backend |
| `GCS_BUCKET` | `urban-intelligence-lulc` (solo Cloud Run) | `.env` backend |

---

# 13. Comandos de Arranque

```bash
# 1. Activar entorno y levantar backend (desde raíz del proyecto)
cd Urban-Intelligence-Platform
.\urban_intel_env\Scripts\activate
uvicorn src.phase5.api:app --reload --port 8000

# 2. Levantar frontend (nueva terminal)
cd Urban-Intelligence-Platform\src\phase4
npm run dev

# 3. Exponer frontend con ngrok (opcional, para acceso externo)
ngrok http 3000 --request-header-add "ngrok-skip-browser-warning: true"
```

---

# 14. Arquitectura en Google Cloud Platform

> **Estado actual:** El proyecto GCP fue eliminado en abril de 2026 para evitar costos. Esta sección documenta la arquitectura como referencia para un posible redespliegue en Cloud Run.

## 14.1 Componentes GCP Utilizados

| Servicio | Uso en el proyecto |
|---|---|
| **Cloud Run** | Despliegue del backend FastAPI como contenedor serverless |
| **Google Cloud Storage (GCS)** | Almacenamiento de imágenes clasificadas y modelos |
| **Secret Manager** | Gestión segura de credenciales (API keys, OAuth2) |
| **Artifact Registry** | Registro de imágenes Docker |
| **Cloud Build** | Pipeline de CI/CD para build y despliegue automático |

## 14.2 Características de la VM (Cloud Run)

Cloud Run no utiliza VMs tradicionales sino contenedores gestionados. Las características configuradas fueron:

| Parámetro | Valor |
|---|---|
| Tipo de recurso | Cloud Run (serverless) |
| CPU | 2 vCPU |
| Memoria RAM | 4 GB |
| Timeout máximo de request | 120 segundos (para inferencia de modelos grandes) |
| Concurrencia | 1 request por instancia (modelo ML no thread-safe) |
| Región | `us-central1` |
| Autoescalado mínimo | 0 instancias (cold start) |
| Autoescalado máximo | 3 instancias |
| Variable `USE_GCS` | `true` en Cloud Run |

## 14.3 Características de Google Cloud Storage

| Parámetro | Valor |
|---|---|
| Nombre del bucket | `urban-intelligence-lulc` |
| Clase de almacenamiento | Standard |
| Región | `us-central1` (misma que Cloud Run) |
| Control de acceso | Uniform (IAM) |
| Contenido almacenado | Máscaras LULC exportadas, imágenes clasificadas, `lulc_cache.json`, pesos del modelo |
| Acceso desde backend | `google-cloud-storage` SDK con Application Default Credentials |

## 14.4 Instrucciones de Redespliegue (Referencia)

Si en el futuro se requiere redespliegue en GCP:

1. Recrear el proyecto GCP y habilitar las APIs: Cloud Run, GCS, Secret Manager, Artifact Registry, Cloud Build.
2. Almacenar todas las credenciales en Secret Manager (no en variables de entorno directas).
3. Subir `best_model.pth` al bucket GCS y configurar la ruta en el backend.
4. Construir la imagen Docker con `gcloud builds submit`.
5. Desplegar en Cloud Run con `gcloud run deploy`.
6. Configurar `USE_GCS=true` y `GCS_BUCKET=urban-intelligence-lulc` como variables de entorno en Cloud Run.

---

# 15. Fases del Proyecto

## Phase 1 — Exploración y Dataset

Descarga de imágenes Sentinel-2 para las 10 ciudades de entrenamiento. Generación de etiquetas LULC semisupervisadas. Construcción del pipeline de patches con solapamiento. Análisis exploratorio de distribuciones de clase.

## Phase 2 — Entrenamiento del Modelo

Implementación de U-Net con backbone EfficientNet-B3 usando `segmentation-models-pytorch`. Entrenamiento sobre los 150,932 patches con `CrossEntropyLoss`. Evaluación con mIoU. Selección del mejor modelo: `models/best_model.pth`.

**Resultado alcanzado:** mIoU = 0.8239

## Phase 3 — API Base

Desarrollo del backend FastAPI con los endpoints para las 10 ciudades precargadas. Integración del agente LangChain con ChromaDB para el chat contextual. Implementación del campo `message` en `ChatRequest`. Exportación de `get_inference_service()`.

## Phase 4 — Frontend Interactivo

Desarrollo del dashboard React + Vite + Mapbox GL JS. Implementación del mapa satelital con overlay LULC sin parpadeo. Cards flotantes A y B con navegación. Comparación simultánea de dos ciudades. Panel de isocronas multi-modo (walking, cycling, driving, driving-traffic) en minutos o metros, como polígonos o líneas. Modal de upload para imágenes propias. Chat flotante conectado al agente.

## Phase 5 — Búsqueda Dinámica (Estado Actual)

Extensión del backend con `SentinelHubService` (OAuth2 Client Credentials). Endpoint `/analyze-location` para clasificar cualquier ubicación del mundo. Endpoint `/sentinel/status`. Panel de búsqueda con Mapbox Geocoding. Integración del flujo: búsqueda → descarga Sentinel-2 → inferencia U-Net → overlay en mapa.

## Phase 6 — Sentinel-5P (Próxima)

Integración de datos de contaminación NO₂ y CO de Sentinel-5P. Modelo predictivo para estimar concentraciones ante escenarios de expansión urbana. Panel de simulación de escenarios en el frontend. Capa de heatmap de contaminación sobre el mapa Mapbox.

---

# 16. Funcionalidades Implementadas

1. Clasificación LULC de 10 ciudades precargadas (Phase 3).
2. Búsqueda dinámica de cualquier ciudad del mundo via Sentinel Hub (Phase 5).
3. Overlay de máscara LULC sobre mapa satelital Mapbox sin parpadeo.
4. Cards flotantes A y B con población via agente + distribución de área verde.
5. Navegación entre ciudades con click en header de card (`onFlyTo`).
6. Comparación simultánea de dos ciudades (modo A/B).
7. Isocronas multi-modo: walking, cycling, driving, driving-traffic.
8. Isocronas configurables en minutos o metros.
9. Isocronas como polígonos rellenos o líneas de contorno.
10. Múltiples modos de isocrona activos simultáneamente.
11. Upload y clasificación de imágenes propias (`.npy`, `.tif`, `.jpg`, `.png`).
12. Chat flotante UrbanAI conectado al agente LangChain con RAG.
13. Reloj UTC en header de la aplicación.

---

# 17. Pendientes y Trabajo Futuro

| Tarea | Prioridad | Descripción |
|---|---|---|
| Sentinel-5P — capa NO₂/CO | Alta | Acordado con Dr. — integrar datos de contaminación como nueva capa sobre el mapa |
| Reentrenamiento con class weights | Alta | La clase Industrial tiene IoU = 0.0 por desbalance severo; requiere `class_weight` inversamente proporcional a frecuencia |
| Redespliegue GCP | Media | Si se requiere despliegue en la nube, usar Cloud Run + Secret Manager (no variables de entorno directas) |
| Polígonos OSM reales | Baja | Reemplazar bounding boxes rectangulares con boundaries reales de ciudades desde OpenStreetMap |

---

# 18. Bugs Conocidos y Soluciones

| Bug | Causa | Solución Implementada |
|---|---|---|
| `ChatRequest` campo incorrecto | Usaba `question` en lugar de `message` | Corregido en `phase3/api.py` — campo `message` |
| Parpadeo del overlay LULC | Re-renderizado innecesario del canvas en cada update | Usar `updateImage()` + `useRef` para `prevOverlay` comparando antes de redibujar |
| `SearchPanel` cortado | Posicionado con `absolute` dentro del header (overflow hidden) | Mover a `position: fixed` desde `App.jsx` |
| Upload devuelve respuesta vacía | `response.json()` fallaba antes de leer el body | Leer `.text()` antes de `.json()` + `AbortController` con timeout de 120s |
| `useRef not defined` | Importación faltante en `App.jsx` | Agregar `useRef` al import de React |
| Sentinel Hub error 401 | Se intentaba usar API Key simple | Sentinel Hub requiere OAuth2 Client Credentials — implementado en `SentinelHubService` |
| Error Method Not Allowed en `/analyze-location` | `fetch` con método `GET` en lugar de `POST` | Corregir a `method: 'POST'` en el cliente |
| `flyTo` repetido sin efecto | `useEffect` no se disparaba si `mapTarget` tenía los mismos valores | Agregar campo `ts: Date.now()` al objeto `mapTarget` para forzar re-render |

---

# 19. Referencias

- Ronneberger, O., Fischer, P., & Brox, T. (2015). *U-Net: Convolutional Networks for Biomedical Image Segmentation*. MICCAI 2015.
- Tan, M., & Le, Q. V. (2019). *EfficientNet: Rethinking Model Scaling for Convolutional Neural Networks*. ICML 2019.
- European Space Agency. (2024). *Sentinel-2 User Handbook*. ESA.
- European Space Agency. (2024). *Sentinel-5P Product User Manual — TROPOMI NO2*. ESA.
- Copernicus Open Access Hub. https://scihub.copernicus.eu/
- Sentinel Hub Documentation. https://docs.sentinel-hub.com/
- Mapbox GL JS Documentation. https://docs.mapbox.com/mapbox-gl-js/
- LangChain Documentation. https://python.langchain.com/
- segmentation-models-pytorch. https://github.com/qubvel/segmentation_models.pytorch

---

# Fecha: 22/04/2026
Cambie de Sentinel Hub a Copernicus Data Space, debido a que se termino la capa gratuita. 
Las modificaciones se realizaron al .env y al codigo sentinel_hub.py de la carpeta phase 5 sel src. Texto con antigravity

*Documentación generada el 08 de abril de 2026. Proyecto en desarrollo activo — Phase 6 (Sentinel-5P) en planificación.*
