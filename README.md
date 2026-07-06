# ML3037-GRUPO4-ALDIMI
Repositorio del Grupo 4 para el proyecto de Machine Learning.

---

## 🚀 Instrucciones para Levantar el Proyecto Localmente

Debido a que hemos ignorado archivos pesados y la base de datos en Git, si es tu primera vez clonando el repositorio (o si cambiaste de laptop), debes ejecutar los siguientes comandos para configurar tu entorno local.

### 1. Configurar y Levantar el Backend (FastAPI + Base de Datos)
Abre una terminal en la raíz del proyecto y ejecuta:

```bash
# Entra a la carpeta del backend
cd backend

# Instala todas las dependencias necesarias (FastAPI, SQLAlchemy, XGBoost, etc.)
pip install -r requirements.txt

# Genera la base de datos local (aldimi.db) y carga al usuario administrador y los medicamentos
python seed.py

# Levanta el servidor del backend
python -m uvicorn main:app --reload
```

### 2. Configurar y Levantar el Frontend (React)
Abre una **nueva terminal** (sin cerrar la del backend) en la raíz del proyecto y ejecuta:

```bash
# Entra a la carpeta del frontend
cd frontend

# Instala las dependencias de Node (esto descargará la carpeta node_modules)
npm install

# Levanta la interfaz gráfica
npm run dev
```

### 🔑 Credenciales por Defecto
Una vez que ambos servidores estén corriendo, abre tu navegador en `http://localhost:5173`.
- **Usuario:** `admin`
- **Contraseña:** `aldimi2026`
