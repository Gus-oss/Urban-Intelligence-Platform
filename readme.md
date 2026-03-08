# Urban Intelligence Platform 


_**Autor:**_ Gustavo de Jesús Escobar Mata.

## Estructura 
```bash
Urban-Intelligence-Platform/
├── .env
├── .gitignore
├── readme.md
├── requirements.txt
├── data/
│   ├── processed/               Carpeta de datos procesados
│   └── raw/                     Carpeta de datos sin procesar
├── experiments/
├── notebooks/
└── src/
    ├── cities_config.py         Selección de las ciudades. 
    ├── data_downloader.py       Descarga las imagnees del Sentinel-2
    ├── evaluate.py              Evaluación del modelo
    ├── get_worldcover_tiles.py  Obten los tiles de WorldCover necesarios para cubrir las ciudades
    ├── preprocessor.py          Preprosesamiento de las imagnees
    ├── prueba_autenticación.py  Prueba de autenticación de Sentinel-2
    ├── train.py                 Entrenamiento dle modelo
    └── worldcover_downloader.py Descarga de Titles de las imagenes
``` 