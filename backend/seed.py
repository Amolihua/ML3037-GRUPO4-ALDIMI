import os
from database import engine, Base, SessionLocal
from models import Usuario, Medicamento
import bcrypt

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def seed_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    # 1. Crear Admin
    admin = db.query(Usuario).filter(Usuario.username == "admin").first()
    if not admin:
        admin = Usuario(
            username="admin",
            password_hash=get_password_hash("aldimi2026")
        )
        db.add(admin)
        print("Admin user created (admin / aldimi2026)")
        
    # 2. Crear Medicamentos
    meds = [
        {"codigo": "N02BE", "nombre": "Paracetamol 500mg Tableta", "stock_pastillas": 500, "precio_caja": 10.00, "pastillas_por_caja": 100},
        {"codigo": "N05B", "nombre": "Alprazolam 0.5Mg Tableta", "stock_pastillas": 200, "precio_caja": 6.00, "pastillas_por_caja": 100},
        {"codigo": "M01AB", "nombre": "Diclofenaco 50mg Tabletas", "stock_pastillas": 300, "precio_caja": 9.00, "pastillas_por_caja": 100}
    ]
    
    for m in meds:
        med = db.query(Medicamento).filter(Medicamento.codigo == m["codigo"]).first()
        if not med:
            db.add(Medicamento(**m))
            print(f"Medicamento {m['codigo']} created.")
            
    db.commit()
    db.close()
    print("Seed complete.")

if __name__ == "__main__":
    seed_db()
