CITIES = {
    # Ciudad: (lon_min, lat_min, lon_max, lat_max)
    
    # América Latina - variedad tropical/árida
    "monterrey_mx":    (-100.50, 25.50, -100.10, 25.90),
    "ciudad_mexico":   (-99.30,  19.20,  -98.90, 19.60),
    "bogota_co":       ( -74.25,  4.45,  -74.00,  4.80),
    
    # Norteamérica - alta densidad urbana
    "houston_us":      ( -95.60, 29.60,  -95.10, 30.10),
    
    # Europa - ciudades compactas
    "madrid_es":       (  -3.85, 40.30,   -3.55, 40.55),
    "amsterdam_nl":    (   4.75, 52.30,    5.05, 52.45),
    
    # Asia - megaciudades
    "mumbai_in":       (  72.75, 18.90,   73.10, 19.20),
    "bangkok_th":      ( 100.40, 13.60,  100.90, 14.00),
    
    # África/Medio Oriente - contextos áridos
    "dubai_ae":        (  55.10, 25.05,   55.45, 25.30),
    "nairobi_ke":      (  36.70, -1.40,   37.00, -1.15),
}

# Épocas del año para capturar variación estacional
SEASONS = {
    "winter":  ("2023-01-01", "2023-02-28"),
    "spring":  ("2023-04-01", "2023-05-31"),
    "summer":  ("2023-07-01", "2023-08-31"),
    "autumn":  ("2023-10-01", "2023-11-30"),
}