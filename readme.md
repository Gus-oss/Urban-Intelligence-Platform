# Urban Intelligence Platform 
_**Autor:**_ Gustavo de Jesús Escobar Mata.

## Datos
Los datos corresponden al catalago de imagenes de Sentinel-2. Se utilizaron imagenes satelitales de: Amsterdam, Bangkok, Bogota, Ciudad de México, Dubai, Houston, Madrid, Monterrey , Mumbai y  Nairobi. La elección fue basada en variedad de suelos y regiones. 

## Herramientas
Se utilizo Anthropic API para realizar las consultas.

## Estructura 
```bash
Urban-Intelligence-Platform/
├── problemas_autentication_test.py     Verificar problemas de autenticación
├── .env
├── .gitignore
├── readme.md
├── requirements.txt
├── data/
│   ├── processed/                      Carpeta de datos procesados
│   └── raw/                            Carpeta de datos sin procesar
├── experiments/
├── notebooks/
└── src/
    ├── cities_config.py                Selección de las ciudades. 
    ├── data_downloader.py              Descarga las imagnees del Sentinel-2
    ├── evaluate.py                     Evaluación del modelo
    ├── get_worldcover_tiles.py         Obten los tiles de WorldCover necesarios para cubrir las ciudades
    ├── preprocessor.py                 Preprosesamiento de las imagnees
    ├── prueba_autenticación.py         Prueba de autenticación de Sentinel-2
    ├── train.py                        Entrenamiento dle modelo
    └── worldcover_downloader.py        Descarga de Titles de las imagenes
``` 