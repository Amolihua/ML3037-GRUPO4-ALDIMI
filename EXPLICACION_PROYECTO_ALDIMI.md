# Sistema de Pronóstico de Demanda Farmacéutica - ALDIMI

Este proyecto implementa una solución de Inteligencia Artificial para la optimización de inventarios en la cadena farmacéutica ALDIMI, integrando el análisis del estado de salud de los pacientes con el pronóstico de demanda de medicamentos.

## 1. Arquitectura del Sistema (Flujo Integrado)

El sistema utiliza una arquitectura de **dos modelos en cascada** para lograr una predicción precisa:

1.  **Modelo 2 (Clasificación de Riesgo):** Toma datos de pacientes (edad, género, síntomas) y los clasifica en niveles de riesgo (Bajo, Medio, Alto).
2.  **Censo Poblacional:** Se agrupan los resultados del Modelo 2 para generar indicadores exógenos (conteo de pacientes por nivel de riesgo).
3.  **Modelo 1 (Pronóstico de Demanda):** Combina el historial de ventas con los indicadores del censo para predecir cuántas unidades de medicamento se necesitarán en 7 y 14 días.

---

## 2. Metodología y Notebooks Principales

### A. Preparación y Análisis de Datos

- **`notebooks/EDA_nuevodataset_modelo1.ipynb`**: Análisis Exploratorio de Datos (EDA). Aquí se limpió el dataset original, se manejaron valores nulos y se transformaron las series temporales para ser aptas para modelos de Machine Learning.

### B. Entrenamiento de Modelos

- **`notebooks/entrenamiento_modelo2.ipynb`**: Entrenamiento del clasificador de riesgo. Se implementó un **Árbol de Decisión** (DecisionTreeClassifier) ajustado para evitar el sobreajuste (overfitting), logrando una clasificación robusta de los pacientes.
- **`notebooks/entrenamiento_modelado_base.ipynb`**: Entrenamiento de los modelos de demanda. Se utilizaron **Regresiones Lineales** para 3 medicamentos específicos en dos horizontes temporales (7 y 14 días). Se incorporaron variables de memoria (Lags y promedios móviles) para capturar tendencias.

### C. Automatización (Pipeline)

- **`notebooks/pipeline_ejecucion.ipynb`**: Es el "cerebro" del proyecto. Este archivo automatiza todo el proceso: carga los modelos entrenados, procesa nuevos pacientes, calcula el censo y genera la tabla final de recomendaciones de stock.

---

## 3. Estructura de Archivos (Artifacts)

### `/modelos` (Modelos Persistidos)

Contiene los archivos `.joblib` listos para producción:

- `modelo_riesgo_pacientes.joblib`: Modelo de clasificación.
- `modelo_demanda_[DROGA]_[HORIZONTE]dias.joblib`: Los 6 modelos de regresión lineal.

### `/datos` (Datasets)

- `datos_modelo1/processed/aldimi_demanda_dataset_clean.csv`: El dataset histórico maestro.
- `datos_modelo2/aldimi_pacientes_censo_INPUT_M1.csv`: El archivo de entrada para simular la llegada de nuevos pacientes al sistema.

---

## 4. Resultados Obtenidos

El sistema es capaz de entregar una **tabla de recomendación logística** que le dice a la gerencia de ALDIMI exactamente cuántas unidades asegurar para cada medicamento. Al integrar el riesgo de salud de los pacientes como una variable predictora, el modelo es mucho más reactivo a posibles brotes o cambios en la salud de la población que un modelo estadístico tradicional.
