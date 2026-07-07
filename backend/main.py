from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import joblib
import os
import xgboost as xgb
import io
import datetime
import glob
import jwt
import bcrypt

from sqlalchemy.orm import Session
from database import get_db, engine, Base
from models import Usuario, Paciente, Historial, Medicamento
import analytics

app = FastAPI(title="ALDIMI Predict API", version="2.0")

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

# --- AUTHENTICATION ---
SECRET_KEY = "aldimi_secret_key_super_segura"
ALGORITHM = "HS256"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/api/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# --- SIMULATED TIME ---
class SimulationState:
    current_date = datetime.date.today()

@app.get("/api/date")
def get_date():
    return {"date": SimulationState.current_date.strftime("%Y-%m-%d")}

@app.post("/api/avanzar_dia")
def avanzar_dia(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Obs. 2: al avanzar el día se recalcula el censo activo (que ya refleja
    # fallecimientos / altas registrados) y se re-proyecta la demanda.
    SimulationState.current_date += datetime.timedelta(days=1)
    n_low, n_medium, n_high = _censo_activo(db)
    forecasts = None
    try:
        forecasts, _ = calculate_future_demand(n_low, n_medium, n_high)
    except Exception:
        forecasts = None
    return {
        "status": "success",
        "new_date": SimulationState.current_date.strftime("%Y-%m-%d"),
        "census": {"Low": n_low, "Medium": n_medium, "High": n_high, "Total": n_low + n_medium + n_high},
        "forecasts": forecasts,
    }

# --- ML MODELS CACHE ---
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

def calculate_future_demand(n_low, n_medium, n_high):
    # Calcular demanda matemática del día
    demanda_N02BE = n_low + n_medium + n_high
    demanda_N05B = n_medium + n_high
    demanda_M01AB = n_high
    
    df_hist = pd.read_csv(os.path.join(DATA_DIR, "aldimi_demand_avanzado.csv"))
    df_hist['fecha'] = pd.to_datetime(df_hist['fecha'])
    df_hist = df_hist.sort_values('fecha').reset_index(drop=True)
    
    hoy = pd.Timestamp(SimulationState.current_date)
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
        
        ultima_fila = df_drug.iloc[-1:]
        features = ['n_low', 'n_medium', 'n_high', 'dia_semana', 'es_fin_de_semana', 
                    'demanda_hoy', 'promedio_semanal', 'promedio_mensual', 'promedio_trimestral', 'lag_365']
        
        X_pred = ultima_fila[features]
        demand_predictions[drug] = {}
        for h in horizons:
            base_name = f"modelo1_demanda_{drug}_{h}dias_avanzado"
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
            
    return demand_predictions, {"N02BE": demanda_N02BE, "N05B": demanda_N05B, "M01AB": demanda_M01AB}


def _censo_activo(db: Session):
    """Cuenta pacientes activos (dado_de_alta==0) por su último riesgo predicho."""
    pacientes_activos = db.query(Paciente).filter(Paciente.dado_de_alta == 0).all()
    n_low = n_medium = n_high = 0
    for p in pacientes_activos:
        h = db.query(Historial).filter(Historial.paciente_dni == p.dni).order_by(Historial.fecha.desc()).first()
        if h:
            if h.riesgo_predicho == 'Low':
                n_low += 1
            elif h.riesgo_predicho == 'Medium':
                n_medium += 1
            elif h.riesgo_predicho == 'High':
                n_high += 1
    if len(pacientes_activos) > 0 and (n_low + n_medium + n_high == 0):
        n_low = len(pacientes_activos)
    return n_low, n_medium, n_high


# --- ANALYTICS ENDPOINTS (observaciones del profesor) ---

@app.get("/api/variables_criticas")
def get_variables_criticas(top: int = 10, current_user: Usuario = Depends(get_current_user)):
    """Obs. 1: variables críticas de los modelos de riesgo y de demanda."""
    try:
        risk = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        riesgo = analytics.variables_criticas_riesgo(risk, top=top)
        df_hist = pd.read_csv(os.path.join(DATA_DIR, "aldimi_demand_avanzado.csv"))
        demanda = analytics.variables_criticas_demanda(MODEL_DIR, df_hist, horizonte=7)
        return {"riesgo": riesgo, "demanda": demanda}
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/demanda_por_criticidad")
def get_demanda_por_criticidad(nivel: Optional[str] = None, db: Session = Depends(get_db),
                               current_user: Usuario = Depends(get_current_user)):
    """Obs. 4: desglose del consumo diario por nivel de criticidad (con filtro opcional)."""
    n_low, n_medium, n_high = _censo_activo(db)
    por_nivel = analytics.consumo_por_nivel(n_low, n_medium, n_high)
    conteos = {"Low": n_low, "Medium": n_medium, "High": n_high}
    filas = []
    for niv in ["Low", "Medium", "High"]:
        if nivel and niv != nivel:
            continue
        filas.append({"criticidad": niv, "n_pacientes": conteos[niv], **por_nivel[niv]})
    return {
        "censo": {**conteos, "Total": n_low + n_medium + n_high},
        "por_criticidad": filas,
        "total_diario": analytics.consumo_diario_total(n_low, n_medium, n_high),
    }


class SimulacionRequest(BaseModel):
    ingreso: Dict[str, int] = {}
    egreso: Dict[str, int] = {}
    fallecimiento: Dict[str, int] = {}


@app.post("/api/simular_poblacion")
def simular_poblacion(req: SimulacionRequest, db: Session = Depends(get_db),
                      current_user: Usuario = Depends(get_current_user)):
    """Obs. 2 y 5: ¿cómo cambia la proyección si ingresan/egresan/fallecen albergados?"""
    bl, bm, bh = _censo_activo(db)

    def g(d, k):
        return int(d.get(k, 0) or 0)

    sl = max(0, bl + g(req.ingreso, 'Low') - g(req.egreso, 'Low') - g(req.fallecimiento, 'Low'))
    sm = max(0, bm + g(req.ingreso, 'Medium') - g(req.egreso, 'Medium') - g(req.fallecimiento, 'Medium'))
    sh = max(0, bh + g(req.ingreso, 'High') - g(req.egreso, 'High') - g(req.fallecimiento, 'High'))

    meds = {m.codigo: m for m in db.query(Medicamento).all()}
    horizontes = [7, 14, 60]
    proyeccion = []
    for drug in analytics.DRUGS:
        ppc = meds[drug].pastillas_por_caja if drug in meds else 100
        precio = meds[drug].precio_caja if drug in meds else 0.0
        item = {"medicamento": drug, "nombre": meds[drug].nombre if drug in meds else drug,
                "pastillas_por_caja": ppc}
        for h in horizontes:
            base = analytics.proyeccion_determinista(bl, bm, bh, h)[drug]
            sim = analytics.proyeccion_determinista(sl, sm, sh, h)[drug]
            base_cajas = analytics.cajas(base, ppc)
            sim_cajas = analytics.cajas(sim, ppc)
            item[f"h{h}"] = {
                "base_pastillas": base, "sim_pastillas": sim,
                "base_cajas": base_cajas, "sim_cajas": sim_cajas,
                "delta_cajas": sim_cajas - base_cajas,
                "delta_costo": round((sim_cajas - base_cajas) * precio, 2),
            }
        proyeccion.append(item)

    ml = None
    try:
        ml_base, _ = calculate_future_demand(bl, bm, bh)
        ml_sim, _ = calculate_future_demand(sl, sm, sh)
        ml = {"base": ml_base, "sim": ml_sim}
    except Exception:
        ml = None

    return {
        "censo_base": {"Low": bl, "Medium": bm, "High": bh, "Total": bl + bm + bh},
        "censo_simulado": {"Low": sl, "Medium": sm, "High": sh, "Total": sl + sm + sh},
        "proyeccion": proyeccion,
        "forecast_ml": ml,
    }


# --- PATIENTS ENDPOINTS ---
class SinglePatientRequest(BaseModel):
    features: Dict[str, Any]

@app.post("/api/predict_single_risk")
def predict_single_risk(request: SinglePatientRequest, current_user: Usuario = Depends(get_current_user)):
    try:
        risk_dict = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        model = risk_dict['model']
        le = risk_dict['label_encoder']
        df = pd.DataFrame([request.features])
        pred_enc = model.predict(df)[0]
        pred = le.inverse_transform([pred_enc])[0]
        
        prob = None
        if hasattr(model, 'predict_proba'):
            prob = max(model.predict_proba(df)[0])
            
        return {"risk_level": pred, "probability": prob}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PacienteManualRequest(BaseModel):
    dni: str
    nombre: str
    features: Dict[str, Any]

@app.post("/api/pacientes/manual")
def add_paciente_manual(req: PacienteManualRequest, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    import json
    try:
        # Predecir riesgo
        risk_dict = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        model = risk_dict['model']
        le = risk_dict['label_encoder']
        df = pd.DataFrame([req.features])
        pred_enc = model.predict(df)[0]
        riesgo = le.inverse_transform([pred_enc])[0]
        
        # Upsert Paciente
        paciente = db.query(Paciente).filter(Paciente.dni == req.dni).first()
        if not paciente:
            paciente = Paciente(dni=req.dni, nombre=req.nombre, ingreso=SimulationState.current_date, dado_de_alta=0)
            db.add(paciente)
        else:
            paciente.nombre = req.nombre
            paciente.dado_de_alta = 0
            
        paciente.metricas = json.dumps(req.features)
        
        # Historial
        hist = Historial(paciente_dni=req.dni, fecha=SimulationState.current_date, riesgo_predicho=riesgo)
        db.add(hist)
        
        db.commit()
        return {"status": "success", "riesgo_predicho": riesgo}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload_census")
async def upload_census(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    try:
        contents = await file.read()
        df_patients = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        identities = None
        if 'DNI' in df_patients.columns and 'Nombre' in df_patients.columns:
            identities = df_patients[['DNI', 'Nombre']]
            df_patients = df_patients.drop(columns=['DNI', 'Nombre'])
            
        if 'Level' in df_patients.columns:
            df_patients = df_patients.drop(columns=['Level'])
            
        risk_dict = load_model("modelo_riesgo_pacientes_avanzado.joblib")
        risk_model = risk_dict['model']
        le = risk_dict['label_encoder']
        
        preds_enc = risk_model.predict(df_patients)
        preds = le.inverse_transform(preds_enc)
        
        # Guardar en BD si hay identidades
        if identities is not None:
            csv_dnis = set()
            import json
            for i, row in identities.iterrows():
                dni = str(row['DNI'])
                nombre = row['Nombre']
                riesgo = preds[i]
                csv_dnis.add(dni)
                
                features_dict = df_patients.iloc[i].to_dict()
                
                # Update or Create Paciente
                paciente = db.query(Paciente).filter(Paciente.dni == dni).first()
                if not paciente:
                    paciente = Paciente(dni=dni, nombre=nombre, ingreso=SimulationState.current_date, dado_de_alta=0)
                    db.add(paciente)
                else:
                    # Si estaba inactivo, lo activamos porque volvió a aparecer en el censo
                    if paciente.dado_de_alta == 1:
                        paciente.dado_de_alta = 0
                        
                paciente.metricas = json.dumps(features_dict)
                
                # Añadir Historial
                hist = Historial(paciente_dni=dni, fecha=SimulationState.current_date, riesgo_predicho=riesgo)
                db.add(hist)
                
            # Todos los pacientes activos que NO están en este CSV pasan a inactivos
            pacientes_activos = db.query(Paciente).filter(Paciente.dado_de_alta == 0).all()
            for p in pacientes_activos:
                if p.dni not in csv_dnis:
                    p.dado_de_alta = 1
                    
            db.commit()

        counts = pd.Series(preds).value_counts().to_dict()
        n_low = counts.get('Low', 0)
        n_medium = counts.get('Medium', 0)
        n_high = counts.get('High', 0)
        
        demand_predictions, todays_demand = calculate_future_demand(n_low, n_medium, n_high)

        return {
            "status": "success",
            "census_counts": {"Low": n_low, "Medium": n_medium, "High": n_high, "Total": len(preds)},
            "today_calculated_demand": todays_demand,
            "cumulative_forecasts": demand_predictions
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pacientes")
def get_pacientes(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # Solo pacientes activos o "salieron" (0 o 1)
    pacientes = db.query(Paciente).filter(Paciente.dado_de_alta <= 1).all()
    result = []
    import json
    for p in pacientes:
        h = db.query(Historial).filter(Historial.paciente_dni == p.dni).order_by(Historial.fecha.desc()).first()
        result.append({
            "dni": p.dni,
            "nombre": p.nombre,
            "ingreso": p.ingreso,
            "dado_de_alta": p.dado_de_alta,
            "riesgo_actual": h.riesgo_predicho if h else "Unknown",
            "metricas": json.loads(p.metricas) if p.metricas else None
        })
    return result

@app.put("/api/pacientes/{dni}/alta")
def dar_alta(dni: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    paciente = db.query(Paciente).filter(Paciente.dni == dni).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente not found")
    paciente.dado_de_alta = 1 if paciente.dado_de_alta == 0 else 0
    db.commit()
    return {"status": "success", "dado_de_alta": paciente.dado_de_alta}

class FinalizarRequest(BaseModel):
    motivo: str

@app.put("/api/pacientes/{dni}/finalizar")
def finalizar_paciente(dni: str, req: FinalizarRequest, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    paciente = db.query(Paciente).filter(Paciente.dni == dni).first()
    if not paciente:
        raise HTTPException(status_code=404, detail="Paciente not found")
    
    # Soft delete (mover a historial)
    paciente.dado_de_alta = 2
    paciente.motivo_salida = req.motivo
    db.commit()
    
    return {"status": "success", "motivo": req.motivo}

@app.get("/api/pacientes/historial")
def get_historial(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    pacientes = db.query(Paciente).filter(Paciente.dado_de_alta == 2).all()
    result = []
    import json
    for p in pacientes:
        h = db.query(Historial).filter(Historial.paciente_dni == p.dni).order_by(Historial.fecha.desc()).first()
        result.append({
            "dni": p.dni,
            "nombre": p.nombre,
            "ingreso": p.ingreso,
            "riesgo_ultimo": h.riesgo_predicho if h else "Unknown",
            "motivo_salida": p.motivo_salida
        })
    return result

@app.get("/api/pacientes/historial/stats")
def get_historial_stats(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    from sqlalchemy import func
    stats = db.query(Paciente.motivo_salida, func.count(Paciente.dni)).filter(Paciente.dado_de_alta == 2).group_by(Paciente.motivo_salida).all()
    result = [{"motivo": s[0], "cantidad": s[1]} for s in stats]
    return result

# --- INVENTORY ENDPOINTS ---
@app.get("/api/inventario")
def get_inventario(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    # 1. Obtenemos el stock actual
    meds = db.query(Medicamento).all()
    
    # 2. Obtenemos pacientes activos hoy para calcular n_low, n_medium, n_high
    pacientes_activos = db.query(Paciente).filter(Paciente.dado_de_alta == 0).all()
    
    n_low = n_medium = n_high = 0
    for p in pacientes_activos:
        h = db.query(Historial).filter(Historial.paciente_dni == p.dni).order_by(Historial.fecha.desc()).first()
        if h:
            if h.riesgo_predicho == 'Low': n_low += 1
            elif h.riesgo_predicho == 'Medium': n_medium += 1
            elif h.riesgo_predicho == 'High': n_high += 1
            
    # Si no hay historial reciente, evitamos que crashee
    if len(pacientes_activos) > 0 and (n_low+n_medium+n_high == 0):
        # Fallback si no han sido predecidos hoy
        n_low = len(pacientes_activos)
        
    # 3. Calculamos la demanda futura y de hoy
    demand_predictions, todays_demand = calculate_future_demand(n_low, n_medium, n_high)
    
    resultado = []
    for m in meds:
        cajas_actuales = m.stock_pastillas // m.pastillas_por_caja
        pastillas_sueltas = m.stock_pastillas % m.pastillas_por_caja
        
        # Calcular faltante a 7 días como ejemplo (o enviar todos al front)
        forecast_7 = demand_predictions.get(m.codigo, {}).get("7_days", 0)
        forecast_14 = demand_predictions.get(m.codigo, {}).get("14_days", 0)
        forecast_60 = demand_predictions.get(m.codigo, {}).get("60_days", 0)
        
        def calc_compras(forecast):
            faltante = forecast - m.stock_pastillas
            if faltante <= 0:
                return {"cajas_a_comprar": 0, "costo": 0}
            cajas_a_comprar = (faltante // m.pastillas_por_caja) + (1 if faltante % m.pastillas_por_caja > 0 else 0)
            return {"cajas_a_comprar": cajas_a_comprar, "costo": cajas_a_comprar * m.precio_caja}
        
        resultado.append({
            "codigo": m.codigo,
            "nombre": m.nombre,
            "stock_pastillas": m.stock_pastillas,
            "cajas_actuales": cajas_actuales,
            "pastillas_sueltas": pastillas_sueltas,
            "precio_caja": m.precio_caja,
            "hoy_necesita": todays_demand.get(m.codigo, 0),
            "recomendacion_7d": calc_compras(forecast_7),
            "recomendacion_14d": calc_compras(forecast_14),
            "recomendacion_60d": calc_compras(forecast_60)
        })
        
    return {"inventario": resultado}

class ConsumoRequest(BaseModel):
    codigo: str
    cantidad: int

@app.post("/api/inventario/consumir")
def consumir_stock(req: ConsumoRequest, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    med = db.query(Medicamento).filter(Medicamento.codigo == req.codigo).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento not found")
    med.stock_pastillas = max(0, med.stock_pastillas - req.cantidad)
    db.commit()
    return {"status": "success", "new_stock": med.stock_pastillas}

class ComprarRequest(BaseModel):
    codigo: str
    cajas: int

@app.post("/api/inventario/comprar")
def comprar_stock(req: ComprarRequest, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    med = db.query(Medicamento).filter(Medicamento.codigo == req.codigo).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicamento not found")
    med.stock_pastillas += (req.cajas * med.pastillas_por_caja)
    db.commit()
    return {"status": "success", "new_stock": med.stock_pastillas}
