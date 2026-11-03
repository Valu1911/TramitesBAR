# -*- coding: utf-8 -*-
"""
Verification Script for explorer_survey_2:
Tests user registration flow, traffic fines (multas) verification mechanism,
admin_cuentas capabilities, and backend security enforcement.
"""

import sys
import os
import json
import random

# Add backend directory to sys.path
backend_dir = r"c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\sistema_licencias\backend"
sys.path.insert(0, backend_dir)

from app import app, execute_query

client = app.test_client()

results = []

def record(name, passed, details=""):
    results.append({'test': name, 'passed': passed, 'details': details})
    mark = "[PASS]" if passed else "[FAIL]"
    print(f"{mark} {name}: {details}")

print("=================================================================")
print("STARTING EMPIRICAL VERIFICATION OF REGISTRATION & FINES FLOW")
print("=================================================================")

# -------------------------------------------------------------
# 1. REGISTRATION VALIDATIONS
# -------------------------------------------------------------
test_dni = str(random.randint(50000000, 59999999))

# Invalid DNI
r = client.post('/api/auth/registro', json={'dni': '123', 'nombre': 'Test', 'apellido': 'User', 'password': 'password123'})
record("Registro con DNI corto (<7 dígitos)", r.status_code == 400, f"Status: {r.status_code}, Resp: {r.get_json()}")

r = client.post('/api/auth/registro', json={'dni': 'abcdefg', 'nombre': 'Test', 'apellido': 'User', 'password': 'password123'})
record("Registro con DNI no numérico", r.status_code == 400, f"Status: {r.status_code}")

# Valid registration
reg_payload = {
    'dni': test_dni,
    'nombre': 'Juan',
    'apellido': 'Perez',
    'fecha_nacimiento': '1992-04-10',
    'email': 'juan.perez@test.com',
    'telefono': '3329123456',
    'direccion': 'Calle Falsa 123, Baradero',
    'password': 'password123',
    'tipo_tramite': 'nueva',
    'tiene_cud': 0
}
r = client.post('/api/auth/registro', json=reg_payload)
data = r.get_json() or {}
citizen_token = data.get('token')
citizen_user = data.get('usuario') or {}
citizen_id = citizen_user.get('id')
record("Registro válido inicial (HTTP 201)", r.status_code == 201 and citizen_token is not None, f"ID: {citizen_id}, Token exists: {bool(citizen_token)}")
record("Estado inicial de cuenta es 'pendiente'", citizen_user.get('estado_cuenta') == 'pendiente', f"Estado: {citizen_user.get('estado_cuenta')}")
record("Multas iniciales en 0", citizen_user.get('multas_cantidad') == 0 and citizen_user.get('multas_monto') == 0.0, f"Cant: {citizen_user.get('multas_cantidad')}, Monto: {citizen_user.get('multas_monto')}")

# Duplicate registration check
r = client.post('/api/auth/registro', json=reg_payload)
record("Rechazo de DNI duplicado (HTTP 409)", r.status_code == 409, f"Status: {r.status_code}")

# -------------------------------------------------------------
# 2. ADMIN CUENTAS LOGIN & AUDIT
# -------------------------------------------------------------
r = client.post('/api/admin/login', json={'usuario': 'admin_cuentas', 'password': 'admin123'})
admin_data = r.get_json() or {}
admin_token = admin_data.get('token')
admin_headers = {'Authorization': f'Bearer {admin_token}'} if admin_token else {}
record("Login de admin_cuentas (HTTP 200)", r.status_code == 200 and admin_token is not None, f"Rol: {admin_data.get('admin', {}).get('rol')}")

# Query list of pending accounts
r = client.get('/api/admin/cuentas?filtro=pendiente', headers=admin_headers)
cuentas_data = r.get_json() or {}
usuarios_pendientes = cuentas_data.get('usuarios', [])
user_found = any(u['id'] == citizen_id for u in usuarios_pendientes)
record("Admin Cuentas visualiza usuario en pestaña 'Pendientes'", user_found, f"Total pendientes: {cuentas_data.get('pendientes')}")

# Get account detail
r = client.get(f'/api/admin/cuentas/{citizen_id}', headers=admin_headers)
detalle_data = r.get_json() or {}
record("Admin Cuentas obtiene detalle y expediente del ciudadano", r.status_code == 200 and detalle_data.get('usuario', {}).get('dni') == test_dni, f"DNI detalle: {detalle_data.get('usuario', {}).get('dni')}")

# -------------------------------------------------------------
# 3. RECHAZAR POR MULTAS (SIMULACIÓN DE INFRACCIONES DETECTADAS)
# -------------------------------------------------------------
rechazo_payload = {
    'cantidad_multas': 2,
    'monto_total': 48500.50,
    'mensaje': 'Exceso de velocidad en Ruta 41 (km 5) y cruce de semáforo rojo en San Martín y Malvinas.'
}
r = client.post(f'/api/admin/cuentas/{citizen_id}/rechazar', json=rechazo_payload, headers=admin_headers)
record("Admin Cuentas rechaza cuenta por multas (HTTP 200)", r.status_code == 200, f"Resp: {r.get_json()}")

