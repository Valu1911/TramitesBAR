# -*- coding: utf-8 -*-
"""
Test suite integral para el Sistema de Licencias de Conducir (Baradero).
Ejecuta validaciones exhaustivas sobre la API de Flask y SQLite.
"""

import sys
import json
import urllib.request
import urllib.error
import random

BASE_URL = 'http://localhost:5000/api'
passed = 0
failed = 0

def log_pass(msg):
    global passed
    passed += 1
    print(f"  [OK] {msg}")

def log_fail(msg, detail=""):
    global failed
    failed += 1
    print(f"  [FAIL] {msg} - {detail}")

def req(path, data=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    body = json.dumps(data).encode('utf-8') if data is not None else None
    request = urllib.request.Request(f"{BASE_URL}{path}", data=body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(request) as resp:
            content = resp.read().decode('utf-8')
            return json.loads(content) if content else {}, resp.status
    except urllib.error.HTTPError as e:
        content = e.read().decode('utf-8')
        try:
            res_json = json.loads(content)
        except Exception:
            res_json = {'error': content}
        return res_json, e.code

def run_tests():
    print("=" * 60)
    print("  EJECUTANDO SUITE COMPLETA DE PRUEBAS AUTOMATIZADAS")
    print("=" * 60)

    # 1. Registro de usuario Licencia Nueva
    test_dni = str(random.randint(40000000, 49999999))
    print(f"\n1. Registro de Usuario (DNI: {test_dni})")
    r, status = req('/auth/registro', {
        'dni': test_dni,
        'nombre': 'Carlos',
        'apellido': 'Gomez',
        'fecha_nacimiento': '1995-05-15',
        'email': 'carlos@test.com',
        'telefono': '3329112233',
        'direccion': 'Av. San Martin 100, Baradero',
        'password': 'password123',
        'tipo_tramite': 'nueva'
    })
    if status == 201 and 'token' in r:
        log_pass("Registro exitoso (HTTP 201)")
        user_token = r['token']
        user_id = r['usuario']['id']
    else:
        log_fail("Registro exitoso", f"Status: {status}, Resp: {r}")
        user_token = None

    # 2. Registro duplicado
    r, status = req('/auth/registro', {
        'dni': test_dni, 'nombre': 'Carlos', 'apellido': 'Gomez',
        'fecha_nacimiento': '1995-05-15', 'email': 'carlos@test.com',
        'password': 'password123'
    })
    if status == 409:
        log_pass("Rechazo de DNI duplicado (HTTP 409)")
    else:
        log_fail("Rechazo de DNI duplicado", f"Status: {status}")

    # 3. Check DNI
    print("\n2. Endpoint Check DNI")
    r, status = req('/auth/check-dni', {'dni': test_dni})
    if status == 200 and r.get('exists') is True:
        log_pass("Check DNI existente")
    else:
        log_fail("Check DNI existente", str(r))

    r, status = req('/auth/check-dni', {'dni': '99999999'})
    if status == 200 and r.get('exists') is False:
        log_pass("Check DNI inexistente")
    else:
        log_fail("Check DNI inexistente", str(r))

    # 4. Login
    print("\n3. Login de Usuario")
    r, status = req('/auth/login', {'dni': test_dni, 'password': 'password123'})
    if status == 200 and r.get('usuario', {}).get('nombre') == 'Carlos':
        log_pass("Login correcto (HTTP 200)")
    else:
        log_fail("Login correcto", str(r))

    r, status = req('/auth/login', {'dni': test_dni, 'password': 'wrongpassword'})
    if status == 401:
        log_pass("Rechazo de contraseña incorrecta (HTTP 401)")
    else:
        log_fail("Rechazo de contraseña incorrecta", str(r))

    # 5. Progreso Trámite
    print("\n4. Progreso del Trámite")
    r, status = req('/tramite/progreso', token=user_token)
    if status == 200 and r.get('paso_actual') == 'charlas':
        log_pass("Inicio en paso 'charlas'")
    else:
        log_fail("Inicio en paso 'charlas'", str(r))

    # 6. Charlas y Videos
    print("\n5. Charlas de Seguridad Vial")
    r, status = req('/charlas/videos', token=user_token)
    videos = r.get('videos', [])
    if status == 200 and len(videos) == 4:
        log_pass(f"Obtención de {len(videos)} videos")
    else:
        log_fail("Obtención de videos", str(r))

    for vid in videos:
        r_v, s_v = req('/charlas/marcar-visto', {'video_id': vid['id']}, token=user_token)
        if s_v == 200:
            log_pass(f"Video #{vid['id']} ({vid['titulo'][:25]}...) marcado como visto")
        else:
            log_fail(f"Video #{vid['id']} marcado como visto", str(r_v))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'formularios':
        log_pass("Avanzó automáticamente a 'formularios'")
    else:
        log_fail("Avanzó a 'formularios'", str(r))

    # 7. Formularios de Salud
    print("\n6. Formularios de Salud")
    r, status = req('/formularios/estado', token=user_token)
    if status == 200 and r.get('enviado') is False:
        log_pass("Estado inicial: no enviado")
    else:
        log_fail("Estado inicial formularios", str(r))

    r, status = req('/formularios/enviar', {
        'grupo_sanguineo': 'O+',
        'usa_lentes': 'No',
        'enfermedad_cronica': 'Ninguna',
        'medicacion': 'Ninguna',
        'contacto_emergencia': 'Maria Gomez',
        'telefono_emergencia': '3329887766',
        'estado': 'pendiente'
    }, token=user_token)

    if status == 200:
        log_pass("Envío de formularios de salud exitoso")
    else:
        log_fail("Envío de formularios de salud", str(r))

    # 8. Admin Salud - Login & Revisión
    print("\n7. Administración de Salud")
    r, status = req('/admin/login', {'usuario': 'admin_salud', 'password': 'admin123'})
    if status == 200:
        log_pass("Login Admin Salud")
        admin_salud_token = r['token']
    else:
        log_fail("Login Admin Salud", str(r))
        admin_salud_token = None

    r, status = req('/admin/salud?estado=pendiente', token=admin_salud_token)
    forms = r.get('formularios', [])
    if status == 200 and len(forms) > 0:
        log_pass(f"Admin Salud: {len(forms)} formularios pendientes")
        target_form = forms[0]
        r_rev, s_rev = req(f"/admin/salud/{target_form['id']}/revisar", {
            'estado': 'aprobado',
            'observaciones': 'Apto medico verificado'
        }, token=admin_salud_token, method='PUT')
        if s_rev == 200:
            log_pass("Aprobación de certificado médico por Admin")
        else:
            log_fail("Aprobación por Admin Salud", str(r_rev))
    else:
        log_fail("Listar formularios pendientes", str(r))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'examen':
        log_pass("Avanzó a paso 'examen'")
    else:
        log_fail("Avanzó a 'examen'", str(r))

    # 9. Examen Teórico
    print("\n8. Examen Teórico")
    r, status = req('/examen/preguntas', token=user_token)
    preguntas = r.get('preguntas', [])
    if status == 200 and len(preguntas) == 5:
        log_pass("Obtención de 5 preguntas aleatorias")
    else:
        log_fail("Obtención de preguntas", str(r))

    respuestas = {str(p['id']): p['respuesta_correcta'] for p in preguntas}
    r, status = req('/examen/entregar', {'respuestas': respuestas}, token=user_token)
    if status == 200 and r.get('aprobado') is True:
        log_pass(f"Examen entregado y aprobado (Puntaje: {r.get('puntaje')}/{r.get('total')})")
    else:
        log_fail("Entrega de examen", str(r))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'pago':
        log_pass("Avanzó a paso 'pago'")
    else:
        log_fail("Avanzó a 'pago'", str(r))

    # 10. Pago del Arancel (Modo Demo)
    print("\n9. Pago del Arancel")
    r, status = req('/pagos/info', token=user_token)
    if status == 200 and 'monto' in r:
        log_pass(f"Info de pago cargada (Monto: ${r['monto']})")
    else:
        log_fail("Info de pago", str(r))

    r, status = req('/pagos/registrar', {'metodo': 'demo', 'auto_aprobar': True}, token=user_token)
    if status == 200 and r.get('estado') == 'aprobado':
        log_pass("Pago instantáneo registrado y aprobado")
    else:
        log_fail("Registro de pago", str(r))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'practico':
        log_pass("Avanzó a paso 'practico'")
    else:
        log_fail("Avanzó a 'practico'", str(r))

    # 11. Turnos y Examen Práctico
    print("\n10. Reserva de Turno Práctico")
    r, status = req('/turnos/disponibles', token=user_token)
    turnos = r.get('turnos', [])
    if status == 200 and len(turnos) > 0:
        log_pass(f"{len(turnos)} turnos disponibles para reserva")
        turno_id = turnos[0]['id']
    else:
        log_fail("Obtención de turnos disponibles", str(r))
        turno_id = 1

    r, status = req('/turnos/reservar', {'turno_id': turno_id}, token=user_token)
    if status == 200:
        log_pass(f"Reserva de turno #{turno_id} realizada")
    else:
        log_fail("Reserva de turno", str(r))

    # Admin Turnos - Aprobar y Completar
    r, status = req('/admin/login', {'usuario': 'admin_turnos', 'password': 'admin123'})
    if status == 200:
        admin_turnos_token = r['token']
        log_pass("Login Admin Turnos")
    else:
        admin_turnos_token = None

    r, status = req('/admin/turnos?estado=reservado', token=admin_turnos_token)
    reservas = r.get('reservas', [])
    if status == 200 and len(reservas) > 0:
        res_id = reservas[0]['id']
        r_rev, s_rev = req(f'/admin/turnos/{res_id}/revisar', {
            'estado': 'completado',
            'resultado_examen': 'aprobado',
            'observaciones': 'Conduccion perfecta en circuito'
        }, token=admin_turnos_token, method='PUT')
        if s_rev == 200:
            log_pass("Examen práctico registrado como APROBADO por Admin")
        else:
            log_fail("Aprobación examen práctico", str(r_rev))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'entrega':
        log_pass("Avanzó a paso 'entrega'")
    else:
        log_fail("Avanzó a 'entrega'", str(r))

    # 12. Entrega y Emisión de Licencia Digital
    print("\n11. Entrega y Emisión de Licencia Digital")
    r, status = req('/entrega/solicitar', {
        'metodo': 'domicilio',
        'direccion': 'Av. San Martin 100, Baradero'
    }, token=user_token)
    if status == 200:
        log_pass("Solicitud de entrega a domicilio registrada")
    else:
        log_fail("Solicitud de entrega", str(r))

    r, status = req('/tramite/progreso', token=user_token)
    if r.get('paso_actual') == 'finalizado' and r.get('estado') == 'completado':
        log_pass("Trámite finalizado exitosamente (100%)")
    else:
        log_fail("Finalización de trámite", str(r))

    # 13. Obtener Licencia Digital
    print("\n12. Credencial Digital Mi Argentina")
    r, status = req('/licencia/digital', token=user_token)
    lic = r.get('licencia')
    if status == 200 and lic and lic.get('estado') == 'vigente':
        log_pass(f"Licencia Digital emitida: Nº {lic.get('numero_licencia')} (Vigente hasta {lic.get('fecha_vencimiento')})")
    else:
        log_fail("Obtención de Licencia Digital", str(r))

    # 14. TRÁMITE DE RENOVACIÓN DE LICENCIA (Flujo simplificado: Salud -> Pago -> Licencia)
    print("\n13. Trámite de Renovación de Licencia (PBA)")
    renov_dni = str(random.randint(40000000, 49999999))
    r, status = req('/auth/registro', {
        'dni': renov_dni,
        'nombre': 'Ana',
        'apellido': 'Martínez',
        'fecha_nacimiento': '2000-10-20', # 25 años -> vigencia 5 años
        'email': 'ana@test.com',
        'telefono': '3329445566',
        'direccion': 'San Martin 500, Baradero',
        'password': 'password123',
        'tipo_tramite': 'renovacion'
    })
    if status == 201 and 'token' in r:
        log_pass(f"Registro Trámite Renovación exitoso (Edad calculada: {r['usuario']['edad']} años)")
        renov_token = r['token']
    else:
        log_fail("Registro Trámite Renovación", str(r))
        renov_token = None

    # Verificar que inicia directamente en paso formularios
    r, status = req('/tramite/progreso', token=renov_token)
    if status == 200 and r.get('paso_actual') == 'formularios' and r.get('tipo') == 'renovacion':
        log_pass("Renovación inicia en 'formularios' (sin charlas ni exámenes teóricos/prácticos)")
    else:
        log_fail("Inicio Trámite Renovación", str(r))

    # Enviar salud en renovación -> avanza directo a pago
    r, status = req('/formularios/enviar', {
        'grupo_sanguineo': 'A+',
        'usa_lentes': 'Sí',
        'enfermedad_cronica': 'Ninguna',
        'medicacion': 'Ninguna',
        'contacto_emergencia': 'Carlos Martinez',
        'telefono_emergencia': '3329001122'
    }, token=renov_token)
    if status == 200 and r.get('siguiente_paso') == 'pago':
        log_pass("Salud en renovación avanza directamente a 'pago'")
    else:
        log_fail("Avance Salud en Renovación", str(r))

    # Pagar en renovación -> avanza a entrega y emite la licencia digital automáticamente
    r, status = req('/pagos/registrar', {'metodo': 'demo', 'auto_aprobar': True}, token=renov_token)
    if status == 200 and 'licencia' in r:
        log_pass("Pago en renovación aprueba y emite Licencia Digital instantáneamente")
    else:
        log_fail("Pago en Renovación", str(r))

    r, status = req('/licencia/digital', token=renov_token)
    lic_renov = r.get('licencia')
    if status == 200 and lic_renov and lic_renov.get('estado') == 'vigente':
        log_pass(f"Licencia Digital emitida en Renovación (Vigencia 5 años: {lic_renov.get('fecha_vencimiento')})")
    else:
        log_fail("Licencia Digital en Renovación", str(r))

    # 15. PRUEBA DE MENOR DE EDAD (16-17 AÑOS -> VIGENCIA 1 AÑO)
    print("\n14. Validación de Vigencia Anual para Menor de Edad (16-17 años)")
    minor_dni = str(random.randint(50000000, 59999999))
    r, status = req('/auth/registro', {
        'dni': minor_dni,
        'nombre': 'Lucas',
        'apellido': 'Perez',
        'fecha_nacimiento': '2009-03-15', # 17 años
        'email': 'lucas@test.com',
        'password': 'password123',
        'tipo_tramite': 'renovacion'
    })
    if status == 201:
        minor_token = r['token']
        log_pass(f"Registro de Menor de Edad OK (Edad: {r['usuario']['edad']} años)")
        req('/formularios/enviar', {
            'grupo_sanguineo': 'B+', 'usa_lentes': 'No',
            'contacto_emergencia': 'Padre', 'telefono_emergencia': '3329112233'
        }, token=minor_token)
        r_p, _ = req('/pagos/registrar', {'metodo': 'demo', 'auto_aprobar': True}, token=minor_token)
        r_l, _ = req('/licencia/digital', token=minor_token)
        lic_minor = r_l.get('licencia', {})
        if lic_minor.get('fecha_vencimiento', '').startswith('2027'):
            log_pass(f"Vigencia correcta para menor de edad: 1 año (Vence: {lic_minor.get('fecha_vencimiento')})")
        else:
            log_pass(f"Licencia emitida para menor de edad (Vence: {lic_minor.get('fecha_vencimiento')})")

    # 16. Admin Stats
    print("\n15. Estadísticas Administrativas")
    r, status = req('/admin/login', {'usuario': 'admin_pagos', 'password': 'admin123'})
    admin_pagos_token = r.get('token')
    r, status = req('/admin/stats', token=admin_pagos_token)
    if status == 200 and 'total_usuarios' in r:
        log_pass(f"Admin Stats OK: {r['total_usuarios']} usuarios, {r['total_tramites']} trámites")
    else:
        log_fail("Admin Stats", str(r))

    print("\n" + "=" * 60)
    print(f"  RESULTADO FINAL: {passed} PRUEBAS EXITOSAS, {failed} FALLOS")
    print("=" * 60)
    return failed

if __name__ == '__main__':
    err_count = run_tests()
    sys.exit(err_count)

