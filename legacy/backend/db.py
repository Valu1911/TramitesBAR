# -*- coding: utf-8 -*-
"""
Módulo de conexión a MySQL (WampServer).
"""

import pymysql
import os
from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

from pymysql.constants import CLIENT

<<<<<<< HEAD
def get_connection(include_db=True):
    """Obtiene una conexión a la base de datos MySQL."""
    try:
        if include_db:
            return pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DB,
                client_flag=CLIENT.MULTI_STATEMENTS,
                cursorclass=pymysql.cursors.DictCursor
            )
        else:
            return pymysql.connect(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                cursorclass=pymysql.cursors.DictCursor
            )
    except pymysql.MySQLError as e:
        print(f"[ERROR DB] {e}")
        raise e
=======
def dict_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]] = row[idx]
    return d

def get_connection():
    """Obtiene una conexión a la base de datos SQLite."""
    conn = sqlite3.connect(DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = dict_factory
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
    except Exception:
        pass
    return conn
>>>>>>> 6f76f9f210706d776aadebe1ca9ea1a0132ab0c2

def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """
    Ejecuta una query y retorna resultados.
    """
    query = query.replace('?', '%s')
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
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
        print(f"[ERROR SQL] {e} en query: {query}")
        raise e
    finally:
        conn.close()

def execute_many(query, data_list):
    """Ejecuta una query con múltiples sets de parámetros."""
    query = query.replace('?', '%s')
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.executemany(query, data_list)
            conn.commit()
            return cursor.rowcount
    except Exception as e:
        conn.rollback()
        print(f"[ERROR SQL] {e} en query: {query}")
        raise e
    finally:
        conn.close()

def init_db():
    """Inicializa la base de datos MySQL con el schema.sql."""
    # 1. Crear base de datos si no existe
    try:
        conn_no_db = get_connection(include_db=False)
        with conn_no_db.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn_no_db.commit()
    except Exception as e:
        print(f"[ERROR] Falló creación de base de datos {MYSQL_DB}: {e}")
        return
    finally:
        conn_no_db.close()

    # 2. Inicializar tablas
    conn = get_connection()
    try:
<<<<<<< HEAD
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'schema.sql')
        if os.path.exists(schema_path):
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = f.read()
            
            with conn.cursor() as cursor:
                try:
                    cursor.execute(schema)
                except Exception as e:
                    print(f"[ERROR SQL IMPORT] {e}")
=======
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

            try:
                conn.execute("INSERT OR IGNORE INTO admins (usuario, password_hash, nombre, rol) VALUES ('admin_cuentas', 'PENDING_HASH', 'Admin Cuentas e Infracciones', 'cuentas')")
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

            conn.execute("""
                CREATE TABLE IF NOT EXISTS inbox_cuentas (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id        INTEGER NOT NULL,
                    admin_id          INTEGER DEFAULT NULL,
                    emisor            TEXT NOT NULL,
                    mensaje           TEXT NOT NULL,
                    adjunto_url       TEXT DEFAULT NULL,
                    adjunto_nombre    TEXT DEFAULT NULL,
                    leido             INTEGER DEFAULT 0,
                    created_at        TEXT DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
                );
            """)

            # Columnas de estado de cuenta e infracciones para usuarios
            for col, col_type, default_val in [
                ('estado_cuenta', 'TEXT', "'pendiente'"),
                ('multas_cantidad', 'INTEGER', "0"),
                ('multas_monto', 'REAL', "0.0"),
                ('multas_motivo', 'TEXT', "''"),
                ('multas_fecha_revision', 'TEXT', "NULL"),
                ('bienvenida_mostrada', 'INTEGER', "0"),
                ('infracciones_pagadas_solicitadas', 'INTEGER', "0"),
                ('foto_rostro', 'TEXT', "NULL"),
                ('dni_frente', 'TEXT', "NULL"),
                ('dni_dorso', 'TEXT', "NULL"),
            ]:
                try:
                    conn.execute(f"ALTER TABLE usuarios ADD COLUMN {col} {col_type} DEFAULT {default_val}")
                except sqlite3.OperationalError:
                    pass

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

<<<<<<< HEAD
>>>>>>> 68c55a60f7d0f4cd25d39b182726459d7a1587b2
=======
            try:
                conn.execute("ALTER TABLE examenes_teoricos ADD COLUMN created_at TEXT")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("UPDATE examenes_teoricos SET created_at = COALESCE(fecha_examen, datetime('now','localtime')) WHERE created_at IS NULL OR created_at = ''")
            except sqlite3.OperationalError:
                pass

<<<<<<< HEAD
>>>>>>> 6f76f9f210706d776aadebe1ca9ea1a0132ab0c2
=======
            # Tablas del sistema de memoria (Gentle AI)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_activity_log (
                    id          INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id  INTEGER NOT NULL,
                    action      TEXT NOT NULL,
                    detail      TEXT DEFAULT NULL,
                    created_at  TEXT DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                );
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id                INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario_id        INTEGER NOT NULL UNIQUE,
                    theme             TEXT DEFAULT 'light',
                    last_page         TEXT DEFAULT 'dashboard',
                    sidebar_collapsed INTEGER DEFAULT 0,
                    updated_at        TEXT DEFAULT (datetime('now','localtime')),
                    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
                );
            """)

>>>>>>> 77df27a69d2213054565b4a2b6cb460e7bb8308e
            conn.commit()
            print(f"[OK] Base de datos {MYSQL_DB} inicializada/verificada con schema.sql")
    except Exception as e:
        print(f"[ERROR] Falló inicialización de tablas: {e}")
    finally:
        conn.close()
