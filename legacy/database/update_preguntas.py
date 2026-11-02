import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'licencias.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    cursor.execute("DELETE FROM preguntas_examen")
    
    preguntas = [
        ('¿Qué debe hacer si el semáforo se pone en amarillo?', 'Acelerar para pasar rápido', 'Detenerse con precaución', 'Tocar bocina y avanzar', 'Ignorarlo', 'b'),
        ('¿Quién tiene prioridad de paso en una rotonda?', 'El que ingresa a la rotonda', 'El vehículo de mayor tamaño', 'El que circula por dentro de la rotonda', 'El que viene por la derecha', 'c'),
        ('¿Cuál es la distancia mínima de frenado recomendada respecto al auto de adelante?', 'Medio metro', '1 segundo de distancia', 'Al menos 2 o 3 segundos', '50 metros siempre', 'c')
    ]
    
    cursor.executemany(
        "INSERT INTO preguntas_examen (pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES (?, ?, ?, ?, ?, ?)",
        preguntas
    )
    conn.commit()
    print("Preguntas actualizadas con exito a 3 basicas.")
except Exception as e:
    print(f"Error: {e}")

conn.close()
