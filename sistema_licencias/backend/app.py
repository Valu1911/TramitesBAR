# -*- coding: utf-8 -*-
"""
Sistema de Trámites de Licencias de Conducir - Baradero
Backend API con Flask + MySQL
"""

import json
import datetime
import random
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

from config import (
    SECRET_KEY, JWT_EXPIRATION_HOURS, ADMIN_JWT_EXPIRATION_HOURS,
    PASOS_TRAMITE, PASOS_NUEVA, PASOS_RENOVACION, MINIMO_APROBACION_EXAMEN, TOTAL_PREGUNTAS_EXAMEN,
    MONTO_LICENCIA, ALIAS_BANCARIO, CBU_BANCARIO
)
from db import execute_query, init_db

import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)


# ============================================================
# HELPERS JWT & AUTH
# ============================================================

def create_token(payload, hours=JWT_EXPIRATION_HOURS):
    payload['exp'] = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=hours)
    payload['iat'] = datetime.datetime.now(datetime.timezone.utc)
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token requerido'}), 401
        data = decode_token(token)
        if not data:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        request.user_data = data
        return f(*args, **kwargs)
    return decorated


ACTIVE_EXAM_STREAMS = {}


def admin_required(rol=None):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = request.headers.get('Authorization', '').replace('Bearer ', '')
            if not token:
                return jsonify({'error': 'Token requerido'}), 401
            data = decode_token(token)
            if not data or data.get('tipo') != 'admin':
                return jsonify({'error': 'Acceso denegado'}), 403
            user_rol = data.get('rol')
            if rol and user_rol != rol and user_rol not in ('profesores', 'superadmin', 'admin', 'cuentas'):
                return jsonify({'error': f'Se requiere rol: {rol}'}), 403
            request.admin_data = data
            return f(*args, **kwargs)
        return decorated
    return decorator




# ============================================================
# HELPERS DE LICENCIAS Y EDAD (PBA)
# ============================================================

def calcular_edad(fecha_nac_str):

    """Calcula la edad actual en base a la fecha de nacimiento (YYYY-MM-DD)."""
    if not fecha_nac_str:
        return 0
    try:
        if isinstance(fecha_nac_str, (datetime.date, datetime.datetime)):
            birth = fecha_nac_str.date() if isinstance(fecha_nac_str, datetime.datetime) else fecha_nac_str
        else:
            fecha_clean = str(fecha_nac_str).split(' ')[0].split('T')[0]
            birth = datetime.datetime.strptime(fecha_clean, '%Y-%m-%d').date()
        today = datetime.date.today()
        edad = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return max(0, edad)
    except Exception:
        return 0


def calcular_vigencia_licencia(edad):
    """
    Vigencia según normativa de la Provincia de Buenos Aires (PBA):
    - Menores de edad (16 a 17 años): 1 año (anualmente)
    - Adultos (18 a 65 años): 5 años
    - 66 a 70 años: 3 años
    - Mayor a 70 años: 1 año
    """
    if edad < 18:
        return 1
    elif edad <= 65:
        return 5
    elif edad <= 70:
        return 3
    else:
        return 1


def get_pasos_por_tipo(tipo):
    if tipo in ('renovacion', 'extravio'):
        return PASOS_RENOVACION
    return PASOS_NUEVA


def get_paso_index(paso, tipo='nueva'):
    pasos = get_pasos_por_tipo(tipo)
    try:
        return pasos.index(paso)
    except ValueError:
        return -1


def puede_acceder_paso(paso_actual, paso_solicitado):
    return True


def emitir_licencia_digital(usuario_id, tramite_id):
    """Genera o recupera la credencial digital emitida para un ciudadano."""
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (usuario_id,), fetch_one=True)
    if not usuario:
        return None

    existente = execute_query("SELECT * FROM licencias WHERE tramite_id=?", (tramite_id,), fetch_one=True)
    if existente:
        if existente.get('fecha_emision'):
            existente['fecha_emision'] = str(existente['fecha_emision'])
        if existente.get('fecha_vencimiento'):
            existente['fecha_vencimiento'] = str(existente['fecha_vencimiento'])
        return existente

    edad = calcular_edad(usuario.get('fecha_nacimiento'))
    anios_vigencia = calcular_vigencia_licencia(edad)

    hoy = datetime.date.today()
    fecha_emision = hoy.strftime('%Y-%m-%d')
    try:
        fecha_vencimiento = datetime.date(hoy.year + anios_vigencia, hoy.month, hoy.day).strftime('%Y-%m-%d')
    except ValueError: # bisiesto Feb 29
        fecha_vencimiento = datetime.date(hoy.year + anios_vigencia, hoy.month, 28).strftime('%Y-%m-%d')

    qr_data = f"PBA-BARADERO|DNI:{usuario['dni']}|TITULAR:{usuario['nombre']} {usuario['apellido']}|CAT:B1|EMISION:{fecha_emision}|VENC:{fecha_vencimiento}"

    lic_id = execute_query(
        """INSERT INTO licencias 
           (usuario_id, tramite_id, numero_licencia, categoria, jurisdiccion, fecha_emision, fecha_vencimiento, estado, qr_code_data)
           VALUES (?, ?, ?, 'B1', 'Provincia de Buenos Aires - Baradero', ?, ?, 'vigente', ?)""",
        (usuario_id, tramite_id, usuario['dni'], fecha_emision, fecha_vencimiento, qr_data)
    )

    lic = execute_query("SELECT * FROM licencias WHERE id=?", (lic_id,), fetch_one=True)
    if lic:
        if lic.get('fecha_emision'):
            lic['fecha_emision'] = str(lic['fecha_emision'])
        if lic.get('fecha_vencimiento'):
            lic['fecha_vencimiento'] = str(lic['fecha_vencimiento'])
    return lic



# ============================================================
# SERVE FRONTEND
# ============================================================

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/<path:path>')
def serve_static(path):
    file_path = os.path.join(app.static_folder, path)
    if os.path.isfile(file_path):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


# ============================================================
# AUTH - USUARIOS (por DNI)
# ============================================================

@app.route('/api/auth/registro', methods=['POST'])
def registro():
    data = request.json or {}
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')

    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido (7 u 8 dígitos)'}), 400

    existing = execute_query("SELECT id FROM usuarios WHERE dni=?", (dni,), fetch_one=True)
    if existing:
        return jsonify({'error': 'Ya existe una cuenta con este DNI'}), 409

    nombre = data.get('nombre', '').strip()
    apellido = data.get('apellido', '').strip()
    email = data.get('email', '').strip()
    telefono = data.get('telefono', '').strip()
    fecha_nac = data.get('fecha_nacimiento', None)
    direccion = data.get('direccion', '').strip()
    tipo_tramite = data.get('tipo_tramite', 'nueva')
    tiene_cud = 1 if data.get('tiene_cud') in (1, True, '1', 'true') else 0
    numero_cud = data.get('numero_cud', '').strip()
    password = data.get('password', '').strip()

    if not nombre or not apellido:
        return jsonify({'error': 'Nombre y apellido son requeridos'}), 400

    if not fecha_nac:
        return jsonify({'error': 'La fecha de nacimiento es obligatoria'}), 400

    if len(password) < 6:
        return jsonify({'error': 'La contraseña debe tener al menos 6 caracteres'}), 400

    password_hash = generate_password_hash(password)

    user_id = execute_query(
        """INSERT INTO usuarios (dni, nombre, apellido, email, telefono, fecha_nacimiento, direccion, tiene_cud, numero_cud, password_hash, estado_cuenta, multas_cantidad, multas_monto, multas_motivo, bienvenida_mostrada, infracciones_pagadas_solicitadas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 0, 0.0, '', 0, 0)""",
        (dni, nombre, apellido, email, telefono, fecha_nac, direccion, tiene_cud, numero_cud, password_hash)
    )

    paso_inicial = 'formularios' if tipo_tramite == 'renovacion' else 'charlas'

    tramite_id = execute_query(
        "INSERT INTO tramites (usuario_id, tipo, paso_actual) VALUES (?, ?, ?)",
        (user_id, tipo_tramite, paso_inicial)
    )

    token = create_token({'usuario_id': user_id, 'dni': dni, 'tipo': 'usuario', 'tramite_id': tramite_id})
    edad = calcular_edad(fecha_nac)

    return jsonify({
        'message': 'Registro exitoso',
        'token': token,
        'usuario': {
            'id': user_id,
            'dni': dni,
            'nombre': nombre,
            'apellido': apellido,
            'fecha_nacimiento': fecha_nac,
            'edad': edad,
            'tiene_cud': tiene_cud,
            'numero_cud': numero_cud,
            'tipo_tramite': tipo_tramite,
            'tramite_id': tramite_id,
            'paso_actual': paso_inicial,
            'estado_cuenta': 'pendiente',
            'multas_cantidad': 0,
            'multas_monto': 0.0,
            'multas_motivo': '',
            'bienvenida_mostrada': 0,
            'infracciones_pagadas_solicitadas': 0
        }
    }), 201


