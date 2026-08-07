# -*- coding: utf-8 -*-
"""
Módulo de conexión a SQLite.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'licencias.db')

def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_connection():
    """Obtiene una conexión a la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = dict_factory
    return conn

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """
    Ejecuta una query y retorna resultados.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(query, params or ())
        if fetch_one:
            result = cursor.fetchone()
        elif fetch_all:
            result = cursor.fetchall()
        else:
            conn.commit()
            result = cursor.lastrowid
        return result
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def execute_many(query, data_list):
    """Ejecuta una query con múltiples sets de parámetros."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.executemany(query, data_list)
        conn.commit()
        return cursor.rowcount
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def init_db():
    """Inicializa la base de datos con el schema si no existe o actualiza las tablas faltantes."""
    conn = get_connection()
    try:
        if not os.path.exists(DB_PATH):
            schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'schema.sql')
            if os.path.exists(schema_path):
                with open(schema_path, 'r', encoding='utf-8') as f:
                    schema = f.read()
                conn.executescript(schema)
                conn.commit()
                print("[OK] Base de datos SQLite inicializada con schema.sql")
        else:
            # Migraciones sobre base de datos existente
            conn.execute("""
                CREATE TABLE IF NOT EXISTS licencias (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id        INTEGER NOT NULL,
                    tramite_id        INTEGER NOT NULL,
                    numero_licencia   TEXT NOT NULL,
                    categoria         TEXT NOT NULL DEFAULT 'B1',
                    jurisdiccion      TEXT NOT NULL DEFAULT 'Provincia de Buenos Aires - Baradero',
                    fecha_emision     TEXT NOT NULL,
                    fecha_vencimiento TEXT NOT NULL,
                    estado            TEXT NOT NULL DEFAULT 'vigente',
                    foto_rostro       TEXT DEFAULT NULL,
                    qr_code_data      TEXT DEFAULT NULL,
                    created_at        TEXT DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS config_examen (
                    id              INTEGER PRIMARY KEY AUTOINCREMENT,
                    modo            TEXT NOT NULL DEFAULT 'plantilla',
                    cant_plantilla  INTEGER NOT NULL DEFAULT 3,
                    cant_profesor   INTEGER NOT NULL DEFAULT 3,
                    updated_at      TEXT DEFAULT (datetime('now','localtime'))
                );
            """)
            conn.execute("INSERT OR IGNORE INTO config_examen (id, modo, cant_plantilla, cant_profesor) VALUES (1, 'plantilla', 3, 3);")

            # Columnas opcionales
            try:
                conn.execute("ALTER TABLE usuarios ADD COLUMN tiene_cud INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE usuarios ADD COLUMN numero_cud TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE preguntas_examen ADD COLUMN es_plantilla INTEGER DEFAULT 1")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE preguntas_examen ADD COLUMN profesor_id INTEGER DEFAULT NULL")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE reservas_turno ADD COLUMN huella_tomada INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE reservas_turno ADD COLUMN foto_tomada INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("INSERT OR IGNORE INTO admins (usuario, password_hash, nombre, rol) VALUES ('admin_profesores', 'PENDING_HASH', 'Profesor Admin', 'profesores')")
            except sqlite3.OperationalError:
                pass

            conn.execute("""
                CREATE TABLE IF NOT EXISTS mensajes_profesor (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    tramite_id        INTEGER NOT NULL,
                    usuario_id        INTEGER NOT NULL,
                    profesor_nombre   TEXT DEFAULT 'Profesor Evaluador',
                    mensaje           TEXT NOT NULL,
                    tipo              TEXT DEFAULT 'justificacion',
                    created_at        TEXT DEFAULT (datetime('now','localtime'))
                );
            """)

            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN estado_revision TEXT DEFAULT 'pendiente_revision'")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN porcentaje_acierto REAL DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN motivo_justificacion TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN expulsado INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN motivo_expulsion TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass

            conn.commit()
    except Exception as e:
        print(f"[ERROR] Falló inicialización de base de datos: {e}")
    finally:
        conn.close()