# Verify DB state
db_user = execute_query("SELECT estado_cuenta, multas_cantidad, multas_monto, multas_motivo FROM usuarios WHERE id=?", (citizen_id,), fetch_one=True)
record("Base de datos actualizada a 'rechazada_multas'", db_user['estado_cuenta'] == 'rechazada_multas' and db_user['multas_cantidad'] == 2 and abs(db_user['multas_monto'] - 48500.50) < 0.01, f"DB: {db_user}")

# Verify inbox notification
inbox_msg = execute_query("SELECT * FROM inbox_cuentas WHERE usuario_id=? AND emisor='admin' ORDER BY id DESC LIMIT 1", (citizen_id,), fetch_one=True)
record("Notificación automática generada en inbox_cuentas", inbox_msg is not None and "48,500.50" in inbox_msg['mensaje'], f"Mensaje preview: {inbox_msg['mensaje'][:80] if inbox_msg else 'None'}...")

# -------------------------------------------------------------
# 4. CIUDADANO EXPERIMENTA BLOQUEO Y ENVÍA 'YA PAGUÉ'
# -------------------------------------------------------------
citizen_headers = {'Authorization': f'Bearer {citizen_token}'}

# Citizen calls /api/tramite/progreso
r = client.get('/api/tramite/progreso', headers=citizen_headers)
prog_data = r.get_json() or {}
record("Progreso de ciudadano refleja estado 'rechazada_multas'", prog_data.get('estado_cuenta') == 'rechazada_multas' and prog_data.get('multas_cantidad') == 2, f"Progreso estado: {prog_data.get('estado_cuenta')}")

# Citizen notifies 'Ya pagué'
pague_payload = {
    'mensaje': 'Ya aboné en BAPRO Pagos ambas infracciones. Adjunto comprobante 98234-A.',
    'adjunto_url': 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'adjunto_nombre': 'ticket_bapro_48500.png'
}
r = client.post('/api/usuario/notificar-ya-pague', json=pague_payload, headers=citizen_headers)
record("Ciudadano presiona 'Ya pagué' con comprobante (HTTP 200)", r.status_code == 200, f"Resp: {r.get_json()}")

db_pague = execute_query("SELECT infracciones_pagadas_solicitadas FROM usuarios WHERE id=?", (citizen_id,), fetch_one=True)
record("Campo infracciones_pagadas_solicitadas actualizado a 1", db_pague['infracciones_pagadas_solicitadas'] == 1, f"Valor: {db_pague['infracciones_pagadas_solicitadas']}")

# Citizen inbox
r = client.get('/api/inbox/mensajes', headers=citizen_headers)
mensajes_ciudadano = r.get_json().get('mensajes', [])
record("Ciudadano puede leer su historial en el Inbox", len(mensajes_ciudadano) >= 2, f"Total mensajes: {len(mensajes_ciudadano)}")

# -------------------------------------------------------------
# 5. ADMIN APRUEBA TRAS REVISIÓN DE COMPROBANTE
# -------------------------------------------------------------
r = client.post(f'/api/admin/cuentas/{citizen_id}/aprobar', headers=admin_headers)
record("Admin Cuentas aprueba la cuenta tras verificar pago (HTTP 200)", r.status_code == 200, f"Resp: {r.get_json()}")

db_approved = execute_query("SELECT estado_cuenta, multas_cantidad, multas_monto FROM usuarios WHERE id=?", (citizen_id,), fetch_one=True)
record("Base de datos actualizada a 'aprobada' con multas reseteadas a 0", db_approved['estado_cuenta'] == 'aprobada' and db_approved['multas_cantidad'] == 0 and db_approved['multas_monto'] == 0.0, f"DB: {db_approved}")

# -------------------------------------------------------------
# 6. AUDITORÍA CRÍTICA DE VULNERABILIDADES / BYPASS DE TRÁMITES
# -------------------------------------------------------------
print("\n--- INICIANDO AUDITORÍA DE BYPASS / VULNERABILIDADES DE SEGURIDAD ---")

# Creamos un usuario nuevo B y lo rechazamos explícitamente por multas
test_dni_b = str(random.randint(50000000, 59999999))
r = client.post('/api/auth/registro', json={
    'dni': test_dni_b, 'nombre': 'Multado', 'apellido': 'Vulnerable',
    'fecha_nacimiento': '1990-01-01', 'email': 'multado@test.com',
    'password': 'password123', 'tipo_tramite': 'nueva'
})
token_b = r.get_json()['token']
user_id_b = r.get_json()['usuario']['id']
headers_b = {'Authorization': f'Bearer {token_b}'}

# El admin lo rechaza por multas
client.post(f'/api/admin/cuentas/{user_id_b}/rechazar', json={'cantidad_multas': 3, 'monto_total': 80000}, headers=admin_headers)