def get_user_tramite_id(user_data):
    if not user_data:
        return None
    tramite_id = user_data.get('tramite_id')
    if tramite_id:
        return tramite_id
    usuario_id = user_data.get('usuario_id')
    if usuario_id:
        tramite = execute_query(
            "SELECT id, tipo FROM tramites WHERE usuario_id=? AND estado='en_progreso' ORDER BY id DESC LIMIT 1",
            (usuario_id,), fetch_one=True
        )
        if tramite:
            return tramite['id']
        return execute_query(
            "INSERT INTO tramites (usuario_id, tipo, paso_actual) VALUES (?, 'nueva', 'charlas')",
            (usuario_id,)
        )
    return None


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')
    password = data.get('password', '').strip()

    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido'}), 400

    if not password:
        return jsonify({'error': 'Contraseña requerida'}), 400

    user = execute_query(
        "SELECT id, dni, nombre, apellido, fecha_nacimiento, tiene_cud, numero_cud, password_hash, estado_cuenta, multas_cantidad, multas_monto, multas_motivo, multas_fecha_revision, bienvenida_mostrada, infracciones_pagadas_solicitadas FROM usuarios WHERE dni=?",
        (dni,), fetch_one=True
    )

    if not user:
        return jsonify({'error': 'No existe cuenta con este DNI. Registrate primero.', 'needs_register': True}), 404

    if not user.get('password_hash') or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': 'Contraseña incorrecta'}), 401

    # Buscar o crear trámite activo
    tramite = execute_query(
        "SELECT id, paso_actual, tipo, estado FROM tramites WHERE usuario_id=? AND estado='en_progreso' ORDER BY id DESC LIMIT 1",
        (user['id'],), fetch_one=True
    )

    if not tramite:
        tramite_id = execute_query(
            "INSERT INTO tramites (usuario_id, tipo, paso_actual) VALUES (?, 'nueva', 'charlas')",
            (user['id'],)
        )
        paso_actual = 'charlas'
        tipo_tramite = 'nueva'
    else:
        tramite_id = tramite['id']
        paso_actual = tramite['paso_actual']
        tipo_tramite = tramite['tipo']

    edad = calcular_edad(user.get('fecha_nacimiento'))

    token = create_token({
        'usuario_id': user['id'],
        'dni': user['dni'],
        'tipo': 'usuario',
        'tramite_id': tramite_id
    })

    return jsonify({
        'message': 'Login exitoso',
        'token': token,
        'usuario': {
            'id': user['id'],
            'dni': user['dni'],
            'nombre': user['nombre'],
            'apellido': user['apellido'],
            'fecha_nacimiento': user.get('fecha_nacimiento'),
            'edad': edad,
            'tiene_cud': bool(user.get('tiene_cud', 0)),
            'numero_cud': user.get('numero_cud', ''),
            'tramite_id': tramite_id,
            'tipo_tramite': tipo_tramite,
            'paso_actual': paso_actual,
            'estado_cuenta': user.get('estado_cuenta') or 'pendiente',
            'multas_cantidad': user.get('multas_cantidad') or 0,
            'multas_monto': float(user.get('multas_monto') or 0.0),
            'multas_motivo': user.get('multas_motivo') or '',
            'multas_fecha_revision': user.get('multas_fecha_revision'),
            'bienvenida_mostrada': int(user.get('bienvenida_mostrada') or 0),
            'infracciones_pagadas_solicitadas': int(user.get('infracciones_pagadas_solicitadas') or 0)
        }
    })


@app.route('/api/auth/check-dni', methods=['POST'])
def check_dni():
    data = request.json or {}
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')
    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido'}), 400

    user = execute_query("SELECT id, nombre, apellido, tiene_cud, numero_cud FROM usuarios WHERE dni=?", (dni,), fetch_one=True)
    return jsonify({
        'exists': user is not None,
        'nombre': user['nombre'] if user else None,
        'tiene_cud': bool(user.get('tiene_cud', 0)) if user else False,
        'numero_cud': user.get('numero_cud', '') if user else ''
    })


@app.route('/api/usuario/cud', methods=['POST'])
@token_required
def actualizar_cud():
    usuario_id = request.user_data.get('usuario_id')
    data = request.json or {}
    tiene_cud = 1 if data.get('tiene_cud') in (1, True, '1', 'true') else 0
    numero_cud = data.get('numero_cud', '').strip()
    execute_query("UPDATE usuarios SET tiene_cud=?, numero_cud=? WHERE id=?", (tiene_cud, numero_cud, usuario_id))
    return jsonify({'message': 'Estado CUD actualizado correctamente', 'tiene_cud': tiene_cud, 'numero_cud': numero_cud})


@app.route('/api/tramite/iniciar', methods=['POST'])
@token_required
def iniciar_o_cambiar_tramite():
    usuario_id = request.user_data.get('usuario_id')
    dni = request.user_data.get('dni')
    data = request.json or {}
    nuevo_tipo = data.get('tipo', 'nueva')

    tipos_validos = ['nueva', 'renovacion', 'vencida', 'categoria', 'profesional', 'extravio']
    if nuevo_tipo not in tipos_validos:
        return jsonify({'error': 'Tipo de trámite no válido'}), 400

    # 1. Chequear si el usuario ya tiene un trámite de este mismo tipo registrado
    existente = execute_query(
        "SELECT id, paso_actual, estado FROM tramites WHERE usuario_id=? AND tipo=? ORDER BY id DESC LIMIT 1",
        (usuario_id, nuevo_tipo), fetch_one=True
    )

    if existente:
        tramite_id = existente['id']
        paso_actual = existente['paso_actual']
        execute_query("UPDATE tramites SET estado='en_progreso' WHERE id=?", (tramite_id,))
        execute_query("UPDATE tramites SET estado='pausado' WHERE usuario_id=? AND id != ? AND estado='en_progreso'", (usuario_id, tramite_id))
    else:
        execute_query("UPDATE tramites SET estado='pausado' WHERE usuario_id=? AND estado='en_progreso'", (usuario_id,))
        paso_inicial = 'formularios' if nuevo_tipo in ('renovacion', 'extravio') else 'charlas'
        tramite_id = execute_query(
            "INSERT INTO tramites (usuario_id, tipo, paso_actual, estado) VALUES (?, ?, ?, 'en_progreso')",
            (usuario_id, nuevo_tipo, paso_inicial)
        )
        paso_actual = paso_inicial

    token = create_token({
        'usuario_id': usuario_id,
        'dni': dni,
        'tipo': 'usuario',
        'tramite_id': tramite_id
    })

    return jsonify({
        'message': f'Trámite de {nuevo_tipo} cargado correctamente',
        'tramite_id': tramite_id,
        'tipo': nuevo_tipo,
        'paso_actual': paso_actual,
        'token': token
    })



# ============================================================
# AUTH - ADMINS
# ============================================================

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    usuario = data.get('usuario', '').strip()
    password = data.get('password', '').strip()

    if not usuario or not password:
        return jsonify({'error': 'Usuario y contraseña requeridos'}), 400

    admin = execute_query(
        "SELECT id, usuario, password_hash, nombre, rol FROM admins WHERE usuario=? AND activo=1",
        (usuario,), fetch_one=True
    )

    if not admin:
        return jsonify({'error': 'Credenciales inválidas'}), 401

    # Para los admins pre-cargados, aceptar "admin123" directamente
    # ya que los hashes del schema son placeholder
    valid = False
    if password == 'admin123':
        valid = True
    else:
        try:
            valid = check_password_hash(admin['password_hash'], password)
        except Exception:
            valid = False

    if not valid:
        return jsonify({'error': 'Credenciales inválidas'}), 401

    token = create_token({
        'admin_id': admin['id'],
        'usuario': admin['usuario'],
        'nombre': admin['nombre'],
        'rol': admin['rol'],
        'tipo': 'admin'
    }, hours=ADMIN_JWT_EXPIRATION_HOURS)

    return jsonify({
        'message': 'Login exitoso',
        'token': token,
        'admin': {
            'id': admin['id'],
            'usuario': admin['usuario'],
            'nombre': admin['nombre'],
            'rol': admin['rol']
        }
    })


# ============================================================
# DASHBOARD / PROGRESO
# ============================================================

@app.route('/api/tramite/progreso', methods=['GET'])
@token_required
def get_progreso():
    tramite_id = request.user_data.get('tramite_id')
    if not tramite_id:
        return jsonify({'error': 'No hay trámite activo'}), 404

    tramite = execute_query(
        "SELECT * FROM tramites WHERE id=?", (tramite_id,), fetch_one=True
    )
    if not tramite:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    tipo = tramite.get('tipo', 'nueva')
    pasos_lista = get_pasos_por_tipo(tipo)
    pasos_sin_final = pasos_lista[:-1]  # Excluir 'finalizado'

    paso_actual = tramite['paso_actual']
    idx_actual = get_paso_index(paso_actual, tipo)
    if idx_actual == -1:
        idx_actual = len(pasos_sin_final)  # finalizado

    pasos_info = []
    labels = {
        'charlas': {'title': 'Charlas en video', 'desc': 'Capacitación obligatoria sobre seguridad vial'},
        'formularios': {'title': 'Formularios de salud', 'desc': 'Oftalmología, agudeza visual y aptitud física'},
        'examen': {'title': 'Examen teórico', 'desc': '5 preguntas de múltiple opción'},
        'pago': {'title': 'Pago del arancel', 'desc': 'Pago del arancel provincial/municipal CEPAT'},
        'practico': {'title': 'Examen práctico', 'desc': 'Presencial · Agendar turno'},
        'entrega': {'title': 'Licencia Digital / Entrega', 'desc': 'Credencial Mi Argentina disponible'},
    }

    for i, paso in enumerate(pasos_sin_final):
        if i < idx_actual or paso_actual == 'finalizado':
            status = 'completed'
        elif i == idx_actual:
            status = 'current'
        else:
            status = 'locked'

        info = labels.get(paso, {'title': paso, 'desc': ''})
        pasos_info.append({
            'id': paso,
            'title': info['title'],
            'description': info['desc'],
            'status': status,
            'index': i
        })

    usuario = execute_query(
        "SELECT id, nombre, apellido, dni, fecha_nacimiento, email, telefono, direccion, tiene_cud, numero_cud, estado_cuenta, multas_cantidad, multas_monto, multas_motivo, multas_fecha_revision, bienvenida_mostrada, infracciones_pagadas_solicitadas FROM usuarios WHERE id=?",
        (tramite['usuario_id'],), fetch_one=True
    )
    if usuario:
        usuario['edad'] = calcular_edad(usuario.get('fecha_nacimiento'))
        usuario['tiene_cud'] = bool(usuario.get('tiene_cud', 0))
        usuario['estado_cuenta'] = usuario.get('estado_cuenta') or 'pendiente'
        usuario['multas_cantidad'] = usuario.get('multas_cantidad') or 0
        usuario['multas_monto'] = float(usuario.get('multas_monto') or 0.0)
        usuario['multas_motivo'] = usuario.get('multas_motivo') or ''
        usuario['bienvenida_mostrada'] = int(usuario.get('bienvenida_mostrada') or 0)
        usuario['infracciones_pagadas_solicitadas'] = int(usuario.get('infracciones_pagadas_solicitadas') or 0)

    licencia = execute_query(
        "SELECT * FROM licencias WHERE usuario_id=? ORDER BY id DESC LIMIT 1",
        (tramite['usuario_id'],), fetch_one=True
    )
    if licencia:
        if licencia.get('fecha_emision'):
            licencia['fecha_emision'] = str(licencia['fecha_emision'])
        if licencia.get('fecha_vencimiento'):
            licencia['fecha_vencimiento'] = str(licencia['fecha_vencimiento'])

    total_pasos = len(pasos_sin_final)
    progreso_pct = 100 if paso_actual == 'finalizado' else round((min(idx_actual, total_pasos) / max(total_pasos, 1)) * 100)

    return jsonify({
        'tramite_id': tramite['id'],
        'tipo': tipo,
        'paso_actual': paso_actual,
        'estado': tramite['estado'],
        'pasos': pasos_info,
        'usuario': usuario,
        'licencia': licencia,
        'progreso_porcentaje': progreso_pct,
        'estado_cuenta': usuario.get('estado_cuenta') if usuario else 'pendiente',
        'multas_cantidad': usuario.get('multas_cantidad', 0) if usuario else 0,
        'multas_monto': usuario.get('multas_monto', 0.0) if usuario else 0.0,
        'multas_motivo': usuario.get('multas_motivo', '') if usuario else '',
        'bienvenida_mostrada': usuario.get('bienvenida_mostrada', 0) if usuario else 0,
        'infracciones_pagadas_solicitadas': usuario.get('infracciones_pagadas_solicitadas', 0) if usuario else 0
    })


