import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, r2_score
from pathlib import Path
import joblib
import os

# 1. Cargar Datos
BASE_DIR = Path(".").resolve()
DATA_PATH = BASE_DIR / "datos" / "datos_modelo1" / "processed" / "aldimi_demanda_dataset_clean.csv"

if not DATA_PATH.exists():
    DATA_PATH = BASE_DIR.parent / "datos" / "datos_modelo1" / "processed" / "aldimi_demanda_dataset_clean.csv"

print(f"Buscando datos en: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
df['fecha'] = pd.to_datetime(df['fecha'])
df = df.sort_values('fecha')

print(f"Dataset cargado con {len(df)} registros.")

def preparar_datos_acumulados(df, drug, h):
    df_h = df.copy()
    
    # --- CAMBIO CLAVE: El Target es la SUMA de la demanda de los próximos 'h' días ---
    df_h['target'] = df_h[f'{drug}_demand'].rolling(window=h).sum().shift(-h)
    
    # Features de Memoria
    df_h['demanda_hoy'] = df_h[f'{drug}_demand']
    df_h['promedio_semanal'] = df_h[f'{drug}_demand'].rolling(window=7).mean()
    
    # Limpiar NAs generados por el shift y el rolling
    df_h = df_h.dropna().copy()
    
    # Definir variables predictoras
    features = ['n_low', 'n_medium', 'n_high', 'dia_semana', 'es_fin_de_semana', 
                'demanda_hoy', 'promedio_semanal']
    
    # División Cronológica
    train_size = int(len(df_h) * 0.8)
    train = df_h.iloc[:train_size]
    test = df_h.iloc[train_size:]
    
    return train[features], train['target'], test[features], test['target']

# 2. Entrenamiento y Evaluación
drugs = ['N02BE', 'N05B', 'M01AB']
horizons = [7, 14]
resultados_metricas = []

MODELS_DIR = BASE_DIR / "modelos"
if not MODELS_DIR.exists():
    os.makedirs(MODELS_DIR)

print("\nEntrenando modelos de Demanda Acumulada...")

for drug in drugs:
    for h in horizons:
        X_train, y_train, X_test, y_test = preparar_datos_acumulados(df, drug, h)
        
        model = LinearRegression()
        model.fit(X_train, y_train)
        
        y_pred = model.predict(X_test)
        
        mae = mean_absolute_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)
        
        resultados_metricas.append({
            'Medicina': drug,
            'Horizonte': f'{h}d',
            'MAE': round(mae, 2),
            'R2': round(r2, 4)
        })
        
        nombre_archivo = MODELS_DIR / f'modelo_demanda_{drug}_{h}dias_acumulado.joblib'
        joblib.dump(model, nombre_archivo)
        print(f"Modelo guardado: {nombre_archivo}")

# 3. Mostrar Tabla de Métricas
df_metricas = pd.DataFrame(resultados_metricas)
print("\n--- Metricas de los Modelos de Demanda Acumulada ---")
print(df_metricas)

df_metricas.to_csv(MODELS_DIR / 'metricas_modelos_acumulados.csv', index=False)
