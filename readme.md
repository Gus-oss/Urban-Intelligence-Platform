# Urban Intelligence Platform 
_**Autor:**_ Gustavo de Jesús Escobar Mata.

## Datos
Los datos corresponden al catalago de imagenes de Sentinel-2. Se utilizaron imagenes satelitales de: Amsterdam, Bangkok, Bogota, Ciudad de México, Dubai, Houston, Madrid, Monterrey , Mumbai y  Nairobi. La elección fue basada en variedad de suelos y regiones. 

## Herramientas
Se utilizo Anthropic API para realizar las consultas. FastApi (/chat, /predict, /cities, /stats). Agente LangChain con 3 tools funcionando. Modelo U-Net como servicio de inferencia.

## Estructura 
```bash
Urban-Intelligence-Platform/
├── problemas_autentication_test.py                  Verificar problemas de autenticación
├── .env
├── .gitignore
├── readme.md
├── requirements.txt
├── data/
│   ├── chroma_db/ 
│   ├── processed/                                  Carpeta de datos procesados
│   └── raw/                                        Carpeta de datos sin procesar
├── experiments/
├──  models/
│    ├── best_model.pth                             Mejor modelo obtenido
│    └── results_test_results.json                  Evaluacion del modelo                  
├── notebooks/
├──  docs/
│    └── knowledge/
│            ├── doc_onu_habitat_estandares.txt   
│            ├── doc_lulc_sentinel2.txt  
│            └── doc_ciudades_perfil.txt               
└── src/
    ├── phase3                                      Fase de implementación de agentes con Anthropic
    │   ├── _init_.py
    │   ├── agent.py 
    │   ├── api.py
    │   ├── inference.py
    │   ├── rag.py
    │   └── tools.py
    ├── cities_config.py                            Selección de las ciudades. 
    ├── data_downloader.py                          Descarga las imagnees del Sentinel-2
    ├── evaluate.py                                 Evaluación del modelo
    ├── get_worldcover_tiles.py                     Obten los tiles de WorldCover para las ciudades
    ├── preprocessor.py                             Preprosesamiento de las imagnees
    ├── prueba_autenticación.py                     Prueba de autenticación de Sentinel-2
    ├── train.py                                    Entrenamiento de modelo
    └── worldcover_downloader.py                    Descarga de Titles de las imagenes  
```