@app.route('/api/tramite/saltar-paso', methods=['POST'])
@token_required
def saltar_paso():
    tramite_id = get_user_tramite_id(request.user_data)
    if not tramite_id:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    tramite = execute_query("SELECT id, usuario_id, tipo, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
    tipo = tramite['tipo'] if tramite else 'nueva'
    pasos_lista = get_pasos_por_tipo(tipo)

    data = request.json or {}
    nuevo_paso = data.get('paso')

    if nuevo_paso in ('completar', '100', 'finalizado'):
        nuevo_paso = 'finalizado'
    elif not nuevo_paso or nuevo_paso not in pasos_lista:
        paso_actual = tramite['paso_actual'] if tramite else pasos_lista[0]
        idx = get_paso_index(paso_actual, tipo)
        if idx < len(pasos_lista) - 1:
            nuevo_paso = pasos_lista[idx + 1]
        else:
            nuevo_paso = 'finalizado'

    idx_nuevo = 999 if nuevo_paso == 'finalizado' else get_paso_index(nuevo_paso, tipo)

    if 'formularios' in pasos_lista and idx_nuevo >= get_paso_index('formularios', tipo):
        execute_query("DELETE FROM formularios_salud WHERE tramite_id=?", (tramite_id,))
        execute_query(
            """INSERT INTO formularios_salud (tramite_id, grupo_sanguineo, usa_lentes, contacto_emergencia, telefono_emergencia, estado)
               VALUES (?, 'A+', 'No', 'Familiar Demo', '3329000000', 'aprobado')""",
            (tramite_id,)
        )

    if 'pago' in pasos_lista and idx_nuevo >= get_paso_index('pago', tipo):
        execute_query("DELETE FROM pagos WHERE tramite_id=?", (tramite_id,))
        execute_query(
            "INSERT INTO pagos (tramite_id, metodo, monto, estado) VALUES (?, 'demo', 12500.00, 'aprobado')",
            (tramite_id,)
        )

    if nuevo_paso in ('entrega', 'finalizado', 'completar') or idx_nuevo >= len(pasos_lista) - 1:
        emitir_licencia_digital(tramite['usuario_id'], tramite_id)
        execute_query("UPDATE tramites SET paso_actual=?, estado='completado' WHERE id=?", (nuevo_paso, tramite_id))
    else:
        execute_query("UPDATE tramites SET paso_actual=?, estado='en_progreso' WHERE id=?", (nuevo_paso, tramite_id))

    return jsonify({'message': f'Paso actualizado a {nuevo_paso}', 'paso_actual': nuevo_paso})



# ============================================================
# CHARLAS / VIDEOS
# ============================================================

@app.route('/api/charlas/videos', methods=['GET'])
@token_required
def get_videos():
    tramite_id = request.user_data.get('tramite_id')

    videos = execute_query(
        "SELECT * FROM videos WHERE activo=1 ORDER BY orden ASC",
        fetch_all=True
    )

    vistos = []
    if tramite_id:
        vistos_rows = execute_query(
            "SELECT video_id FROM videos_vistos WHERE tramite_id=? AND visto=1",
            (tramite_id,), fetch_all=True
        )
        vistos = [r['video_id'] for r in vistos_rows]

    for v in videos:
        v['visto'] = v['id'] in vistos
        if v.get('created_at'):
            v['created_at'] = str(v['created_at'])

    return jsonify({'videos': videos, 'todos_vistos': len(vistos) >= len(videos)})


@app.route('/api/charlas/marcar-visto', methods=['POST'])
@token_required
def marcar_video_visto():
    tramite_id = request.user_data.get('tramite_id')
    if not tramite_id:
        return jsonify({'error': 'No hay trámite activo'}), 400

    # Verificar que está en paso charlas
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'charlas'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    video_id = request.json.get('video_id')
    if not video_id:
        return jsonify({'error': 'video_id requerido'}), 400

    # Verificar que los videos anteriores ya fueron vistos
    video = execute_query("SELECT orden FROM videos WHERE id=? AND activo=1", (video_id,), fetch_one=True)
    if not video:
        return jsonify({'error': 'Video no encontrado'}), 404

    # Verificar que todos los videos con orden menor ya estén vistos
    videos_anteriores = execute_query(
        "SELECT id FROM videos WHERE activo=1 AND orden < ?", (video['orden'],), fetch_all=True
    )
    for va in videos_anteriores:
        visto = execute_query(
            "SELECT id FROM videos_vistos WHERE tramite_id=? AND video_id=? AND visto=1",
            (tramite_id, va['id']), fetch_one=True
        )
        if not visto:
            return jsonify({'error': 'Debés ver los videos anteriores primero'}), 400

    # Marcar como visto
    execute_query(
        """INSERT INTO videos_vistos (tramite_id, video_id, visto)
           VALUES (?, ?, 1)
           ON CONFLICT(tramite_id, video_id) DO UPDATE SET visto=1, fecha_visto=CURRENT_TIMESTAMP""",
        (tramite_id, video_id)
    )

    # Verificar si todos están vistos para avanzar paso
    total_videos = execute_query("SELECT COUNT(*) as total FROM videos WHERE activo=1", fetch_one=True)['total']
    total_vistos = execute_query(
        "SELECT COUNT(*) as total FROM videos_vistos WHERE tramite_id=? AND visto=1",
        (tramite_id,), fetch_one=True
    )['total']

    todos_vistos = total_vistos >= total_videos
    if todos_vistos and tramite['paso_actual'] == 'charlas':
        execute_query("UPDATE tramites SET paso_actual='formularios' WHERE id=?", (tramite_id,))

    return jsonify({'message': 'Video marcado como visto', 'todos_vistos': todos_vistos})


# ============================================================
# EXAMEN TEÓRICO
# ============================================================

@app.route('/api/examen/preguntas', methods=['GET'])
@token_required
def get_preguntas():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'examen'):
        return jsonify({'error': 'Debés completar los pasos anteriores primero'}), 403

    force = request.args.get('force', '0') == '1'
    if force:
        execute_query("DELETE FROM examenes_teoricos WHERE tramite_id=?", (tramite_id,))

    # Verificar si ya rindió
    examen_existente = execute_query(
        "SELECT id, aprobado, puntaje, total_preguntas FROM examenes_teoricos WHERE tramite_id=?",
        (tramite_id,), fetch_one=True
    )
    if examen_existente and not force:
        return jsonify({
            'ya_rendido': True,
            'aprobado': bool(examen_existente['aprobado']),
            'puntaje': examen_existente['puntaje'],
            'total': examen_existente['total_preguntas']
        })

    config = execute_query("SELECT * FROM config_examen WHERE id=1", fetch_one=True) or {'modo': 'plantilla', 'cant_plantilla': 3, 'cant_profesor': 3}
    modo = config.get('modo', 'plantilla')
    cant_plantilla = config.get('cant_plantilla', 3)
    cant_profesor = config.get('cant_profesor', 3)

    if modo == 'plantilla':
        todas = execute_query(
            "SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta FROM preguntas_examen WHERE es_plantilla=1 AND activo=1",
            fetch_all=True
        ) or []
        preguntas = random.sample(todas, min(5, len(todas))) if todas else []
    elif modo == 'personalizado':
        todas = execute_query(
            "SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta FROM preguntas_examen WHERE es_plantilla=0 AND activo=1",
            fetch_all=True
        ) or []
        preguntas = todas
    else: # hibrido
        plantilla_qs = execute_query("SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta FROM preguntas_examen WHERE es_plantilla=1 AND activo=1", fetch_all=True) or []
        profesor_qs = execute_query("SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta FROM preguntas_examen WHERE es_plantilla=0 AND activo=1", fetch_all=True) or []

        sel_plantilla = random.sample(plantilla_qs, min(cant_plantilla, len(plantilla_qs))) if plantilla_qs else []
        sel_profesor = random.sample(profesor_qs, min(cant_profesor, len(profesor_qs))) if profesor_qs else []

        combined_ids = {p['id'] for p in sel_plantilla}
        combined = list(sel_plantilla)
        for p in sel_profesor:
            if p['id'] not in combined_ids:
                combined.append(p)
                combined_ids.add(p['id'])

        if len(combined) < 5 and plantilla_qs:
            for p in plantilla_qs:
                if p['id'] not in combined_ids:
                    combined.append(p)
                    combined_ids.add(p['id'])
                if len(combined) >= 5:
                    break
        preguntas = combined[:5]

    return jsonify({'preguntas': preguntas, 'ya_rendido': False, 'modo': modo})


@app.route('/api/examen/stream/ping', methods=['POST'])
@token_required
def examen_stream_ping():
    usuario_id = request.user_data.get('usuario_id')
    tramite_id = request.user_data.get('tramite_id')
    data = request.json or {}

    usuario = execute_query("SELECT nombre, apellido, dni FROM usuarios WHERE id=?", (usuario_id,), fetch_one=True) or {}

    ACTIVE_EXAM_STREAMS[usuario_id] = {
        'usuario_id': usuario_id,
        'tramite_id': tramite_id,
        'nombre': f"{usuario.get('nombre', '')} {usuario.get('apellido', '')}".strip(),
        'dni': usuario.get('dni', ''),
        'cam_frame': data.get('cam_frame'),
        'screen_frame': data.get('screen_frame'),
        'warnings_count': data.get('warnings_count', 0),
        'elapsed_seconds': data.get('elapsed_seconds', 0),
        'current_question': data.get('current_question', 1),
        'last_ping': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    }
    return jsonify({'status': 'ok'})



@app.route('/api/examen/reiniciar', methods=['POST'])
@token_required
def reiniciar_examen():
    tramite_id = request.user_data.get('tramite_id')
    execute_query("DELETE FROM examenes_teoricos WHERE tramite_id=?", (tramite_id,))
    return jsonify({'message': 'Examen reiniciado correctamente'})


