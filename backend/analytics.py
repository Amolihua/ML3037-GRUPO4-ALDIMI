"""
analytics.py
============
Funciones de analítica que dan soporte a las observaciones del profesor.
Son puras (sin FastAPI ni base de datos) para poder probarlas de forma aislada;
main.py las envuelve en endpoints.

  Obs 1  -> variables_criticas_riesgo / variables_criticas_demanda
  Obs 4  -> consumo_por_nivel  (desglose de demanda por criticidad)
  Obs 2/5 -> proyeccion_determinista (capa transparente que responde 1:1 al censo)
"""
from __future__ import annotations
import glob
import math
import os

import joblib
import numpy as np
import pandas as pd

DRUGS = ["N02BE", "N05B", "M01AB"]

# Traducción de las 23 variables clínicas (para mostrar en la expo).
TRAD_CLINICA = {
    "Age": "Edad", "Gender": "Género", "Air Pollution": "Contaminación del Aire",
    "Alcohol use": "Consumo de Alcohol", "Dust Allergy": "Alergia al Polvo",
    "OccuPational Hazards": "Riesgos Laborales", "Genetic Risk": "Riesgo Genético",
    "chronic Lung Disease": "Enf. Pulmonar Crónica", "Balanced Diet": "Dieta Balanceada",
    "Obesity": "Obesidad", "Smoking": "Fumar", "Passive Smoker": "Fumador Pasivo",
    "Chest Pain": "Dolor de Pecho", "Coughing of Blood": "Tos con Sangre",
    "Fatigue": "Fatiga", "Weight Loss": "Pérdida de Peso",
    "Shortness of Breath": "Dificultad Respiratoria", "Wheezing": "Sibilancias",
    "Swallowing Difficulty": "Dificultad al Tragar",
    "Clubbing of Finger Nails": "Acropaquia (Dedos)", "Frequent Cold": "Resfriado Frecuente",
    "Dry Cough": "Tos Seca", "Snoring": "Ronquidos",
}

# Traducción de las variables del modelo de demanda.
TRAD_DEMANDA = {
    "n_low": "N° pacientes Bajo", "n_medium": "N° pacientes Medio",
    "n_high": "N° pacientes Alto", "dia_semana": "Día de la semana",
    "es_fin_de_semana": "Es fin de semana", "demanda_hoy": "Demanda de hoy",
    "promedio_semanal": "Promedio semanal", "promedio_mensual": "Promedio mensual",
    "promedio_trimestral": "Promedio trimestral", "lag_365": "Demanda hace 1 año",
}

DEMAND_FEATURES = ["n_low", "n_medium", "n_high", "dia_semana", "es_fin_de_semana",
                   "demanda_hoy", "promedio_semanal", "promedio_mensual",
                   "promedio_trimestral", "lag_365"]


# --------------------------------------------------------------------------- #
# Obs 4 / 2 / 5 : consumo determinístico por nivel de criticidad
# --------------------------------------------------------------------------- #
# Regla idéntica a la que usa el backend en calculate_future_demand:
#   N02BE  -> todos los pacientes
#   N05B   -> Medium + High
#   M01AB  -> solo High

def consumo_por_nivel(n_low: int, n_medium: int, n_high: int) -> dict:
    """Consumo diario (pastillas) atribuible a CADA nivel de criticidad."""
    return {
        "Low":    {"N02BE": n_low,    "N05B": 0,        "M01AB": 0},
        "Medium": {"N02BE": n_medium, "N05B": n_medium, "M01AB": 0},
        "High":   {"N02BE": n_high,   "N05B": n_high,   "M01AB": n_high},
    }


def consumo_diario_total(n_low: int, n_medium: int, n_high: int) -> dict:
    por_nivel = consumo_por_nivel(n_low, n_medium, n_high)
    return {d: sum(por_nivel[niv][d] for niv in por_nivel) for d in DRUGS}


def proyeccion_determinista(n_low: int, n_medium: int, n_high: int,
                            horizonte: int) -> dict:
    """Pastillas necesarias en `horizonte` días según el censo (capa transparente)."""
    diario = consumo_diario_total(n_low, n_medium, n_high)
    return {d: int(round(diario[d] * horizonte)) for d in DRUGS}


def cajas(pastillas: float, pastillas_por_caja: int) -> int:
    if pastillas_por_caja <= 0:
        return 0
    return int(math.ceil(max(0.0, pastillas) / pastillas_por_caja))


