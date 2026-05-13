import json
from pathlib import Path

notebook_path = Path("notebooks/pipeline_ejecucion.ipynb")

with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Update Step 3 to use the new "acumulado" models
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = "".join(cell['source'])
        if "path_modelo = MODELS_DIR / f\"modelo_demanda_{drug}_{h}dias.joblib\"" in source:
            source = source.replace("modelo_demanda_{drug}_{h}dias.joblib", "modelo_demanda_{drug}_{h}dias_acumulado.joblib")
            source = source.replace("'Horizonte': f'{h} días'", "'Periodo': f'Próximos {h} días'")
            source = source.replace("'Unidades a Comprar'", "'Total Unidades a Comprar (Acumulado)'")
            
            cell['source'] = [line + ("\n" if not line.endswith("\n") else "") for line in source.splitlines()]
        
        # Also update the title in markdown if possible, but let's stick to the code logic
        if "# Pipeline de Ejecución Integrado" in source:
            pass

# Update markdown cells for clarity
for cell in nb['cells']:
    if cell['cell_type'] == 'markdown':
        source = "".join(cell['source'])
        if "## Paso 3: Pronóstico de Demanda" in source:
            cell['source'] = ["## Paso 3: Pronóstico de Demanda Acumulada (Modelo 1)\n", 
                              "Usamos los 6 modelos de regresión re-entrenados para predecir la SUMA de demanda de los próximos 7 y 14 días.\n"]

with open(notebook_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Pipeline notebook updated with cumulative model logic.")