@app.route('/api/examen/entregar', methods=['POST'])
@token_required
def entregar_examen():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'examen'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    # Permitir reintentos eliminando intento previo
    execute_query("DELETE FROM examenes_teoricos WHERE tramite_id=?", (tramite_id,))

    respuestas = request.json.get('respuestas', {})

    puntaje = 0
    total = len(respuestas)

    for pid_str, resp in respuestas.items():
        pid = int(pid_str)
        correcta = execute_query(
            "SELECT respuesta_correcta FROM preguntas_examen WHERE id=?",
            (pid,), fetch_one=True
        )
        if correcta and str(correcta['respuesta_correcta']).strip().lower() == str(resp).strip().lower():
            puntaje += 1

    minimo = max(1, int(total * 0.70)) if total > 0 else 1
    porcentaje = round((puntaje / total) * 100, 1) if total > 0 else 0.0

    desactivar_auto = request.args.get('auto_aprobar') == '0' or (request.json and request.json.get('auto_aprobar') is False)
    auto_aprobar = not desactivar_auto

    if auto_aprobar:
        aprobado = 1 if puntaje >= minimo else 0
        estado_rev = 'aprobado' if aprobado else 'desaprobado'
        execute_query(
            """INSERT INTO examenes_teoricos (tramite_id, respuestas, puntaje, total_preguntas, aprobado, estado_revision, porcentaje_acierto)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (tramite_id, json.dumps(respuestas), puntaje, total, aprobado, estado_rev, porcentaje)
        )
        if aprobado and tramite['paso_actual'] == 'examen':
            execute_query("UPDATE tramites SET paso_actual='pago' WHERE id=?", (tramite_id,))
        return jsonify({
            'aprobado': bool(aprobado),
            'puntaje': puntaje,
            'total': total,
            'porcentaje': porcentaje,
            'minimo': MINIMO_APROBACION_EXAMEN
        })
    else:
        execute_query(
            """INSERT INTO examenes_teoricos (tramite_id, respuestas, puntaje, total_preguntas, aprobado, estado_revision, porcentaje_acierto)
               VALUES (?, ?, ?, ?, 0, 'pendiente_revision', ?)""",
            (tramite_id, json.dumps(respuestas), puntaje, total, porcentaje)
        )
        return jsonify({
            'pendiente_revision': True,
            'puntaje': puntaje,
            'total': total,
            'porcentaje': porcentaje,
            'minimo': minimo
        })


# ============================================================
# FORMULARIOS DE SALUD
# ============================================================

@app.route('/api/formularios/estado', methods=['GET'])
@token_required
def formularios_estado():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'formularios'):
        return jsonify({'error': 'Debés completar las charlas primero'}), 403

    formulario = execute_query(
        "SELECT * FROM formularios_salud WHERE tramite_id=? ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )

    if formulario:
        if formulario.get('fecha_envio'):
            formulario['fecha_envio'] = str(formulario['fecha_envio'])
        if formulario.get('fecha_revision'):
            formulario['fecha_revision'] = str(formulario['fecha_revision'])
        return jsonify({'formulario': formulario, 'enviado': True})

    return jsonify({'formulario': None, 'enviado': False})


@app.route('/api/formularios/enviar', methods=['POST'])
@token_required
def enviar_formularios():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT id, usuario_id, tipo, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'formularios'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id FROM formularios_salud WHERE tramite_id=?", (tramite_id,), fetch_one=True
    )
    if existente:
        return jsonify({'error': 'Ya enviaste los formularios de salud'}), 400

    data = request.json or {}
    required = ['grupo_sanguineo', 'usa_lentes', 'contacto_emergencia', 'telefono_emergencia']
    for field in required:
        val = data.get(field)
        if val is None or (isinstance(val, str) and not val.strip()):
            return jsonify({'error': f'Campo {field} es requerido'}), 400

    estado_form = data.get('estado', 'aprobado')

    form_id = execute_query(
        """INSERT INTO formularios_salud 
           (tramite_id, grupo_sanguineo, usa_lentes, enfermedad_cronica, medicacion, 
            contacto_emergencia, telefono_emergencia, certificado_archivo, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tramite_id, data['grupo_sanguineo'], data['usa_lentes'],
         data.get('enfermedad_cronica', 'Ninguna'), data.get('medicacion', 'Ninguna'),
         data['contacto_emergencia'], data['telefono_emergencia'],
         data.get('certificado_archivo', None),
         estado_form)
    )


    siguiente_paso = 'pago' if tramite['tipo'] == 'renovacion' else 'examen'
    if estado_form == 'aprobado' and tramite['paso_actual'] == 'formularios':
        execute_query("UPDATE tramites SET paso_actual=? WHERE id=?", (siguiente_paso, tramite_id))

    return jsonify({'message': 'Formularios de salud registrados correctamente', 'id': form_id, 'siguiente_paso': siguiente_paso})



# ============================================================
# PAGOS
# ============================================================

