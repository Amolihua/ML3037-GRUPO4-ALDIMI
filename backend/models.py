from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)

class Paciente(Base):
    __tablename__ = "pacientes"
    
    dni = Column(String, primary_key=True, index=True)
    nombre = Column(String, index=True)
    ingreso = Column(Date, default=datetime.date.today)
    dado_de_alta = Column(Integer, default=0) # 0 = no, 1 = yes
    
    historial = relationship("Historial", back_populates="paciente")

class Historial(Base):
    __tablename__ = "historial"
    
    id = Column(Integer, primary_key=True, index=True)
    paciente_dni = Column(String, ForeignKey("pacientes.dni"))
    fecha = Column(Date, default=datetime.date.today)
    riesgo_predicho = Column(String)
    
    paciente = relationship("Paciente", back_populates="historial")

class Medicamento(Base):
    __tablename__ = "medicamentos"
    
    id = Column(Integer, primary_key=True, index=True)
    codigo = Column(String, unique=True, index=True) # N02BE, N05B, M01AB
    nombre = Column(String)
    stock_pastillas = Column(Integer, default=0)
    precio_caja = Column(Float)
    pastillas_por_caja = Column(Integer, default=100)
