# -*- coding: utf-8 -*-
"""
Configuración de base de datos y constantes del sistema.
Base de datos: SQLite (integrada, sin configuración externa).
"""

SECRET_KEY = 'tramites_baradero_2026_secret_key_change_in_production'
JWT_EXPIRATION_HOURS = 24
ADMIN_JWT_EXPIRATION_HOURS = 8

MONTO_LICENCIA = 12500.00
ALIAS_BANCARIO = 'MUNICIPIO.BARADERO.LICENCIAS'
CBU_BANCARIO = '0110012330001234567890'

# Pasos del trámite en orden secuencial
PASOS_TRAMITE = ['charlas', 'formularios', 'examen', 'pago', 'practico', 'entrega', 'finalizado']

# Número mínimo de respuestas correctas para aprobar
MINIMO_APROBACION_EXAMEN = 4
TOTAL_PREGUNTAS_EXAMEN = 5