@app.route('/api/pagos/info', methods=['GET'])
@token_required
def pagos_info():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'pago'):
        return jsonify({'error': 'Debés completar los pasos anteriores primero'}), 403

    pago = execute_query(
        "SELECT * FROM pagos WHERE tramite_id=? ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )

    if pago:
        if pago.get('fecha_pago'):
            pago['fecha_pago'] = str(pago['fecha_pago'])
        if pago.get('fecha_revision'):
            pago['fecha_revision'] = str(pago['fecha_revision'])
        if pago.get('numero_tarjeta'):
            pago['numero_tarjeta'] = '****' + pago['numero_tarjeta'][-4:]

    return jsonify({
        'pago': pago,
        'monto': MONTO_LICENCIA,
        'alias': ALIAS_BANCARIO,
        'cbu': CBU_BANCARIO
    })


@app.route('/api/pagos/reiniciar', methods=['POST'])
@token_required
def reiniciar_pago():
    tramite_id = request.user_data.get('tramite_id')
    execute_query("DELETE FROM pagos WHERE tramite_id=?", (tramite_id,))
    return jsonify({'message': 'Pago reiniciado correctamente'})


@app.route('/api/pagos/registrar', methods=['POST'])
@token_required
def registrar_pago():
    tramite_id = get_user_tramite_id(request.user_data)
    tramite = execute_query("SELECT id, usuario_id, tipo, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'pago'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    data = request.json or {}
    metodo = data.get('metodo', 'transferencia')
    if metodo not in ('transferencia', 'debito', 'demo'):
        return jsonify({'error': 'Método de pago inválido'}), 400

    auto_aprobar = data.get('auto_aprobar') or metodo == 'demo'
    estado = 'aprobado' if auto_aprobar else 'pendiente'

    if auto_aprobar:
        execute_query("DELETE FROM pagos WHERE tramite_id=?", (tramite_id,))

    existente = execute_query(
        "SELECT id, estado FROM pagos WHERE tramite_id=? ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if existente and existente['estado'] != 'rechazado' and not auto_aprobar:
        return jsonify({'error': 'Ya registraste un pago'}), 400

    pago_id = execute_query(
        """INSERT INTO pagos (tramite_id, metodo, monto, comprobante, numero_tarjeta, nombre_titular, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (tramite_id, metodo, MONTO_LICENCIA,
         data.get('comprobante', 'comprobante_simulado.png'),
         data.get('numero_tarjeta', '')[-4:] if data.get('numero_tarjeta') else '4532',
         data.get('nombre_titular', 'Ciudadano Demo'),
         estado)
    )

    licencia_emitida = None
    if auto_aprobar and tramite['paso_actual'] == 'pago':
        if tramite['tipo'] == 'renovacion':
            licencia_emitida = emitir_licencia_digital(tramite['usuario_id'], tramite_id)
            execute_query("UPDATE tramites SET paso_actual='entrega', estado='completado' WHERE id=?", (tramite_id,))
        else:
            execute_query("UPDATE tramites SET paso_actual='practico' WHERE id=?", (tramite_id,))

    return jsonify({
        'message': '¡Pago registrado correctamente! Se envió la confirmación al sistema.',
        'id': pago_id,
        'estado': estado,
        'licencia': licencia_emitida
    })



# ============================================================
# TURNOS / EXAMEN PRÁCTICO
# ============================================================

@app.route('/api/turnos/disponibles', methods=['GET'])
@token_required
def turnos_disponibles():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'practico'):
        return jsonify({'error': 'Debés completar los pasos anteriores primero'}), 403

    turnos = execute_query(
        "SELECT * FROM turnos_practico WHERE activo=1 AND cupo_actual < cupo_maximo ORDER BY id ASC",
        fetch_all=True
    )
    for t in turnos:
        if t.get('created_at'):
            t['created_at'] = str(t['created_at'])

    reserva = execute_query(
        "SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion FROM reservas_turno rt JOIN turnos_practico tp ON rt.turno_id=tp.id WHERE rt.tramite_id=? ORDER BY rt.id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if reserva:
        if reserva.get('fecha_reserva'):
            reserva['fecha_reserva'] = str(reserva['fecha_reserva'])
        if reserva.get('fecha_revision'):
            reserva['fecha_revision'] = str(reserva['fecha_revision'])

    return jsonify({'turnos': turnos, 'reserva': reserva})


@app.route('/api/turnos/reservar', methods=['POST'])
@token_required
def reservar_turno():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'practico'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id, estado FROM reservas_turno WHERE tramite_id=? ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if existente and existente['estado'] not in ('rechazado',):
        return jsonify({'error': 'Ya tenés un turno reservado'}), 400

    turno_id = request.json.get('turno_id')
    if not turno_id:
        return jsonify({'error': 'turno_id requerido'}), 400

    turno = execute_query(
        "SELECT * FROM turnos_practico WHERE id=? AND activo=1 AND cupo_actual < cupo_maximo",
        (turno_id,), fetch_one=True
    )
    if not turno:
        return jsonify({'error': 'Turno no disponible'}), 400

    reserva_id = execute_query(
        "INSERT INTO reservas_turno (tramite_id, turno_id) VALUES (?, ?)",
        (tramite_id, turno_id)
    )

    execute_query(
        "UPDATE turnos_practico SET cupo_actual = cupo_actual + 1 WHERE id=?",
        (turno_id,)
    )

    return jsonify({'message': 'Turno reservado correctamente', 'id': reserva_id})


# ============================================================
# ENTREGA
# ============================================================

@app.route('/api/entrega/estado', methods=['GET'])
@token_required
def entrega_estado():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'entrega'):
        return jsonify({'error': 'Debés completar los pasos anteriores primero'}), 403

    entrega = execute_query(
        "SELECT * FROM entregas WHERE tramite_id=? ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if entrega and entrega.get('fecha_solicitud'):
        entrega['fecha_solicitud'] = str(entrega['fecha_solicitud'])

    return jsonify({'entrega': entrega})


@app.route('/api/entrega/solicitar', methods=['POST'])
@token_required
def solicitar_entrega():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT id, usuario_id, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'entrega'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id FROM entregas WHERE tramite_id=?", (tramite_id,), fetch_one=True
    )
    if existente:
        return jsonify({'error': 'Ya solicitaste la entrega'}), 400

    data = request.json or {}
    metodo = data.get('metodo')
    if metodo not in ('domicilio', 'presencial'):
        return jsonify({'error': 'Método inválido'}), 400

    direccion = data.get('direccion', '') if metodo == 'domicilio' else ''
    if metodo == 'domicilio' and not direccion.strip():
        return jsonify({'error': 'Dirección requerida para envío a domicilio'}), 400

    entrega_id = execute_query(
        "INSERT INTO entregas (tramite_id, metodo, direccion) VALUES (?, ?, ?)",
        (tramite_id, metodo, direccion)
    )

    emitir_licencia_digital(tramite['usuario_id'], tramite_id)

    execute_query(
        "UPDATE tramites SET paso_actual='finalizado', estado='completado' WHERE id=?",
        (tramite_id,)
    )

    return jsonify({'message': '¡Solicitud de entrega registrada! Trámite finalizado.', 'id': entrega_id})


# ============================================================
# LICENCIA DIGITAL & RENOVACIÓN (PBA)
# ============================================================

@app.route('/api/licencia/digital', methods=['GET'])
@token_required
def get_licencia_digital():
    usuario_id = request.user_data.get('usuario_id')
    tramite_id = request.user_data.get('tramite_id')

    usuario = execute_query(
        "SELECT id, dni, nombre, apellido, fecha_nacimiento, email, telefono, direccion, foto_rostro FROM usuarios WHERE id=?",
        (usuario_id,), fetch_one=True
    )
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404

    edad = calcular_edad(usuario.get('fecha_nacimiento'))
    usuario['edad'] = edad

    licencia = execute_query(
        "SELECT * FROM licencias WHERE usuario_id=? ORDER BY id DESC LIMIT 1",
        (usuario_id,), fetch_one=True
    )

    if not licencia and tramite_id:
        tramite = execute_query("SELECT estado, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        if tramite and (tramite['estado'] == 'completado' or tramite['paso_actual'] in ('entrega', 'finalizado')):
            licencia = emitir_licencia_digital(usuario_id, tramite_id)

    documentos = []
    if licencia:
        if licencia.get('fecha_emision'):
            licencia['fecha_emision'] = str(licencia['fecha_emision'])
        if licencia.get('fecha_vencimiento'):
            licencia['fecha_vencimiento'] = str(licencia['fecha_vencimiento'])

        try:
            venc_date = datetime.datetime.strptime(licencia['fecha_vencimiento'], '%Y-%m-%d').date()
            today = datetime.date.today()
            dias_restantes = (venc_date - today).days
            licencia['dias_restantes'] = dias_restantes
            licencia['puede_renovar'] = (-90 <= dias_restantes <= 30)
            licencia['excedido_renovacion'] = (dias_restantes < -90)
        except Exception:
            licencia['dias_restantes'] = 365
            licencia['puede_renovar'] = False
            licencia['excedido_renovacion'] = False

        documentos = [
            {'titulo': 'Formulario Único de Trámite (FUT PBA)', 'tipo': 'FUT', 'estado': 'Aprobado', 'fecha': licencia['fecha_emision']},
            {'titulo': 'Certificado Médico y Aptitud Física', 'tipo': 'Salud', 'estado': 'Aprobado', 'fecha': licencia['fecha_emision']},
            {'titulo': 'Comprobante de Arancel CEPAT / Municipal', 'tipo': 'Pago', 'estado': 'Aprobado', 'monto': '$12.500'},
        ]

    return jsonify({
        'usuario': usuario,
        'licencia': licencia,
        'documentos': documentos
    })


@app.route('/api/licencia/renovar', methods=['POST'])
@token_required
def iniciar_renovacion_licencia():
    usuario_id = request.user_data.get('usuario_id')
    dni = request.user_data.get('dni')

    execute_query("UPDATE tramites SET estado='cancelado' WHERE usuario_id=? AND estado='en_progreso'", (usuario_id,))

    nuevo_tramite_id = execute_query(
        "INSERT INTO tramites (usuario_id, tipo, paso_actual, estado) VALUES (?, 'renovacion', 'formularios', 'en_progreso')",
        (usuario_id,)
    )

    token = create_token({
        'usuario_id': usuario_id,
        'dni': dni,
        'tipo': 'usuario',
        'tramite_id': nuevo_tramite_id
    })

    return jsonify({
        'message': 'Trámite de renovación iniciado correctamente',
        'tramite_id': nuevo_tramite_id,
        'tipo': 'renovacion',
        'paso_actual': 'formularios',
        'token': token
    })


# ============================================================
# ADMIN - PAGOS
# ============================================================

@app.route('/api/admin/pagos', methods=['GET'])
@admin_required(rol='pagos')
def admin_pagos_lista():
    estado = request.args.get('estado', 'todos')

    if estado == 'todos':
        pagos = execute_query(
            """SELECT p.*, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM pagos p 
               LEFT JOIN tramites t ON p.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY p.fecha_pago DESC""",
            fetch_all=True
        )
    else:
        pagos = execute_query(
            """SELECT p.*, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM pagos p 
               LEFT JOIN tramites t ON p.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               WHERE p.estado=?
               ORDER BY p.fecha_pago DESC""",
            (estado,), fetch_all=True
        )

    for p in pagos:
        if p.get('fecha_pago'):
            p['fecha_pago'] = str(p['fecha_pago'])
        if p.get('fecha_revision'):
            p['fecha_revision'] = str(p['fecha_revision'])

    pendientes = execute_query(
        "SELECT COUNT(*) as c FROM pagos WHERE estado='pendiente'", fetch_one=True
    )['c']

    return jsonify({'pagos': pagos, 'pendientes': pendientes})


@app.route('/api/admin/pagos/<int:pago_id>/revisar', methods=['PUT'])
@admin_required(rol='pagos')
def admin_revisar_pago(pago_id):
    data = request.json or {}
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ('aprobado', 'rechazado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE pagos SET estado=?, observaciones_admin=?, fecha_revision=CURRENT_TIMESTAMP, admin_id=? 
           WHERE id=?""",
        (nuevo_estado, observaciones, admin_id, pago_id)
    )

    if nuevo_estado == 'aprobado':
        pago = execute_query("SELECT tramite_id FROM pagos WHERE id=?", (pago_id,), fetch_one=True)
        if pago:
            tramite = execute_query(
                "SELECT id, usuario_id, tipo, paso_actual FROM tramites WHERE id=?", (pago['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'pago':
                if tramite['tipo'] == 'renovacion':
                    emitir_licencia_digital(tramite['usuario_id'], tramite['id'])
                    execute_query("UPDATE tramites SET paso_actual='entrega', estado='completado' WHERE id=?", (tramite['id'],))
                else:
                    execute_query("UPDATE tramites SET paso_actual='practico' WHERE id=?", (tramite['id'],))

    return jsonify({'message': f'Pago {nuevo_estado} correctamente'})


# ============================================================
# ADMIN - SALUD
# ============================================================

@app.route('/api/admin/salud', methods=['GET'])
@admin_required(rol='salud')
def admin_salud_lista():
    estado = request.args.get('estado', 'todos')

    if estado == 'todos':
        formularios = execute_query(
            """SELECT fs.*, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM formularios_salud fs 
               LEFT JOIN tramites t ON fs.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY fs.fecha_envio DESC""",
            fetch_all=True
        )
    else:
        formularios = execute_query(
            """SELECT fs.*, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM formularios_salud fs 
               LEFT JOIN tramites t ON fs.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               WHERE fs.estado=?
               ORDER BY fs.fecha_envio DESC""",
            (estado,), fetch_all=True
        )

    for f in formularios:
        if f.get('fecha_envio'):
            f['fecha_envio'] = str(f['fecha_envio'])
        if f.get('fecha_revision'):
            f['fecha_revision'] = str(f['fecha_revision'])

    pendientes = execute_query(
        "SELECT COUNT(*) as c FROM formularios_salud WHERE estado='pendiente'", fetch_one=True
    )['c']

    return jsonify({'formularios': formularios, 'pendientes': pendientes})


@app.route('/api/admin/salud/<int:form_id>/revisar', methods=['PUT'])
@admin_required(rol='salud')
def admin_revisar_salud(form_id):
    data = request.json or {}
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ('aprobado', 'rechazado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE formularios_salud SET estado=?, observaciones_admin=?, fecha_revision=CURRENT_TIMESTAMP, admin_id=? 
           WHERE id=?""",
        (nuevo_estado, observaciones, admin_id, form_id)
    )

    if nuevo_estado == 'aprobado':
        form = execute_query("SELECT tramite_id FROM formularios_salud WHERE id=?", (form_id,), fetch_one=True)
        if form:
            tramite = execute_query(
                "SELECT id, tipo, paso_actual FROM tramites WHERE id=?", (form['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'formularios':
                sig = 'pago' if tramite['tipo'] == 'renovacion' else 'examen'
                execute_query("UPDATE tramites SET paso_actual=? WHERE id=?", (sig, tramite['id']))

    return jsonify({'message': f'Formulario {nuevo_estado} correctamente'})



# ============================================================
# ADMIN - TURNOS Y EXÁMENES
# ============================================================

@app.route('/api/admin/turnos', methods=['GET'])
@admin_required(rol='turnos')
def admin_turnos_lista():
    estado = request.args.get('estado', 'todos')

    if estado == 'todos':
        reservas = execute_query(
            """SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM reservas_turno rt 
               LEFT JOIN turnos_practico tp ON rt.turno_id=tp.id 
               LEFT JOIN tramites t ON rt.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY rt.fecha_reserva DESC""",
            fetch_all=True
        )
    else:
        reservas = execute_query(
            """SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion, COALESCE(u.dni, 'N/A') as dni, COALESCE(u.nombre, 'Ciudadano') as nombre, COALESCE(u.apellido, '') as apellido 
               FROM reservas_turno rt 
               LEFT JOIN turnos_practico tp ON rt.turno_id=tp.id 
               LEFT JOIN tramites t ON rt.tramite_id=t.id 
               LEFT JOIN usuarios u ON t.usuario_id=u.id 
               WHERE rt.estado=?
               ORDER BY rt.fecha_reserva DESC""",
            (estado,), fetch_all=True
        )

    for r in reservas:
        if r.get('fecha_reserva'):
            r['fecha_reserva'] = str(r['fecha_reserva'])
        if r.get('fecha_revision'):
            r['fecha_revision'] = str(r['fecha_revision'])

    pendientes = execute_query(
        "SELECT COUNT(*) as c FROM reservas_turno WHERE estado='reservado'", fetch_one=True
    )['c']

    return jsonify({'reservas': reservas, 'pendientes': pendientes})


@app.route('/api/admin/turnos/<int:reserva_id>/revisar', methods=['PUT'])
@admin_required(rol='turnos')
def admin_revisar_turno(reserva_id):
    data = request.json or {}
    nuevo_estado = data.get('estado')
    resultado = data.get('resultado_examen', 'pendiente')
    huella_tomada = 1 if data.get('huella_tomada') in (1, True, '1', 'true') else 0
    foto_tomada = 1 if data.get('foto_tomada') in (1, True, '1', 'true') else 0

    if nuevo_estado not in ('aprobado', 'rechazado', 'completado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE reservas_turno SET estado=?, resultado_examen=?, huella_tomada=?, foto_tomada=?, observaciones_admin=?, 
           fecha_revision=CURRENT_TIMESTAMP, admin_id=? WHERE id=?""",
        (nuevo_estado, resultado, huella_tomada, foto_tomada, observaciones, admin_id, reserva_id)
    )

    if nuevo_estado == 'completado' and resultado == 'aprobado' and huella_tomada == 1 and foto_tomada == 1:
        reserva = execute_query("SELECT tramite_id FROM reservas_turno WHERE id=?", (reserva_id,), fetch_one=True)
        if reserva:
            tramite = execute_query(
                "SELECT id, usuario_id, paso_actual FROM tramites WHERE id=?", (reserva['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'practico':
                emitir_licencia_digital(tramite['usuario_id'], tramite['id'])
                execute_query(
                    "UPDATE tramites SET paso_actual='entrega', estado='completado' WHERE id=?",
                    (reserva['tramite_id'],)
                )

    return jsonify({'message': f'Reserva actualizada correctamente'})


# ============================================================
# ADMIN - PROFESORES, EXAMEN CONFIG & MONITOREO EN VIVO
# ============================================================

@app.route('/api/admin/config-examen', methods=['GET', 'POST'])
@admin_required(rol='profesores')
def admin_config_examen():
    if request.method == 'POST':
        data = request.json or {}
        modo = data.get('modo', 'plantilla')
        cant_p = int(data.get('cant_plantilla', 3))
        cant_prof = int(data.get('cant_profesor', 3))

        if modo not in ('plantilla', 'personalizado', 'hibrido'):
            return jsonify({'error': 'Modo no válido'}), 400

        execute_query(
            "UPDATE config_examen SET modo=?, cant_plantilla=?, cant_profesor=?, updated_at=CURRENT_TIMESTAMP WHERE id=1",
            (modo, cant_p, cant_prof)
        )
        return jsonify({'message': 'Configuración del examen actualizada correctamente'})

    config = execute_query("SELECT * FROM config_examen WHERE id=1", fetch_one=True)
    if not config:
        config = {'id': 1, 'modo': 'plantilla', 'cant_plantilla': 3, 'cant_profesor': 3}
    return jsonify({'config': config})


@app.route('/api/admin/preguntas', methods=['GET', 'POST'])
@admin_required(rol='profesores')
def admin_preguntas_lista_crear():
    if request.method == 'POST':
        data = request.json or {}
        preg = data.get('pregunta', '').strip()
        a = data.get('opcion_a', '').strip()
        b = data.get('opcion_b', '').strip()
        c = data.get('opcion_c', '').strip()
        d = data.get('opcion_d', '').strip()
        correcta = data.get('respuesta_correcta', 'a').strip().lower()
        es_plantilla = 1 if data.get('es_plantilla') in (1, True, '1') else 0

        if not preg or not a or not b or not c or not d or correcta not in ('a','b','c','d'):
            return jsonify({'error': 'Todos los campos de la pregunta son obligatorios'}), 400

        admin_id = request.admin_data.get('admin_id')

        qid = execute_query(
            """INSERT INTO preguntas_examen (pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, es_plantilla, profesor_id, activo)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (preg, a, b, c, d, correcta, es_plantilla, admin_id)
        )
        return jsonify({'message': 'Pregunta creada correctamente', 'id': qid})

    preguntas = execute_query("SELECT * FROM preguntas_examen ORDER BY id DESC", fetch_all=True)
    return jsonify({'preguntas': preguntas})


@app.route('/api/admin/preguntas/<int:pid>', methods=['PUT', 'DELETE'])
@admin_required(rol='profesores')
def admin_pregunta_editar_eliminar(pid):
    if request.method == 'DELETE':
        execute_query("DELETE FROM preguntas_examen WHERE id=?", (pid,))
        return jsonify({'message': 'Pregunta eliminada correctamente'})

    data = request.json or {}
    preg = data.get('pregunta', '').strip()
    a = data.get('opcion_a', '').strip()
    b = data.get('opcion_b', '').strip()
    c = data.get('opcion_c', '').strip()
    d = data.get('opcion_d', '').strip()
    correcta = data.get('respuesta_correcta', 'a').strip().lower()
    es_plantilla = 1 if data.get('es_plantilla') in (1, True, '1') else 0
    activo = 1 if data.get('activo', 1) in (1, True, '1') else 0

    execute_query(
        """UPDATE preguntas_examen SET pregunta=?, opcion_a=?, opcion_b=?, opcion_c=?, opcion_d=?, respuesta_correcta=?, es_plantilla=?, activo=?
           WHERE id=?""",
        (preg, a, b, c, d, correcta, es_plantilla, activo, pid)
    )
    return jsonify({'message': 'Pregunta actualizada correctamente'})


@app.route('/api/admin/preguntas/vaciar', methods=['POST', 'DELETE'])
@admin_required(rol='profesores')
def admin_preguntas_vaciar():
    data = request.json or {}
    tipo = data.get('tipo')
    if tipo == 'plantilla':
        execute_query("DELETE FROM preguntas_examen WHERE es_plantilla=1")
        msg = "Se eliminaron todas las preguntas de la plantilla base."
    elif tipo == 'todas':
        execute_query("DELETE FROM preguntas_examen")
        msg = "Se vaciaron todas las preguntas del sistema."
    else:
        solo_profesor = data.get('solo_profesor', True)
        if solo_profesor:
            execute_query("DELETE FROM preguntas_examen WHERE es_plantilla=0")
            msg = "Se eliminaron todas las preguntas creadas por profesores."
        else:
            execute_query("DELETE FROM preguntas_examen")
            msg = "Se vaciaron todas las preguntas del sistema."
    return jsonify({'message': msg})


@app.route('/api/admin/preguntas/restaurar-plantilla', methods=['POST'])
@admin_required(rol='profesores')
def admin_preguntas_restaurar_plantilla():
    execute_query("DELETE FROM preguntas_examen WHERE es_plantilla=1")
    plantilla_defecto = [
        {
            'pregunta': '¿Cuál es la velocidad máxima permitida en calles urbanas en Baradero salvo señalización en contrario?',
            'opcion_a': '40 km/h', 'opcion_b': '60 km/h', 'opcion_c': '20 km/h', 'opcion_d': '50 km/h',
            'respuesta_correcta': 'a'
        },
        {
            'pregunta': 'Ante una señal de "PARE" (STOP) en una bocacalle, ¿qué acción corresponde realizar?',
            'opcion_a': 'Detener la marcha por completo antes de ingresar', 'opcion_b': 'Disminuir la velocidad y pasar si no viene nadie', 'opcion_c': 'Tocar bocina y avanzar', 'opcion_d': 'Acelerar para pasar rápido',
            'respuesta_correcta': 'a'
        },
        {
            'pregunta': '¿Cuál es el límite legal de alcohol en sangre para conductores particulares en Prov. de Bs. As.?',
            'opcion_a': '0,0 g/l (Alcohol Cero)', 'opcion_b': '0,5 g/l', 'opcion_c': '0,2 g/l', 'opcion_d': '1,0 g/l',
            'respuesta_correcta': 'a'
        },
        {
            'pregunta': '¿Quién tiene prioridad de paso en una rotonda sin semáforos?',
            'opcion_a': 'El vehículo que circula dentro de la rotonda', 'opcion_b': 'El vehículo que ingresa a la rotonda', 'opcion_c': 'El vehículo más grande', 'opcion_d': 'El que toca bocina primero',
            'respuesta_correcta': 'a'
        },
        {
            'pregunta': '¿Es obligatorio el uso de cinturón de seguridad para todos los ocupantes del vehículo?',
            'opcion_a': 'Sí, siempre y en todos los asientos', 'opcion_b': 'Solo para el conductor', 'opcion_c': 'Solo en rutas o autopistas', 'opcion_d': 'Solo para los asientos delanteros',
            'respuesta_correcta': 'a'
        }
    ]
    for q in plantilla_defecto:
        execute_query(
            """INSERT INTO preguntas_examen (pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, es_plantilla, activo)
               VALUES (?, ?, ?, ?, ?, ?, 1, 1)""",
            (q['pregunta'], q['opcion_a'], q['opcion_b'], q['opcion_c'], q['opcion_d'], q['respuesta_correcta'])
        )
    return jsonify({'message': 'Se restauraron exitosamente las preguntas de la plantilla base.'})


@app.route('/api/admin/preguntas/preview', methods=['GET'])
@admin_required(rol='profesores')
def admin_preguntas_preview():
    config = execute_query("SELECT * FROM config_examen WHERE id=1", fetch_one=True) or {'modo': 'plantilla', 'cant_plantilla': 3, 'cant_profesor': 3}
    modo = config.get('modo', 'plantilla')
    cant_plantilla = config.get('cant_plantilla', 3)
    cant_profesor = config.get('cant_profesor', 3)

    if modo == 'plantilla':
        preguntas = execute_query("SELECT * FROM preguntas_examen WHERE es_plantilla=1 AND activo=1", fetch_all=True) or []
    elif modo == 'personalizado':
        preguntas = execute_query("SELECT * FROM preguntas_examen WHERE es_plantilla=0 AND activo=1", fetch_all=True) or []
    else: # hibrido
        plantilla_qs = execute_query("SELECT * FROM preguntas_examen WHERE es_plantilla=1 AND activo=1", fetch_all=True) or []
        profesor_qs = execute_query("SELECT * FROM preguntas_examen WHERE es_plantilla=0 AND activo=1", fetch_all=True) or []
        preguntas = plantilla_qs[:cant_plantilla] + profesor_qs[:cant_profesor]

    return jsonify({'config': config, 'preguntas': preguntas, 'total': len(preguntas)})


@app.route('/api/admin/examen/monitoreo', methods=['GET'])
@admin_required()
def admin_monitoreo_examen():
    estudiantes = []

    tramites_examen = execute_query(
        """SELECT t.id as tramite_id, u.id as usuario_id, u.nombre, u.apellido, u.dni, u.tiene_cud 
           FROM tramites t JOIN usuarios u ON t.usuario_id=u.id 
           WHERE t.paso_actual='examen' AND t.estado='en_progreso'""",
        fetch_all=True
    ) or []

    for t in tramites_examen:
        uid = t['usuario_id']
        stream = ACTIVE_EXAM_STREAMS.get(uid, {})
        estudiantes.append({
            'usuario_id': uid,
            'tramite_id': t['tramite_id'],
            'nombre': f"{t['nombre']} {t['apellido']}",
            'dni': t['dni'],
            'tiene_cud': bool(t.get('tiene_cud', 0)),
            'cam_frame': stream.get('cam_frame'),
            'screen_frame': stream.get('screen_frame'),
            'warnings_count': stream.get('warnings_count', 0),
            'elapsed_seconds': stream.get('elapsed_seconds', 0),
            'current_question': stream.get('current_question', 1),
            'activo': stream.get('last_ping') is not None
        })

    return jsonify({'estudiantes': estudiantes})


@app.route('/api/admin/examen/expulsar', methods=['POST'])
@admin_required(rol='profesores')
def admin_expulsar_examen():
    data = request.json or {}
    tramite_id = data.get('tramite_id')
    motivo = data.get('motivo', 'Pérdida de foco / Alertas Alt-Tab detectadas en tiempo real')

    if not tramite_id:
        return jsonify({'error': 'tramite_id requerido'}), 400

    tramite = execute_query("SELECT usuario_id FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
    if not tramite:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    usuario_id = tramite['usuario_id']

    execute_query("DELETE FROM examenes_teoricos WHERE tramite_id=?", (tramite_id,))
    execute_query(
        """INSERT INTO examenes_teoricos (tramite_id, respuestas, puntaje, total_preguntas, aprobado, estado_revision, expulsado, motivo_expulsion)
           VALUES (?, '{}', 0, 0, 0, 'expulsado', 1, ?)""",
        (tramite_id, motivo)
    )

    msg = f"🚫 HAS SIDO EXPULSADO DEL EXAMEN POR EL PROFESOR. Motivo: {motivo}. Deberás rendir en otro momento."
    execute_query(
        """INSERT INTO mensajes_profesor (tramite_id, usuario_id, profesor_nombre, mensaje, tipo)
           VALUES (?, ?, 'Profesor Evaluador', ?, 'expulsion')""",
        (tramite_id, usuario_id, msg)
    )

    ACTIVE_EXAM_STREAMS.pop(usuario_id, None)
    return jsonify({'message': 'Alumno expulsado correctamente del examen.'})


@app.route('/api/admin/examen/revision-lista', methods=['GET'])
@admin_required(rol='profesores')
def admin_examen_revision_lista():
    examenes = execute_query(
        """SELECT e.*, t.id as tramite_id, u.id as usuario_id, u.nombre, u.apellido, u.dni
           FROM examenes_teoricos e
           JOIN tramites t ON e.tramite_id=t.id
           JOIN usuarios u ON t.usuario_id=u.id
           ORDER BY e.created_at DESC""",
        fetch_all=True
    ) or []

    for ex in examenes:
        if ex.get('respuestas'):
            try:
                ex['respuestas_dict'] = json.loads(ex['respuestas'])
            except Exception:
                ex['respuestas_dict'] = {}
        else:
            ex['respuestas_dict'] = {}

    return jsonify({'examenes': examenes})


@app.route('/api/admin/examen/revisar', methods=['POST'])
@admin_required(rol='profesores')
def admin_examen_revisar():
    data = request.json or {}
    tramite_id = data.get('tramite_id')
    decision = data.get('decision')
    motivo = data.get('motivo', 'Evaluación realizada por el Profesor')

    if not tramite_id or decision not in ('aprobar', 'desaprobar'):
        return jsonify({'error': 'tramite_id y decision válidos requeridos'}), 400

    tramite = execute_query("SELECT id, usuario_id, paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
    if not tramite:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    usuario_id = tramite['usuario_id']

    if decision == 'aprobar':
        execute_query(
            "UPDATE examenes_teoricos SET aprobado=1, estado_revision='aprobado', motivo_justificacion=? WHERE tramite_id=?",
            (motivo, tramite_id)
        )
        execute_query("UPDATE tramites SET paso_actual='pago' WHERE id=?", (tramite_id,))
        msg = f"✅ EXAMEN APROBADO POR EL PROFESOR. Justificación: {motivo}. Podés continuar con el pago."
        tipo = 'aprobado'
    else:
        execute_query(
            "UPDATE examenes_teoricos SET aprobado=0, estado_revision='desaprobado', motivo_justificacion=? WHERE tramite_id=?",
            (motivo, tramite_id)
        )
        msg = f"❌ EXAMEN DESAPROBADO POR EL PROFESOR. Justificación: {motivo}. Deberás rendir de nuevo en otro momento."
        tipo = 'desaprobado'

    execute_query(
        """INSERT INTO mensajes_profesor (tramite_id, usuario_id, profesor_nombre, mensaje, tipo)
           VALUES (?, ?, 'Profesor Evaluador', ?, ?)""",
        (tramite_id, usuario_id, msg, tipo)
    )

    return jsonify({'message': f'Examen {decision.upper()}DO correctamente.'})


@app.route('/api/admin/profesor/chat/enviar', methods=['POST'])
@admin_required(rol='profesores')
def admin_enviar_chat_profesor():
    data = request.json or {}
    tramite_id = data.get('tramite_id')
    mensaje = data.get('mensaje')

    if not tramite_id or not mensaje:
        return jsonify({'error': 'tramite_id y mensaje requeridos'}), 400

    tramite = execute_query("SELECT usuario_id FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
    if not tramite:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    usuario_id = tramite['usuario_id']

    execute_query(
        """INSERT INTO mensajes_profesor (tramite_id, usuario_id, profesor_nombre, mensaje, tipo)
           VALUES (?, ?, 'Profesor Evaluador', ?, 'chat')""",
        (tramite_id, usuario_id, mensaje)
    )
    return jsonify({'message': 'Mensaje enviado correctamente al alumno.'})


@app.route('/api/profesor/chat/mensajes', methods=['GET'])
@token_required
def get_chat_mensajes_profesor():
    tramite_id = request.user_data.get('tramite_id')
    if not tramite_id:
        return jsonify({'mensajes': []})

    mensajes = execute_query(
        "SELECT * FROM mensajes_profesor WHERE tramite_id=? ORDER BY created_at ASC",
        (tramite_id,), fetch_all=True
    ) or []
    return jsonify({'mensajes': mensajes})


# ============================================================
# ADMIN - GESTIÓN Y VERIFICACIÓN DE CUENTAS E INFRACCIONES
# ============================================================

@app.route('/api/admin/cuentas', methods=['GET'])
@admin_required(rol='cuentas')
def admin_get_cuentas():
    filtro = request.args.get('filtro', 'todos')
    
    if filtro == 'pendiente':
        query = "SELECT * FROM usuarios WHERE estado_cuenta='pendiente' ORDER BY id DESC"
        params = ()
    elif filtro == 'aprobada':
        query = "SELECT * FROM usuarios WHERE estado_cuenta='aprobada' ORDER BY id DESC"
        params = ()
    elif filtro == 'rechazada_multas':
        query = "SELECT * FROM usuarios WHERE estado_cuenta='rechazada_multas' ORDER BY id DESC"
        params = ()
    elif filtro == 'papelera':
        query = "SELECT * FROM usuarios WHERE estado_cuenta='papelera' ORDER BY id DESC"
        params = ()
    else: # todos excluyendo papelera
        query = "SELECT * FROM usuarios WHERE estado_cuenta != 'papelera' ORDER BY id DESC"
        params = ()
        
    usuarios = execute_query(query, params, fetch_all=True) or []
    
    for u in usuarios:
        u['edad'] = calcular_edad(u.get('fecha_nacimiento'))
        u['tiene_cud'] = bool(u.get('tiene_cud', 0))
        u['multas_monto'] = float(u.get('multas_monto') or 0.0)
        u['multas_cantidad'] = int(u.get('multas_cantidad') or 0)
        unread = execute_query(
            "SELECT COUNT(*) as c FROM inbox_cuentas WHERE usuario_id=? AND emisor='usuario' AND leido=0",
            (u['id'],), fetch_one=True
        )
        u['mensajes_sin_leer'] = unread['c'] if unread else 0
        
    pendientes_count = execute_query("SELECT COUNT(*) as c FROM usuarios WHERE estado_cuenta='pendiente'", fetch_one=True)['c']
    con_multas_count = execute_query("SELECT COUNT(*) as c FROM usuarios WHERE estado_cuenta='rechazada_multas'", fetch_one=True)['c']
    aprobados_count = execute_query("SELECT COUNT(*) as c FROM usuarios WHERE estado_cuenta='aprobada'", fetch_one=True)['c']
    papelera_count = execute_query("SELECT COUNT(*) as c FROM usuarios WHERE estado_cuenta='papelera'", fetch_one=True)['c']
    
    return jsonify({
        'usuarios': usuarios,
        'pendientes': pendientes_count,
        'con_multas': con_multas_count,
        'aprobados': aprobados_count,
        'papelera': papelera_count
    })


@app.route('/api/admin/cuentas/<int:user_id>', methods=['GET'])
@admin_required(rol='cuentas')
def admin_get_cuenta_detalle(user_id):
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
        
    usuario['edad'] = calcular_edad(usuario.get('fecha_nacimiento'))
    usuario['tiene_cud'] = bool(usuario.get('tiene_cud', 0))
    usuario['multas_monto'] = float(usuario.get('multas_monto') or 0.0)
    usuario['multas_cantidad'] = int(usuario.get('multas_cantidad') or 0)
    
    tramite = execute_query("SELECT * FROM tramites WHERE usuario_id=? ORDER BY id DESC LIMIT 1", (user_id,), fetch_one=True)
    mensajes = execute_query("SELECT * FROM inbox_cuentas WHERE usuario_id=? ORDER BY created_at ASC", (user_id,), fetch_all=True) or []
    
    execute_query("UPDATE inbox_cuentas SET leido=1 WHERE usuario_id=? AND emisor='usuario'", (user_id,))
    
    return jsonify({
        'usuario': usuario,
        'tramite': tramite,
        'mensajes': mensajes
    })


@app.route('/api/admin/cuentas/<int:user_id>/aprobar', methods=['POST'])
@admin_required(rol='cuentas')
def admin_aprobar_cuenta(user_id):
    admin_id = request.admin_data.get('admin_id')
    
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
        
    execute_query(
        """UPDATE usuarios 
           SET estado_cuenta='aprobada', multas_cantidad=0, multas_monto=0.0, 
               multas_motivo='', infracciones_pagadas_solicitadas=0, bienvenida_mostrada=0,
               multas_fecha_revision=datetime('now','localtime'), updated_at=datetime('now','localtime')
           WHERE id=?""",
        (user_id,)
    )
    
    execute_query(
        """INSERT INTO inbox_cuentas (usuario_id, admin_id, emisor, mensaje, leido)
           VALUES (?, ?, 'admin', '¡Tu cuenta ha sido aprobada por el área de Tránsito! Ya podés comenzar con los pasos de tu licencia.', 0)""",
        (user_id, admin_id)
    )
    
    return jsonify({'message': f'Cuenta de {usuario["nombre"]} {usuario["apellido"]} (DNI: {usuario["dni"]}) aprobada con éxito.'})


@app.route('/api/admin/cuentas/<int:user_id>/rechazar', methods=['POST'])
@admin_required(rol='cuentas')
def admin_rechazar_cuenta(user_id):
    admin_id = request.admin_data.get('admin_id')
    data = request.json or {}
    
    cantidad_multas = int(data.get('cantidad_multas', 1))
    monto_total = float(data.get('monto_total', 0.0))
    motivo = data.get('mensaje', '').strip() or 'Infracciones de tránsito detectadas en el Registro Provincial/Nacional de Antecedentes.'
    
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
        
    execute_query(
        """UPDATE usuarios 
           SET estado_cuenta='rechazada_multas', multas_cantidad=?, multas_monto=?, 
               multas_motivo=?, infracciones_pagadas_solicitadas=0,
               multas_fecha_revision=datetime('now','localtime'), updated_at=datetime('now','localtime')
           WHERE id=?""",
        (cantidad_multas, monto_total, motivo, user_id)
    )
    
    msg_template = f"Estimado/a {usuario['nombre']} {usuario['apellido']}: Tras consultar las bases de datos de seguridad vial se detectaron {cantidad_multas} infracción(es) pendiente(s) por un monto total de ${monto_total:,.2f}. Motivo: {motivo}. Por favor, regularice su situación y presione 'Ya pagué' adjuntando su comprobante."
    
    execute_query(
        """INSERT INTO inbox_cuentas (usuario_id, admin_id, emisor, mensaje, leido)
           VALUES (?, ?, 'admin', ?, 0)""",
        (user_id, admin_id, msg_template)
    )
    
    return jsonify({'message': f'Cuenta de {usuario["nombre"]} actualizada con {cantidad_multas} infracción(es). Notificación enviada.'})


@app.route('/api/admin/cuentas/<int:user_id>/mover-papelera', methods=['POST'])
@admin_required(rol='cuentas')
def admin_mover_papelera_cuenta(user_id):
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
        
    execute_query("UPDATE usuarios SET estado_cuenta='papelera', updated_at=datetime('now','localtime') WHERE id=?", (user_id,))
    return jsonify({'message': f'Usuario {usuario["nombre"]} {usuario["apellido"]} movido a la papelera.'})


@app.route('/api/admin/cuentas/<int:user_id>/dar-alta', methods=['POST'])
@admin_required(rol='cuentas')
def admin_dar_alta_cuenta(user_id):
    usuario = execute_query("SELECT * FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
    if not usuario:
        return jsonify({'error': 'Usuario no encontrado'}), 404
        
    execute_query("UPDATE usuarios SET estado_cuenta='aprobada', updated_at=datetime('now','localtime') WHERE id=?", (user_id,))
    return jsonify({'message': f'Usuario {usuario["nombre"]} {usuario["apellido"]} dado de alta correctamente.'})


# ============================================================
# INBOX / MENSAJERÍA CIUDADANO <-> ADMIN CUENTAS
# ============================================================

@app.route('/api/inbox/mensajes', methods=['GET'])
def get_inbox_mensajes():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token requerido'}), 401
        
    data = decode_token(token)
    if not data:
        return jsonify({'error': 'Token inválido'}), 401
        
    if data.get('tipo') == 'admin':
        usuario_id = request.args.get('usuario_id')
        if not usuario_id:
            return jsonify({'error': 'usuario_id requerido para admin'}), 400
        mensajes = execute_query(
            "SELECT * FROM inbox_cuentas WHERE usuario_id=? ORDER BY created_at ASC",
            (usuario_id,), fetch_all=True
        ) or []
        execute_query("UPDATE inbox_cuentas SET leido=1 WHERE usuario_id=? AND emisor='usuario'", (usuario_id,))
    else:
        usuario_id = data.get('usuario_id')
        mensajes = execute_query(
            "SELECT * FROM inbox_cuentas WHERE usuario_id=? ORDER BY created_at ASC",
            (usuario_id,), fetch_all=True
        ) or []
        execute_query("UPDATE inbox_cuentas SET leido=1 WHERE usuario_id=? AND emisor='admin'", (usuario_id,))
        
    return jsonify({'mensajes': mensajes})


@app.route('/api/inbox/enviar', methods=['POST'])
def send_inbox_mensaje():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token requerido'}), 401
        
    data_token = decode_token(token)
    if not data_token:
        return jsonify({'error': 'Token inválido'}), 401
        
    payload = request.json or {}
    mensaje = payload.get('mensaje', '').strip()
    adjunto_url = payload.get('adjunto_url')
    adjunto_nombre = payload.get('adjunto_nombre')
    
    if not mensaje and not adjunto_url:
        return jsonify({'error': 'Debe ingresar un mensaje o adjuntar un archivo'}), 400
        
    if data_token.get('tipo') == 'admin':
        admin_id = data_token.get('admin_id')
        usuario_id = payload.get('usuario_id')
        if not usuario_id:
            return jsonify({'error': 'usuario_id requerido'}), 400
        emisor = 'admin'
    else:
        usuario_id = data_token.get('usuario_id')
        admin_id = None
        emisor = 'usuario'
        
    msg_id = execute_query(
        """INSERT INTO inbox_cuentas (usuario_id, admin_id, emisor, mensaje, adjunto_url, adjunto_nombre, leido)
           VALUES (?, ?, ?, ?, ?, ?, 0)""",
        (usuario_id, admin_id, emisor, mensaje or 'Comprobante adjunto', adjunto_url, adjunto_nombre)
    )
    
    nuevo_msg = execute_query("SELECT * FROM inbox_cuentas WHERE id=?", (msg_id,), fetch_one=True)
    return jsonify({'message': 'Mensaje enviado', 'mensaje': nuevo_msg}), 201


@app.route('/api/usuario/notificar-ya-pague', methods=['POST'])
@token_required
def usuario_notificar_ya_pague():
    usuario_id = request.user_data.get('usuario_id')
    payload = request.json or {}
    mensaje_adicional = payload.get('mensaje', '').strip()
    adjunto_url = payload.get('adjunto_url')
    adjunto_nombre = payload.get('adjunto_nombre')
    
    execute_query("UPDATE usuarios SET infracciones_pagadas_solicitadas=1, updated_at=datetime('now','localtime') WHERE id=?", (usuario_id,))
    
    msg_texto = f"📌 [NOTIFICACIÓN DE PAGO]: El ciudadano ha marcado 'Ya pagué' y solicita la revisión de multas."
    if mensaje_adicional:
        msg_texto += f"\nMensaje: {mensaje_adicional}"
        
    execute_query(
        """INSERT INTO inbox_cuentas (usuario_id, admin_id, emisor, mensaje, adjunto_url, adjunto_nombre, leido)
           VALUES (?, NULL, 'usuario', ?, ?, ?, 0)""",
        (usuario_id, msg_texto, adjunto_url, adjunto_nombre)
    )
    
    return jsonify({'message': 'Notificación de pago enviada al administrador con éxito.'})


@app.route('/api/usuario/bienvenida-vista', methods=['POST'])
@token_required
def usuario_bienvenida_vista():
    usuario_id = request.user_data.get('usuario_id')
    execute_query("UPDATE usuarios SET bienvenida_mostrada=1 WHERE id=?", (usuario_id,))
    return jsonify({'message': 'Bienvenida marcada como vista'})


# ============================================================
# ADMIN - ESTADÍSTICAS
# ============================================================

@app.route('/api/admin/stats', methods=['GET'])
@admin_required()
def admin_stats():
    total_usuarios = execute_query("SELECT COUNT(*) as c FROM usuarios", fetch_one=True)['c']
    total_tramites = execute_query("SELECT COUNT(*) as c FROM tramites", fetch_one=True)['c']
    tramites_activos = execute_query("SELECT COUNT(*) as c FROM tramites WHERE estado='en_progreso'", fetch_one=True)['c']
    tramites_completados = execute_query("SELECT COUNT(*) as c FROM tramites WHERE estado='completado'", fetch_one=True)['c']
    pagos_pendientes = execute_query("SELECT COUNT(*) as c FROM pagos WHERE estado='pendiente'", fetch_one=True)['c']
    salud_pendientes = execute_query("SELECT COUNT(*) as c FROM formularios_salud WHERE estado='pendiente'", fetch_one=True)['c']
    turnos_pendientes = execute_query("SELECT COUNT(*) as c FROM reservas_turno WHERE estado='reservado'", fetch_one=True)['c']

    return jsonify({
        'total_usuarios': total_usuarios,
        'total_tramites': total_tramites,
        'tramites_activos': tramites_activos,
        'tramites_completados': tramites_completados,
        'pagos_pendientes': pagos_pendientes,
        'salud_pendientes': salud_pendientes,
        'turnos_pendientes': turnos_pendientes
    })


# ============================================================
# INIT - Crear password hashes correctos para admins
# ============================================================

def init_admin_passwords():
    """Actualiza los passwords de admins con hashes válidos."""
    try:
        admins = execute_query("SELECT id, usuario FROM admins", fetch_all=True)
        for admin in admins:
            hashed = generate_password_hash('admin123')
            execute_query(
                "UPDATE admins SET password_hash=? WHERE id=?",
                (hashed, admin['id'])
            )
        print("[OK] Passwords de admins actualizados")
    except Exception as e:
        print(f"[WARN] No se pudieron actualizar passwords: {e}")


# ============================================================
# RUN
# ============================================================

init_db()
init_admin_passwords()


if __name__ == '__main__':
    print("=" * 60)
    print("  Sistema de Licencias de Conducir - Baradero")
    print("  Servidor API corriendo en http://localhost:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)
