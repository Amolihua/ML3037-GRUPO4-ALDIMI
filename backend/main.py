from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List
import pandas as pd
import numpy as np
import joblib
import os
import xgboost as xgb
import io
from datetime import datetime

app = FastAPI(title="ALDIMI Predict API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "modelos", "modelosfinales")
DATA_DIR = os.path.join(BASE_DIR, "datos", "datos_modelo1", "raw")

# Cache models
models_cache = {}

def load_model(filename):
    if filename in models_cache:
        return models_cache[filename]
        
    path = os.path.join(MODEL_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model {filename} not found.")
    
    if filename.endswith('.json'):
        with open(path, 'r') as f:
            first_char = f.read(1)
            
        if first_char == '"':
            import json
            from prophet.serialize import model_from_json
            with open(path, 'r') as f:
                model = model_from_json(json.load(f))
            models_cache[filename] = model
        else:
            model = xgb.XGBRegressor()
            model.load_model(path)
            models_cache[filename] = model
    else:
        model = joblib.load(path)
        models_cache[filename] = model
        
    return models_cache[filename]

class SinglePatientRequest(BaseModel):
    features: Dict[str, Any]

@app.post("/api/predict_single_risk")
def predict_single_risk(request: SinglePatientRequest):
    try:
        risk_dict = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        model = risk_dict['model']
        le = risk_dict['label_encoder']
        df = pd.DataFrame([request.features])
        # Alinear columnas si es necesario, pero asumiremos que vienen bien
        pred_enc = model.predict(df)[0]
        pred = le.inverse_transform([pred_enc])[0]
        
        prob = None
        if hasattr(model, 'predict_proba'):
            prob = max(model.predict_proba(df)[0])
            
        return {"risk_level": pred, "probability": prob}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload_census")
async def upload_census(file: UploadFile = File(...)):
    try:
        # 1. Leer CSV de pacientes
        contents = await file.read()
        df_patients = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Eliminar columna 'Level' si existe (ya que vamos a predecirla)
        if 'Level' in df_patients.columns:
            df_patients = df_patients.drop(columns=['Level'])
            
        # 2. Predecir Riesgo de todos
        risk_dict = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        risk_model = risk_dict['model']
        le = risk_dict['label_encoder']
        
        preds_enc = risk_model.predict(df_patients)
        preds = le.inverse_transform(preds_enc)
        df_patients['Predicted_Level'] = preds
        
        # 3. Conteo
        counts = df_patients['Predicted_Level'].value_counts().to_dict()
        n_low = counts.get('Low', 0)
        n_medium = counts.get('Medium', 0)
        n_high = counts.get('High', 0)
        
        # 4. Calcular demanda matemática del día
        demanda_N02BE = n_low + n_medium + n_high
        demanda_N05B = n_medium + n_high
        demanda_M01AB = n_high
        
        # 5. Cargar Histórico para recalcular lags
        df_hist = pd.read_csv(os.path.join(DATA_DIR, "aldimi_demand_avanzado.csv"))
        df_hist['fecha'] = pd.to_datetime(df_hist['fecha'])
        df_hist = df_hist.sort_values('fecha').reset_index(drop=True)
        
        # Crear fila de hoy
        hoy = pd.Timestamp(datetime.now().date())
        # Si hoy ya está en el dataset, lo evitamos o sumamos, pero asumimos que es el censo nuevo
        nueva_fila = {
            'fecha': hoy,
            'n_low': n_low,
            'n_medium': n_medium,
            'n_high': n_high,
            'N02BE_demand': demanda_N02BE,
            'N05B_demand': demanda_N05B,
            'M01AB_demand': demanda_M01AB,
            'dia_semana': hoy.dayofweek,
            'es_fin_de_semana': 1 if hoy.dayofweek >= 5 else 0
        }
        df_hist = pd.concat([df_hist, pd.DataFrame([nueva_fila])], ignore_index=True)
        
        # 6. Preparar features para los modelos de demanda y predecir
        drugs = ['N02BE', 'N05B', 'M01AB']
        horizons = [7, 14, 60]
        demand_predictions = {}
        
        for drug in drugs:
            target_col = f'{drug}_demand'
            df_drug = df_hist.copy()
            df_drug['demanda_hoy'] = df_drug[target_col]
            df_drug['promedio_semanal'] = df_drug[target_col].rolling(7).mean()
            df_drug['promedio_mensual'] = df_drug[target_col].rolling(30).mean()
            df_drug['promedio_trimestral'] = df_drug[target_col].rolling(90).mean()
            df_drug['lag_365'] = df_drug[target_col].shift(365)
            
            # Tomar la última fila (hoy)
            ultima_fila = df_drug.iloc[-1:]
            features = ['n_low', 'n_medium', 'n_high', 'dia_semana', 'es_fin_de_semana', 
                        'demanda_hoy', 'promedio_semanal', 'promedio_mensual', 'promedio_trimestral', 'lag_365']
            
            X_pred = ultima_fila[features]
            
            # Predict horizons
            demand_predictions[drug] = {}
            for h in horizons:
                base_name = f"modelo1_demanda_{drug}_{h}dias_avanzado"
                import glob
                pattern = os.path.join(MODEL_DIR, f"{base_name}.*")
                matching_files = glob.glob(pattern)
                
                if not matching_files:
                    continue
                    
                latest_model_path = max(matching_files, key=os.path.getmtime)
                filename = os.path.basename(latest_model_path)
                
                model = load_model(filename)
                
                if type(model).__name__ == 'Prophet':
                    df_p = ultima_fila[['fecha'] + features].rename(columns={'fecha': 'ds'})
                    pred_val = model.predict(df_p)['yhat'].values[0]
                elif hasattr(model, 'forecast'):
                    pred_res = model.forecast(steps=1, exog=X_pred)
                    pred_val = pred_res.values[0] if hasattr(pred_res, 'values') else pred_res[0]
                else:
                    pred_val = model.predict(X_pred)[0]
                    
                demand_predictions[drug][f"{h}_days"] = int(round(float(pred_val)))

        return {
            "status": "success",
            "census_counts": {
                "Low": n_low,
                "Medium": n_medium,
                "High": n_high,
                "Total": len(df_patients)
            },
            "today_calculated_demand": {
                "N02BE": demanda_N02BE,
                "N05B": demanda_N05B,
                "M01AB": demanda_M01AB
            },
            "cumulative_forecasts": demand_predictions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
