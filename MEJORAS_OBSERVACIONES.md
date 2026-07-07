# ALDIMI · Mejoras aplicadas (observaciones del profesor)

Versión mejorada del avance de la semana 15 (full-stack: FastAPI + React/Vite).
A continuación, qué se cambió en **backend** y **frontend** para cada observación.

## Resumen

| # | Observación | Estado previo | Qué se agregó |
|---|-------------|---------------|----------------|
| 1 | Variables críticas (para la expo) | ❌ inexistente | Endpoint `/api/variables_criticas` + página **Análisis IA** con gráficos |
| 2 | Fallecimiento → actualizar proyección (avanzar día) | ⚠️ parcial | `/api/avanzar_dia` ahora recalcula censo y re-proyecta; simulador de fallecimientos |
| 3 | Cajas en las pastillas | ✅ ya existía | Se mantiene; el simulador reporta Δ en cajas, pastillas y costo |
| 4 | Agrupamiento / filtro por criticidad | ⚠️ parcial | Endpoint `/api/demanda_por_criticidad` + filtro clicable en **Pacientes** + desglose en Análisis IA |
| 5 | Ingreso/egreso → proyección | ⚠️ implícito | Endpoint `/api/simular_poblacion` + **Simulador de Población** visual |

---

## Backend (`backend/`)

**`analytics.py` (nuevo)** — funciones puras y testeables:
- `variables_criticas_riesgo` → importancia de features del RandomForest de riesgo.
- `variables_criticas_demanda` → drivers por medicamento (Ridge `|coef|·std` / XGBoost `feature_importances_`); si el modelo final es Prophet/SARIMA usa el modelo lineal base como referencia interpretable, así los **3 medicamentos** siempre muestran ranking.
- `consumo_por_nivel` / `consumo_diario_total` / `proyeccion_determinista` → capa determinística dosis-por-nivel (N02BE=todos, N05B=Medio+Alto, M01AB=Alto), idéntica a la regla de `calculate_future_demand`. Es la que hace **trazable** el efecto de la población.

**`main.py` (editado)** — endpoints nuevos:
- `GET /api/variables_criticas?top=8` (Obs 1)
- `GET /api/demanda_por_criticidad?nivel=High` (Obs 4, con filtro opcional)
- `POST /api/simular_poblacion` (Obs 2 y 5): body `{ingreso, egreso, fallecimiento}` con `{Low, Medium, High}`. Devuelve censo base vs. simulado y Δ en cajas/pastillas/costo por medicamento y horizonte (7/14/60). Incluye el pronóstico ML avanzado como capa secundaria (best-effort).
- `POST /api/avanzar_dia` (Obs 2): además de mover la fecha, recalcula el censo activo y re-proyecta la demanda.
- Helper `_censo_activo(db)` factorizado.

> El simulador se apoya en la capa determinística para que el efecto de un fallecimiento/ingreso/egreso sobre la proyección sea **directo y explicable** ante el jurado; el modelo ML (Prophet/SARIMA/Ridge/XGBoost) se conserva intacto.

## Frontend (`frontend/src/`)

- **`pages/Analitica.jsx` (nuevo)** — página **Análisis IA** con tres bloques:
  1. Variables críticas (riesgo + demanda por medicamento, con selector).
  2. Demanda por criticidad, con filtro Todos/Bajo/Medio/Alto (gráfico apilado + tabla).
  3. Simulador de Población: inputs de ingreso/egreso/fallecimiento por nivel → tabla de impacto (Δ cajas/pastillas/costo).
- **`components/Sidebar.jsx`** — nuevo enlace “Análisis IA”.
- **`App.jsx`** — nueva ruta `/analitica`.
- **`pages/Pacientes.jsx`** — las tarjetas de riesgo ahora son **filtros clicables** por criticidad (Obs 4); resaltan el filtro activo y permiten quitarlo.

---

## Cómo ejecutar

```bash
# Backend
cd backend
pip install -r requirements.txt
python seed.py            # crea aldimi.db (admin / aldimi2026) y medicamentos
uvicorn main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Flujo de demo sugerido para la expo:
1. Entra a **Análisis IA** → muestra las variables críticas (Obs 1).
2. Sube un censo o añade pacientes → revisa **Demanda por Criticidad** y filtra por Alto (Obs 4).
3. En el **Simulador**, marca 1 fallecimiento Alto y 3 ingresos Bajo → observa cómo cambian las cajas a comprar (Obs 2 y 5).
4. Usa **Avanzar Día** en el sidebar para confirmar que la proyección se recalcula.
