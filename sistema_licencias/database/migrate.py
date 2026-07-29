import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'licencias.db')
conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE usuarios ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''")
    conn.commit()
    print("Migración exitosa: columna password_hash agregada.")
except Exception as e:
    print(f"La columna ya existe o hubo un error: {e}")

conn.close()
