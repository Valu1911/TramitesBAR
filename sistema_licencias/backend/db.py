# -*- coding: utf-8 -*-
"""
Módulo de conexión a MySQL.
Usa pool de conexiones para mejor rendimiento.
"""

import mysql.connector
from mysql.connector import pooling
from config import DB_CONFIG

_pool = None


def get_pool():
    """Obtiene o crea el pool de conexiones."""
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="licencias_pool",
            pool_size=10,
            pool_reset_session=True,
            **DB_CONFIG
        )
    return _pool


def get_connection():
    """Obtiene una conexión del pool."""
    return get_pool().get_connection()


def execute_query(query, params=None, fetch_one=False, fetch_all=False):
    """
    Ejecuta una query y retorna resultados.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
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
