# -*- coding: utf-8 -*-
"""
Módulo de conexión a MySQL (WampServer).
"""

import pymysql
import os
from config import MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DB

from pymysql.constants import CLIENT

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
        schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'schema.sql')
        if os.path.exists(schema_path):
            with open(schema_path, 'r', encoding='utf-8') as f:
                schema = f.read()
            
            with conn.cursor() as cursor:
                try:
                    cursor.execute(schema)
                except Exception as e:
                    print(f"[ERROR SQL IMPORT] {e}")
            conn.commit()
            print(f"[OK] Base de datos {MYSQL_DB} inicializada/verificada con schema.sql")
    except Exception as e:
        print(f"[ERROR] Falló inicialización de tablas: {e}")
    finally:
        conn.close()
