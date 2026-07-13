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
    PASOS_TRAMITE, MINIMO_APROBACION_EXAMEN, TOTAL_PREGUNTAS_EXAMEN,
    MONTO_LICENCIA, ALIAS_BANCARIO, CBU_BANCARIO
)
from db import execute_query

import os

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)


# ============================================================
# HELPERS
# ============================================================

def create_token(payload, hours=JWT_EXPIRATION_HOURS):
    payload['exp'] = datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
    payload['iat'] = datetime.datetime.utcnow()
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
            if rol and data.get('rol') != rol:
                return jsonify({'error': f'Se requiere rol: {rol}'}), 403
            request.admin_data = data
            return f(*args, **kwargs)
        return decorated
    return decorator


def get_paso_index(paso):
    try:
        return PASOS_TRAMITE.index(paso)
    except ValueError:
        return -1


def puede_acceder_paso(paso_actual, paso_solicitado):
    idx_actual = get_paso_index(paso_actual)
    idx_solicitado = get_paso_index(paso_solicitado)
    return idx_solicitado <= idx_actual


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
    data = request.json
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')

    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido (7 u 8 dígitos)'}), 400

    existing = execute_query("SELECT id FROM usuarios WHERE dni=%s", (dni,), fetch_one=True)
    if existing:
        return jsonify({'error': 'Ya existe una cuenta con este DNI'}), 409

    nombre = data.get('nombre', '').strip()
    apellido = data.get('apellido', '').strip()
    email = data.get('email', '').strip()
    telefono = data.get('telefono', '').strip()
    fecha_nac = data.get('fecha_nacimiento', None)
    direccion = data.get('direccion', '').strip()

    if not nombre or not apellido:
        return jsonify({'error': 'Nombre y apellido son requeridos'}), 400

    user_id = execute_query(
        """INSERT INTO usuarios (dni, nombre, apellido, email, telefono, fecha_nacimiento, direccion)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (dni, nombre, apellido, email, telefono, fecha_nac, direccion)
    )

    # Crear trámite automáticamente
    tramite_id = execute_query(
        "INSERT INTO tramites (usuario_id, tipo, paso_actual) VALUES (%s, %s, %s)",
        (user_id, data.get('tipo_tramite', 'nueva'), 'charlas')
    )

    token = create_token({'usuario_id': user_id, 'dni': dni, 'tipo': 'usuario', 'tramite_id': tramite_id})

    return jsonify({
        'message': 'Registro exitoso',
        'token': token,
        'usuario': {
            'id': user_id,
            'dni': dni,
            'nombre': nombre,
            'apellido': apellido,
            'tramite_id': tramite_id
        }
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')

    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido'}), 400

    user = execute_query(
        "SELECT id, dni, nombre, apellido FROM usuarios WHERE dni=%s",
        (dni,), fetch_one=True
    )

    if not user:
        return jsonify({'error': 'No existe cuenta con este DNI. Registrate primero.', 'needs_register': True}), 404

    # Buscar trámite activo
    tramite = execute_query(
        "SELECT id, paso_actual, tipo, estado FROM tramites WHERE usuario_id=%s AND estado='en_progreso' ORDER BY id DESC LIMIT 1",
        (user['id'],), fetch_one=True
    )

    tramite_id = None
    paso_actual = 'charlas'
    if tramite:
        tramite_id = tramite['id']
        paso_actual = tramite['paso_actual']

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
            'tramite_id': tramite_id,
            'paso_actual': paso_actual
        }
    })


@app.route('/api/auth/check-dni', methods=['POST'])
def check_dni():
    data = request.json
    dni = data.get('dni', '').strip().replace('.', '').replace('-', '')
    if not dni or len(dni) < 7 or len(dni) > 8 or not dni.isdigit():
        return jsonify({'error': 'DNI inválido'}), 400

    user = execute_query("SELECT id, nombre, apellido FROM usuarios WHERE dni=%s", (dni,), fetch_one=True)
    return jsonify({'exists': user is not None, 'nombre': user['nombre'] if user else None})


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
        "SELECT id, usuario, password_hash, nombre, rol FROM admins WHERE usuario=%s AND activo=1",
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
        "SELECT * FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True
    )
    if not tramite:
        return jsonify({'error': 'Trámite no encontrado'}), 404

    # Construir estado de cada paso
    paso_actual = tramite['paso_actual']
    idx_actual = get_paso_index(paso_actual)

    pasos_info = []
    labels = {
        'charlas': {'title': 'Charlas en video', 'desc': 'Capacitación obligatoria sobre seguridad vial'},
        'examen': {'title': 'Examen teórico', 'desc': '5 preguntas de múltiple opción'},
        'formularios': {'title': 'Formularios de salud', 'desc': 'Certificados y datos médicos'},
        'pago': {'title': 'Pago del arancel', 'desc': 'Pago del arancel de licencia'},
        'practico': {'title': 'Examen práctico', 'desc': 'Presencial · Agendar turno'},
        'entrega': {'title': 'Entrega de licencia', 'desc': 'Domicilio o retiro presencial'},
    }

    for i, paso in enumerate(PASOS_TRAMITE[:-1]):  # excluir 'finalizado'
        if i < idx_actual:
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
        "SELECT nombre, apellido, dni FROM usuarios WHERE id=%s",
        (tramite['usuario_id'],), fetch_one=True
    )

    return jsonify({
        'tramite_id': tramite['id'],
        'tipo': tramite['tipo'],
        'paso_actual': paso_actual,
        'estado': tramite['estado'],
        'pasos': pasos_info,
        'usuario': usuario,
        'progreso_porcentaje': round((idx_actual / len(PASOS_TRAMITE[:-1])) * 100)
    })


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
            "SELECT video_id FROM videos_vistos WHERE tramite_id=%s AND visto=1",
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
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)
    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'charlas'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    video_id = request.json.get('video_id')
    if not video_id:
        return jsonify({'error': 'video_id requerido'}), 400

    # Verificar que los videos anteriores ya fueron vistos
    video = execute_query("SELECT orden FROM videos WHERE id=%s AND activo=1", (video_id,), fetch_one=True)
    if not video:
        return jsonify({'error': 'Video no encontrado'}), 404

    # Verificar que todos los videos con orden menor ya estén vistos
    videos_anteriores = execute_query(
        "SELECT id FROM videos WHERE activo=1 AND orden < %s", (video['orden'],), fetch_all=True
    )
    for va in videos_anteriores:
        visto = execute_query(
            "SELECT id FROM videos_vistos WHERE tramite_id=%s AND video_id=%s AND visto=1",
            (tramite_id, va['id']), fetch_one=True
        )
        if not visto:
            return jsonify({'error': 'Debés ver los videos anteriores primero'}), 400

    # Marcar como visto
    execute_query(
        """INSERT INTO videos_vistos (tramite_id, video_id, visto)
           VALUES (%s, %s, 1)
           ON DUPLICATE KEY UPDATE visto=1, fecha_visto=NOW()""",
        (tramite_id, video_id)
    )

    # Verificar si todos están vistos para avanzar paso
    total_videos = execute_query("SELECT COUNT(*) as total FROM videos WHERE activo=1", fetch_one=True)['total']
    total_vistos = execute_query(
        "SELECT COUNT(*) as total FROM videos_vistos WHERE tramite_id=%s AND visto=1",
        (tramite_id,), fetch_one=True
    )['total']

    todos_vistos = total_vistos >= total_videos
    if todos_vistos and tramite['paso_actual'] == 'charlas':
        execute_query("UPDATE tramites SET paso_actual='examen' WHERE id=%s", (tramite_id,))

    return jsonify({'message': 'Video marcado como visto', 'todos_vistos': todos_vistos})


# ============================================================
# EXAMEN TEÓRICO
# ============================================================

@app.route('/api/examen/preguntas', methods=['GET'])
@token_required
def get_preguntas():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'examen'):
        return jsonify({'error': 'Debés completar las charlas primero'}), 403

    # Verificar si ya rindió
    examen_existente = execute_query(
        "SELECT id, aprobado, puntaje, total_preguntas FROM examenes_teoricos WHERE tramite_id=%s",
        (tramite_id,), fetch_one=True
    )
    if examen_existente:
        return jsonify({
            'ya_rendido': True,
            'aprobado': bool(examen_existente['aprobado']),
            'puntaje': examen_existente['puntaje'],
            'total': examen_existente['total_preguntas']
        })

    todas = execute_query(
        "SELECT id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d FROM preguntas_examen WHERE activo=1",
        fetch_all=True
    )

    # Seleccionar preguntas aleatorias
    preguntas = random.sample(todas, min(TOTAL_PREGUNTAS_EXAMEN, len(todas)))

    return jsonify({'preguntas': preguntas, 'ya_rendido': False})


@app.route('/api/examen/entregar', methods=['POST'])
@token_required
def entregar_examen():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'examen'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    # Verificar si ya rindió
    existente = execute_query(
        "SELECT id FROM examenes_teoricos WHERE tramite_id=%s", (tramite_id,), fetch_one=True
    )
    if existente:
        return jsonify({'error': 'Ya rendiste el examen. Solo tenés un intento.'}), 400

    respuestas = request.json.get('respuestas', {})
    # respuestas = {"pregunta_id": "a/b/c/d", ...}

    puntaje = 0
    total = len(respuestas)

    for pid_str, resp in respuestas.items():
        pid = int(pid_str)
        correcta = execute_query(
            "SELECT respuesta_correcta FROM preguntas_examen WHERE id=%s",
            (pid,), fetch_one=True
        )
        if correcta and correcta['respuesta_correcta'] == resp:
            puntaje += 1

    aprobado = puntaje >= MINIMO_APROBACION_EXAMEN

    execute_query(
        """INSERT INTO examenes_teoricos (tramite_id, respuestas, puntaje, total_preguntas, aprobado)
           VALUES (%s, %s, %s, %s, %s)""",
        (tramite_id, json.dumps(respuestas), puntaje, total, 1 if aprobado else 0)
    )

    if aprobado and tramite['paso_actual'] == 'examen':
        execute_query("UPDATE tramites SET paso_actual='formularios' WHERE id=%s", (tramite_id,))

    return jsonify({
        'aprobado': aprobado,
        'puntaje': puntaje,
        'total': total,
        'minimo': MINIMO_APROBACION_EXAMEN
    })


# ============================================================
# FORMULARIOS DE SALUD
# ============================================================

@app.route('/api/formularios/estado', methods=['GET'])
@token_required
def formularios_estado():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'formularios'):
        return jsonify({'error': 'Debés aprobar el examen teórico primero'}), 403

    formulario = execute_query(
        "SELECT * FROM formularios_salud WHERE tramite_id=%s ORDER BY id DESC LIMIT 1",
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
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'formularios'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id FROM formularios_salud WHERE tramite_id=%s", (tramite_id,), fetch_one=True
    )
    if existente:
        return jsonify({'error': 'Ya enviaste los formularios de salud'}), 400

    data = request.json
    required = ['grupo_sanguineo', 'usa_lentes', 'contacto_emergencia', 'telefono_emergencia']
    for field in required:
        if not data.get(field, '').strip():
            return jsonify({'error': f'Campo {field} es requerido'}), 400

    form_id = execute_query(
        """INSERT INTO formularios_salud 
           (tramite_id, grupo_sanguineo, usa_lentes, enfermedad_cronica, medicacion, 
            contacto_emergencia, telefono_emergencia, certificado_archivo)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (tramite_id, data['grupo_sanguineo'], data['usa_lentes'],
         data.get('enfermedad_cronica', 'Ninguna'), data.get('medicacion', 'Ninguna'),
         data['contacto_emergencia'], data['telefono_emergencia'],
         data.get('certificado_archivo', None))
    )

    return jsonify({'message': 'Formularios enviados correctamente', 'id': form_id})


