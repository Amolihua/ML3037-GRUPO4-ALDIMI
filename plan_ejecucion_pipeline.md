# Plan de Ejecución del Pipeline Integrado - ALDIMI Pharma Demand

Este documento detalla las etapas, archivos y datasets necesarios para automatizar el flujo de trabajo que conecta la estratificación de riesgo de pacientes con el pronóstico de demanda de medicamentos.

## 1. Arquitectura del Pipeline

El pipeline se divide en tres bloques principales: Clasificación, Agregación y Pronóstico.

---

### Bloque A: Clasificación de Riesgo Individual (Modelo 2)

**Objetivo:** Determinar el nivel de riesgo de cada paciente basándose en su perfil clínico.

- **Entrada:** `cancer patient data sets.xlsx` (o cualquier nuevo listado de pacientes con síntomas).
- **Procesador:** `entrenamiento_modelo2.ipynb` (usando el **Árbol de Decisión** entrenado).
- **Salida Temporal:** `pacientes_con_riesgo.csv` (Listado de pacientes con columna `Level` predicha).

---

### Bloque B: Generación del Censo (Agregación)

**Objetivo:** Transformar la data individual en métricas poblacionales diarias para el Modelo 1.

- **Entrada:** `pacientes_con_riesgo.csv`.
- **Procesador:** Script de Agregación (por desarrollar).
  - _Lógica:_ Contar cuántos "Low", "Medium" y "High" existen por cada día de operación.
- **Salida:** `censo_diario_actualizado.csv` (Columnas: `fecha`, `n_low`, `n_medium`, `n_high`).

---

### Bloque C: Pronóstico de Demanda (Modelo 1)

**Objetivo:** Predecir la demanda de medicamentos a 7 y 14 días.

- **Entrada 1:** `censo_diario_actualizado.csv` (del Bloque B).
- **Entrada 2:** `aldimi_demand_dataset.csv` (Histórico de ventas para generar Lags).
- **Procesador:** `entrenamiento_modelado_base.ipynb` (usando **Regresión Lineal/Lags**).
  - _Lógica:_ Unir el censo con los datos de demanda y calcular variables de memoria (promedio semanal y demanda del día anterior).
- **Salida Final:** `prediccion_demanda_ALDIMI.csv` (Cantidades sugeridas por categoría ATC).

---

## 2. Inventario de Archivos Existentes

| Etapa         | Archivo / Dataset                   | Ubicación                  |
| :------------ | :---------------------------------- | :------------------------- |
| **Input**     | `cancer patient data sets.xlsx`     | Raíz del proyecto          |
| **Modelo 2**  | `entrenamiento_modelo2.ipynb`       | `notebooks/`               |
| **Histórico** | `aldimi_demand_dataset.csv`         | `datos/datos_modelo1/raw/` |
| **Modelo 1**  | `entrenamiento_modelado_base.ipynb` | `notebooks/`               |

---

## 3. Próximos Pasos para la Automatización

1.  **Exportación de Modelos:** Guardar los modelos entrenados (`.pkl` o `.joblib`) para que no sea necesario volver a entrenar en cada ejecución.
2.  **Script Maestro (`main.py`):** Crear un único script que ejecute las etapas A, B y C de forma secuencial.
3.  **Dashboard de Visualización:** (Opcional) Unir las salidas para mostrar el riesgo vs. la demanda proyectada en una interfaz simple.