# Verificamos que esté en rechazada_multas
db_b = execute_query("SELECT estado_cuenta FROM usuarios WHERE id=?", (user_id_b,), fetch_one=True)
record("Usuario B se encuentra oficialmente en 'rechazada_multas'", db_b['estado_cuenta'] == 'rechazada_multas')

# Prueba de Bypass 1: ¿Puede Usuario B ver videos de charlas viales por API?
r = client.get('/api/charlas/videos', headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado en /api/charlas/videos (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}")

# Prueba de Bypass 2: ¿Puede Usuario B marcar videos como vistos por API?
r = client.post('/api/charlas/marcar-visto', json={'video_id': 1}, headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado en /api/charlas/marcar-visto (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Prueba de Bypass 3: ¿Puede Usuario B llamar a saltar-paso?
r = client.post('/api/tramite/saltar-paso', json={'paso': 'formularios'}, headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado en /api/tramite/saltar-paso (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Prueba de Bypass 4: ¿Puede Usuario B enviar formularios de salud?
r = client.post('/api/formularios/enviar', json={
    'grupo_sanguineo': 'O+', 'usa_lentes': 'No', 'contacto_emergencia': 'Mama', 'telefono_emergencia': '11223344'
}, headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado al enviar formularios de salud (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Prueba de Bypass 5: ¿Puede Usuario B emitir licencia digital completa con saltar-paso='finalizado'?
r = client.post('/api/tramite/saltar-paso', json={'paso': 'finalizado'}, headers=headers_b)
licencia_db = execute_query("SELECT * FROM licencias WHERE usuario_id=?", (user_id_b,), fetch_one=True)
record("[SEGURIDAD VERIFICADA] Usuario con multas no puede emitir licencia digital con saltar-paso", r.status_code == 403 and licencia_db is None, f"Status: {r.status_code}, Licencia: {licencia_db}")

# Prueba de Bypass 6: ¿Puede Usuario B obtener preguntas de examen y entregarlas?
r = client.get('/api/examen/preguntas', headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado en /api/examen/preguntas (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}")

# Entregar examen
r = client.post('/api/examen/entregar', json={'respuestas': {'1': 'b', '2': 'b', '3': 'b', '4': 'b', '5': 'c'}}, headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado al entregar examen teórico (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Prueba de Bypass 7: ¿Puede Usuario B registrar un pago?
r = client.post('/api/pagos/registrar', json={'metodo': 'transferencia', 'comprobante': 'comprobante_falso.png', 'nombre_titular': 'Multado'}, headers=headers_b)
record("[SEGURIDAD VERIFICADA] Usuario con multas bloqueado al registrar pago de arancel (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Prueba limpia con Usuario C (sin saltar paso previamente)
test_dni_c = str(random.randint(60000000, 69999999))
r = client.post('/api/auth/registro', json={
    'dni': test_dni_c, 'nombre': 'MultadoLimpio', 'apellido': 'SinSaltar',
    'fecha_nacimiento': '1991-02-02', 'email': 'multadoc@test.com',
    'password': 'password123', 'tipo_tramite': 'nueva'
})
token_c = r.get_json()['token']
user_id_c = r.get_json()['usuario']['id']
headers_c = {'Authorization': f'Bearer {token_c}'}

# Admin lo rechaza con multas
client.post(f'/api/admin/cuentas/{user_id_c}/rechazar', json={'cantidad_multas': 1, 'monto_total': 25000}, headers=admin_headers)

# Intentar ver charla
r = client.post('/api/charlas/marcar-visto', json={'video_id': 1}, headers=headers_c)
record("[SEGURIDAD VERIFICADA] Usuario C con multas bloqueado al marcar video como visto (HTTP 403)", r.status_code == 403, f"Status: {r.status_code}, Resp: {r.get_json()}")

# Cleanup de usuarios de prueba creados (50000000-69999999)
test_users = execute_query("SELECT id FROM usuarios WHERE CAST(dni AS INTEGER) BETWEEN 50000000 AND 69999999", fetch_all=True) or []
for u in test_users:
    uid = u['id']
    trams = execute_query("SELECT id FROM tramites WHERE usuario_id=?", (uid,), fetch_all=True) or []
    for t in trams:
        tid = t['id']
        for tbl in ('videos_vistos', 'examenes_teoricos', 'mensajes_profesor', 'formularios_salud', 'pagos', 'reservas_turno', 'entregas', 'licencias'):
            execute_query(f"DELETE FROM {tbl} WHERE tramite_id=?", (tid,))
    for tbl in ('tramites', 'inbox_cuentas', 'user_activity_log', 'user_preferences'):
        execute_query(f"DELETE FROM {tbl} WHERE usuario_id=?", (uid,))
    execute_query("DELETE FROM usuarios WHERE id=?", (uid,))

# Guardar resumen de resultados en json
output_path = r"c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR\.agents\teamwork\explorer_survey_2\test_results.json"
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\n=================================================================")
print(f"VERIFICACIÓN FINALIZADA: {len(results)} pruebas ejecutadas ({sum(1 for x in results if x['passed'])}/{len(results)} PASS).")
print(f"Resultados guardados en {output_path}")
print("=================================================================")