# ============================================================
# PAGOS
# ============================================================

@app.route('/api/pagos/info', methods=['GET'])
@token_required
def pagos_info():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'pago'):
        return jsonify({'error': 'Debés completar los formularios de salud primero'}), 403

    pago = execute_query(
        "SELECT * FROM pagos WHERE tramite_id=%s ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )

    if pago:
        if pago.get('fecha_pago'):
            pago['fecha_pago'] = str(pago['fecha_pago'])
        if pago.get('fecha_revision'):
            pago['fecha_revision'] = str(pago['fecha_revision'])
        # No enviar datos sensibles de tarjeta
        if pago.get('numero_tarjeta'):
            pago['numero_tarjeta'] = '****' + pago['numero_tarjeta'][-4:]

    return jsonify({
        'pago': pago,
        'monto': MONTO_LICENCIA,
        'alias': ALIAS_BANCARIO,
        'cbu': CBU_BANCARIO
    })


@app.route('/api/pagos/registrar', methods=['POST'])
@token_required
def registrar_pago():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'pago'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id, estado FROM pagos WHERE tramite_id=%s ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if existente and existente['estado'] != 'rechazado':
        return jsonify({'error': 'Ya registraste un pago'}), 400

    data = request.json
    metodo = data.get('metodo')
    if metodo not in ('transferencia', 'debito'):
        return jsonify({'error': 'Método de pago inválido'}), 400

    pago_id = execute_query(
        """INSERT INTO pagos (tramite_id, metodo, monto, comprobante, numero_tarjeta, nombre_titular)
           VALUES (%s, %s, %s, %s, %s, %s)""",
        (tramite_id, metodo, MONTO_LICENCIA,
         data.get('comprobante'),
         data.get('numero_tarjeta', '')[-4:] if data.get('numero_tarjeta') else None,
         data.get('nombre_titular'))
    )

    return jsonify({'message': 'Pago registrado correctamente', 'id': pago_id})


# ============================================================
# TURNOS / EXAMEN PRÁCTICO
# ============================================================

@app.route('/api/turnos/disponibles', methods=['GET'])
@token_required
def turnos_disponibles():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'practico'):
        return jsonify({'error': 'Debés completar el pago primero'}), 403

    turnos = execute_query(
        "SELECT * FROM turnos_practico WHERE activo=1 AND cupo_actual < cupo_maximo ORDER BY id ASC",
        fetch_all=True
    )
    for t in turnos:
        if t.get('created_at'):
            t['created_at'] = str(t['created_at'])

    reserva = execute_query(
        "SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion FROM reservas_turno rt JOIN turnos_practico tp ON rt.turno_id=tp.id WHERE rt.tramite_id=%s ORDER BY rt.id DESC LIMIT 1",
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
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'practico'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id, estado FROM reservas_turno WHERE tramite_id=%s ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if existente and existente['estado'] not in ('rechazado',):
        return jsonify({'error': 'Ya tenés un turno reservado'}), 400

    turno_id = request.json.get('turno_id')
    if not turno_id:
        return jsonify({'error': 'turno_id requerido'}), 400

    turno = execute_query(
        "SELECT * FROM turnos_practico WHERE id=%s AND activo=1 AND cupo_actual < cupo_maximo",
        (turno_id,), fetch_one=True
    )
    if not turno:
        return jsonify({'error': 'Turno no disponible'}), 400

    reserva_id = execute_query(
        "INSERT INTO reservas_turno (tramite_id, turno_id) VALUES (%s, %s)",
        (tramite_id, turno_id)
    )

    execute_query(
        "UPDATE turnos_practico SET cupo_actual = cupo_actual + 1 WHERE id=%s",
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
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'entrega'):
        return jsonify({'error': 'Debés completar el examen práctico primero'}), 403

    entrega = execute_query(
        "SELECT * FROM entregas WHERE tramite_id=%s ORDER BY id DESC LIMIT 1",
        (tramite_id,), fetch_one=True
    )
    if entrega and entrega.get('fecha_solicitud'):
        entrega['fecha_solicitud'] = str(entrega['fecha_solicitud'])

    return jsonify({'entrega': entrega})


@app.route('/api/entrega/solicitar', methods=['POST'])
@token_required
def solicitar_entrega():
    tramite_id = request.user_data.get('tramite_id')
    tramite = execute_query("SELECT paso_actual FROM tramites WHERE id=%s", (tramite_id,), fetch_one=True)

    if not tramite or not puede_acceder_paso(tramite['paso_actual'], 'entrega'):
        return jsonify({'error': 'No podés acceder a este paso'}), 403

    existente = execute_query(
        "SELECT id FROM entregas WHERE tramite_id=%s", (tramite_id,), fetch_one=True
    )
    if existente:
        return jsonify({'error': 'Ya solicitaste la entrega'}), 400

    data = request.json
    metodo = data.get('metodo')
    if metodo not in ('domicilio', 'presencial'):
        return jsonify({'error': 'Método inválido'}), 400

    direccion = data.get('direccion', '') if metodo == 'domicilio' else ''
    if metodo == 'domicilio' and not direccion.strip():
        return jsonify({'error': 'Dirección requerida para envío a domicilio'}), 400

    entrega_id = execute_query(
        "INSERT INTO entregas (tramite_id, metodo, direccion) VALUES (%s, %s, %s)",
        (tramite_id, metodo, direccion)
    )

    execute_query(
        "UPDATE tramites SET paso_actual='finalizado', estado='completado' WHERE id=%s",
        (tramite_id,)
    )

    return jsonify({'message': '¡Solicitud de entrega registrada! Trámite finalizado.', 'id': entrega_id})


# ============================================================
# ADMIN - PAGOS
# ============================================================

@app.route('/api/admin/pagos', methods=['GET'])
@admin_required(rol='pagos')
def admin_pagos_lista():
    estado = request.args.get('estado', 'todos')

    if estado == 'todos':
        pagos = execute_query(
            """SELECT p.*, u.dni, u.nombre, u.apellido 
               FROM pagos p 
               JOIN tramites t ON p.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY p.fecha_pago DESC""",
            fetch_all=True
        )
    else:
        pagos = execute_query(
            """SELECT p.*, u.dni, u.nombre, u.apellido 
               FROM pagos p 
               JOIN tramites t ON p.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               WHERE p.estado=%s
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
    data = request.json
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ('aprobado', 'rechazado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE pagos SET estado=%s, observaciones_admin=%s, fecha_revision=NOW(), admin_id=%s 
           WHERE id=%s""",
        (nuevo_estado, observaciones, admin_id, pago_id)
    )

    if nuevo_estado == 'aprobado':
        pago = execute_query("SELECT tramite_id FROM pagos WHERE id=%s", (pago_id,), fetch_one=True)
        if pago:
            tramite = execute_query(
                "SELECT paso_actual FROM tramites WHERE id=%s", (pago['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'pago':
                execute_query(
                    "UPDATE tramites SET paso_actual='practico' WHERE id=%s",
                    (pago['tramite_id'],)
                )

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
            """SELECT fs.*, u.dni, u.nombre, u.apellido 
               FROM formularios_salud fs 
               JOIN tramites t ON fs.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY fs.fecha_envio DESC""",
            fetch_all=True
        )
    else:
        formularios = execute_query(
            """SELECT fs.*, u.dni, u.nombre, u.apellido 
               FROM formularios_salud fs 
               JOIN tramites t ON fs.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               WHERE fs.estado=%s
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
    data = request.json
    nuevo_estado = data.get('estado')
    if nuevo_estado not in ('aprobado', 'rechazado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE formularios_salud SET estado=%s, observaciones_admin=%s, fecha_revision=NOW(), admin_id=%s 
           WHERE id=%s""",
        (nuevo_estado, observaciones, admin_id, form_id)
    )

    if nuevo_estado == 'aprobado':
        form = execute_query("SELECT tramite_id FROM formularios_salud WHERE id=%s", (form_id,), fetch_one=True)
        if form:
            tramite = execute_query(
                "SELECT paso_actual FROM tramites WHERE id=%s", (form['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'formularios':
                execute_query(
                    "UPDATE tramites SET paso_actual='pago' WHERE id=%s",
                    (form['tramite_id'],)
                )

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
            """SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion, u.dni, u.nombre, u.apellido 
               FROM reservas_turno rt 
               JOIN turnos_practico tp ON rt.turno_id=tp.id 
               JOIN tramites t ON rt.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               ORDER BY rt.fecha_reserva DESC""",
            fetch_all=True
        )
    else:
        reservas = execute_query(
            """SELECT rt.*, tp.fecha, tp.horario, tp.ubicacion, u.dni, u.nombre, u.apellido 
               FROM reservas_turno rt 
               JOIN turnos_practico tp ON rt.turno_id=tp.id 
               JOIN tramites t ON rt.tramite_id=t.id 
               JOIN usuarios u ON t.usuario_id=u.id 
               WHERE rt.estado=%s
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
    data = request.json
    nuevo_estado = data.get('estado')
    resultado = data.get('resultado_examen', 'pendiente')

    if nuevo_estado not in ('aprobado', 'rechazado', 'completado'):
        return jsonify({'error': 'Estado inválido'}), 400

    observaciones = data.get('observaciones', '')
    admin_id = request.admin_data.get('admin_id')

    execute_query(
        """UPDATE reservas_turno SET estado=%s, resultado_examen=%s, observaciones_admin=%s, 
           fecha_revision=NOW(), admin_id=%s WHERE id=%s""",
        (nuevo_estado, resultado, observaciones, admin_id, reserva_id)
    )

    if nuevo_estado == 'completado' and resultado == 'aprobado':
        reserva = execute_query("SELECT tramite_id FROM reservas_turno WHERE id=%s", (reserva_id,), fetch_one=True)
        if reserva:
            tramite = execute_query(
                "SELECT paso_actual FROM tramites WHERE id=%s", (reserva['tramite_id'],), fetch_one=True
            )
            if tramite and tramite['paso_actual'] == 'practico':
                execute_query(
                    "UPDATE tramites SET paso_actual='entrega' WHERE id=%s",
                    (reserva['tramite_id'],)
                )

    return jsonify({'message': f'Reserva actualizada correctamente'})


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
                "UPDATE admins SET password_hash=%s WHERE id=%s",
                (hashed, admin['id'])
            )
        print("[OK] Passwords de admins actualizados")
    except Exception as e:
        print(f"[WARN] No se pudieron actualizar passwords: {e}")


# ============================================================
# RUN
# ============================================================

if __name__ == '__main__':
    print("=" * 60)
    print("  Sistema de Licencias de Conducir - Baradero")
    print("  Servidor API corriendo en http://localhost:5000")
    print("=" * 60)

    init_admin_passwords()
    app.run(host='0.0.0.0', port=5000, debug=True)