# --------------------------------------------------------------------------- #
# Obs 1 : variables críticas
# --------------------------------------------------------------------------- #

def variables_criticas_riesgo(risk_dict: dict, top: int | None = None) -> list[dict]:
    """Importancia de features del modelo de riesgo (RandomForest)."""
    model = risk_dict["model"] if isinstance(risk_dict, dict) else risk_dict
    if not hasattr(model, "feature_importances_"):
        return []
    nombres = list(getattr(model, "feature_names_in_", []))
    if not nombres and hasattr(model, "get_booster"):
        nombres = model.get_booster().feature_names
    filas = [{"variable": f, "variable_es": TRAD_CLINICA.get(f, f),
              "importancia": float(imp)}
             for f, imp in zip(nombres, model.feature_importances_)]
    filas.sort(key=lambda x: -x["importancia"])
    total = sum(f["importancia"] for f in filas) or 1.0
    for f in filas:
        f["importancia_pct"] = round(f["importancia"] / total * 100, 2)
    return filas[:top] if top else filas


def _escala_features(df_hist: pd.DataFrame, target_col: str) -> dict:
    serie = df_hist[target_col]
    esc = {}
    for c in ["n_low", "n_medium", "n_high", "dia_semana", "es_fin_de_semana"]:
        esc[c] = float(df_hist[c].std()) if c in df_hist else 1.0
    esc["demanda_hoy"] = float(serie.std())
    esc["promedio_semanal"] = float(serie.rolling(7).mean().std())
    esc["promedio_mensual"] = float(serie.rolling(30).mean().std())
    esc["promedio_trimestral"] = float(serie.rolling(90).mean().std())
    esc["lag_365"] = float(serie.std())
    return esc


def variables_criticas_demanda(model_dir: str, df_hist: pd.DataFrame,
                               horizonte: int = 7) -> dict:
    """Drivers por medicamento en los modelos de demanda cargables.

    Ridge  -> |coef|·std (impacto estandarizado).
    XGBoost -> feature_importances_.
    Prophet/SARIMA se omiten (no exponen importancia de exógenas comparable).
    """
    resultado = {}
    for drug in DRUGS:
        patron = os.path.join(model_dir, f"modelo1_demanda_{drug}_{horizonte}dias_avanzado.*")
        modelo = None
        tipo = None
        for path in sorted(glob.glob(patron)):
            if path.endswith(".json"):
                continue  # Prophet/XGB-json: se omite del ranking de importancia
            try:
                modelo = joblib.load(path)
                tipo = type(modelo).__name__
                break
            except Exception:
                continue

        # Fallback: si el modelo final es Prophet/SARIMA (no rankeable) o no carga,
        # usamos el modelo lineal base como referencia interpretable para la expo.
        if modelo is None or not (hasattr(modelo, "coef_") or hasattr(modelo, "feature_importances_")):
            base_path = os.path.join(model_dir, "..", f"modelo_demanda_{drug}_{horizonte}dias.joblib")
            if os.path.exists(base_path):
                try:
                    modelo = joblib.load(base_path)
                    tipo = f"{type(modelo).__name__} (lineal de referencia)"
                except Exception:
                    modelo = None

        if modelo is None:
            resultado[drug] = {"tipo_modelo": "Prophet/SARIMA (sin ranking)", "drivers": []}
            continue

        esc = _escala_features(df_hist, f"{drug}_demand")
        drivers = []
        if hasattr(modelo, "coef_"):
            nombres = list(getattr(modelo, "feature_names_in_", DEMAND_FEATURES))
            for f, coef in zip(nombres, np.ravel(modelo.coef_)):
                drivers.append({"variable": f, "variable_es": TRAD_DEMANDA.get(f, f),
                                "impacto": abs(float(coef)) * esc.get(f, 1.0)})
        elif hasattr(modelo, "feature_importances_"):
            nombres = list(getattr(modelo, "feature_names_in_", DEMAND_FEATURES))
            for f, imp in zip(nombres, modelo.feature_importances_):
                drivers.append({"variable": f, "variable_es": TRAD_DEMANDA.get(f, f),
                                "impacto": float(imp)})
        drivers.sort(key=lambda x: -x["impacto"])
        total = sum(d["impacto"] for d in drivers) or 1.0
        for d in drivers:
            d["impacto_pct"] = round(d["impacto"] / total * 100, 2)
        resultado[drug] = {"tipo_modelo": tipo, "drivers": drivers}
    return resultado
