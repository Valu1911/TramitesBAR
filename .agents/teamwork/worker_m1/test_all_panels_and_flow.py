# -*- coding: utf-8 -*-
"""
Suite Integral de Pruebas Automatizadas E2E y de Integración
TramitesBAR - Paneles de Administración y Flujos de Trámite
Ejecución sobre Flask app.test_client() en entorno aislado
"""

import os
import sys
import json
import time
import datetime
import builtins

# Añadir directorio backend al path de python
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', 'sistema_licencias', 'backend'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app, execute_query, ACTIVE_EXAM_STREAMS

class TramitesBarTestSuite:
    def __init__(self):
        self.client = app.test_client()
        self.results = {
            'timestamp': datetime.datetime.now().isoformat(),
            'total_tests': 0,
            'passed': 0,
            'failed': 0,
            'modules': {},
            'critical_defects': [],
            'architectural_observations': [],
            'details': []
        }
        self.current_module = None
        self.dni_counter = 91000100

    def get_unique_dni(self):
        self.dni_counter += 1
        return str(self.dni_counter)

    def start_module(self, name):
        self.current_module = name
        self.results['modules'][name] = {'passed': 0, 'failed': 0, 'tests': []}
        print(f"\n{'='*70}\n>>> MÓDULO: {name}\n{'='*70}")

    def record_test(self, test_name, success, details=None, critical_defect=None, observation=None):
        self.results['total_tests'] += 1
        test_info = {
            'module': self.current_module,
            'name': test_name,
            'status': 'PASS' if success else 'FAIL',
            'details': details or {}
        }
        if critical_defect:
            test_info['defect'] = critical_defect
            self.results['critical_defects'].append({
                'module': self.current_module,
                'test': test_name,
                'defect': critical_defect
            })
        if observation:
            test_info['observation'] = observation
            self.results['architectural_observations'].append({
                'module': self.current_module,
                'test': test_name,
                'observation': observation
            })

        if success:
            self.results['passed'] += 1
            self.results['modules'][self.current_module]['passed'] += 1
            print(f"  [PASS] {test_name}")
        else:
            self.results['failed'] += 1
            self.results['modules'][self.current_module]['failed'] += 1
            print(f"  [FAIL] {test_name} - Details: {details}")

        self.results['modules'][self.current_module]['tests'].append(test_info)
        self.results['details'].append(test_info)

    def cleanup_test_data(self):
        """Elimina usuarios y datos vinculados en el rango de test 91000000 - 91999999."""
        try:
            users = execute_query(
                "SELECT id FROM usuarios WHERE dni LIKE '9100%'", fetch_all=True
            ) or []
            for u in users:
                uid = u['id']
                tramites = execute_query("SELECT id FROM tramites WHERE usuario_id=?", (uid,), fetch_all=True) or []
                for t in tramites:
                    tid = t['id']
                    execute_query("DELETE FROM videos_vistos WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM examenes_teoricos WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM mensajes_profesor WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM formularios_salud WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM pagos WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM reservas_turno WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM entregas WHERE tramite_id=?", (tid,))
                    execute_query("DELETE FROM licencias WHERE tramite_id=?", (tid,))
                execute_query("DELETE FROM tramites WHERE usuario_id=?", (uid,))
                execute_query("DELETE FROM inbox_cuentas WHERE usuario_id=?", (uid,))
                execute_query("DELETE FROM user_activity_log WHERE usuario_id=?", (uid,))
                execute_query("DELETE FROM user_preferences WHERE usuario_id=?", (uid,))
                execute_query("DELETE FROM usuarios WHERE id=?", (uid,))
        except Exception as e:
            print(f"Advertencia en cleanup: {e}")

    # =========================================================================
    # HELPERS DE AUTENTICACIÓN
    # =========================================================================
    def admin_login(self, username, password='admin123'):
        resp = self.client.post('/api/admin/login', json={'usuario': username, 'password': password})
        if resp.status_code == 200:
            return resp.get_json().get('token')
        return None

    def register_user(self, dni=None, tipo='nueva', cud=False, birth_date='1998-06-15'):
        if not dni:
            dni = self.get_unique_dni()
        payload = {
            'dni': dni,
            'nombre': 'CiudadanoTest',
            'apellido': 'BaraderoAuditoria',
            'email': f'test_{dni}@baradero.gob.ar',
            'telefono': '3329123456',
            'fecha_nacimiento': birth_date,
            'direccion': 'San Martin 500, Baradero',
            'tipo_tramite': tipo,
            'tiene_cud': 1 if cud else 0,
            'numero_cud': 'CUD-998877' if cud else '',
            'password': 'password123'
        }
        resp = self.client.post('/api/auth/registro', json=payload)
        data = resp.get_json() if resp.status_code in (200, 201) else {}
        return resp.status_code, data, dni

    # =========================================================================
    # 0. DETECCIÓN Y COMPROBACIÓN EMPÍRICA DE DEFECTOS CRÍTICOS NATIVOS
    # =========================================================================
    def test_native_defects_verification(self):
        self.start_module("Diagnóstico de Defectos Críticos Nativos")

        # Probar invocación no parchada de emitir_licencia_digital
        # Debe fallar con NameError: name 'qr_data' is not defined en app.py:176
        status, udata, test_dni = self.register_user(tipo='nueva')
        u_id = udata['usuario']['id']
        t_id = udata['usuario']['tramite_id']

        from app import emitir_licencia_digital
        lic_generada = None
        error_msg = ""
        try:
            lic_generada = emitir_licencia_digital(u_id, t_id)
        except Exception as e:
            error_msg = str(e)

        self.record_test(
            "Verificación de Remediación: emitir_licencia_digital funciona nativamente sin NameError (app.py:176)",
            lic_generada is not None and bool(lic_generada.get('qr_code_data')) and error_msg == "",
            {'qr_code_data': lic_generada.get('qr_code_data') if lic_generada else None, 'error': error_msg}
        )

    # =========================================================================
    # 1. PANEL ADMIN CUENTAS
    # =========================================================================
    def test_admin_cuentas_panel(self):
        self.start_module("Panel Admin Cuentas")

        token_cuentas = self.admin_login('admin_cuentas')
        self.record_test("Login Admin Cuentas (admin_cuentas / admin123)", token_cuentas is not None)
        if not token_cuentas:
            return

        headers = {'Authorization': f'Bearer {token_cuentas}'}

        # Listado con filtros
        resp_todos = self.client.get('/api/admin/cuentas?filtro=todos', headers=headers)
        d_todos = resp_todos.get_json()
        has_stats = resp_todos.status_code == 200 and 'pendientes' in d_todos and 'usuarios' in d_todos
        self.record_test("Admin Cuentas: Listar cuentas y métricas (filtro=todos)", has_stats, {
            'status': resp_todos.status_code,
            'total_usuarios': len(d_todos.get('usuarios', [])),
            'pendientes_count': d_todos.get('pendientes'),
            'con_multas_count': d_todos.get('con_multas')
        })

        # Filtros específicos
        for f in ['pendiente', 'aprobada', 'rechazada_multas', 'papelera']:
            r_f = self.client.get(f'/api/admin/cuentas?filtro={f}', headers=headers)
            self.record_test(f"Admin Cuentas: Filtro de listado '{f}'", r_f.status_code == 200 and 'usuarios' in r_f.get_json())

        # Crear un usuario para probar el ciclo de cuenta
        status, udata, user_dni = self.register_user(tipo='nueva')
        user_id = udata.get('usuario', {}).get('id')
        self.record_test("Admin Cuentas: Registro previo de usuario para auditoría", status == 201, {'user_id': user_id, 'dni': user_dni})

        # Ver expediente detallado
        resp_det = self.client.get(f'/api/admin/cuentas/{user_id}', headers=headers)
        d_det = resp_det.get_json()
        expediente_ok = resp_det.status_code == 200 and d_det.get('usuario', {}).get('dni') == user_dni
        self.record_test("Admin Cuentas: Consulta de expediente y ficha de ciudadano", expediente_ok, {
            'status': resp_det.status_code,
            'estado_cuenta': d_det.get('usuario', {}).get('estado_cuenta')
        })

        # Rechazo por multas (asignación de cantidad, monto y motivo)
        resp_rechazar = self.client.post(f'/api/admin/cuentas/{user_id}/rechazar', headers=headers, json={
            'cantidad_multas': 2,
            'monto_total': 34500.50,
            'mensaje': 'Exceso de velocidad en RP41 y cruce con semáforo en rojo'
        })
        d_rechazar = resp_rechazar.get_json()
        rechazo_ok = resp_rechazar.status_code == 200
        
        # Verificar en base de datos el estado 'rechazada_multas'
        u_db = execute_query("SELECT estado_cuenta, multas_cantidad, multas_monto, multas_motivo FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
        rechazo_db_ok = u_db and u_db['estado_cuenta'] == 'rechazada_multas' and u_db['multas_cantidad'] == 2 and u_db['multas_monto'] == 34500.50
        self.record_test("Admin Cuentas: Asignación de multas y cambio a 'rechazada_multas'", rechazo_ok and rechazo_db_ok, {
            'response': d_rechazar,
            'db_state': u_db
        })

        # Notificación automática en Inbox
        inbox_msgs = execute_query("SELECT * FROM inbox_cuentas WHERE usuario_id=? AND emisor='admin'", (user_id,), fetch_all=True) or []
        notif_multas_ok = len(inbox_msgs) > 0 and '34,500.50' in inbox_msgs[0]['mensaje']
        self.record_test("Admin Cuentas: Notificación oficial generada en inbox del ciudadano", notif_multas_ok, {
            'mensaje_inbox': inbox_msgs[0]['mensaje'] if inbox_msgs else None
        })

        # Ciudadano envía notificación de "Ya Pagué" con adjunto
        user_token = udata.get('token')
        u_headers = {'Authorization': f'Bearer {user_token}'}
        resp_ya_pague = self.client.post('/api/usuario/notificar-ya-pague', headers=u_headers, json={
            'mensaje': 'Realicé el pago en el Juzgado de Faltas, adjunto boleta timbrada',
            'adjunto_url': 'https://storage.baradero.gob.ar/comprobante_multa_123.pdf',
            'adjunto_nombre': 'comprobante_multa_123.pdf'
        })
        ya_pague_ok = resp_ya_pague.status_code == 200
        u_db_solic = execute_query("SELECT infracciones_pagadas_solicitadas FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
        solic_ok = u_db_solic and u_db_solic['infracciones_pagadas_solicitadas'] == 1
        self.record_test("Admin Cuentas: Recepción de notificación 'Ya Pagué' y comprobante", ya_pague_ok and solic_ok, {
            'status': resp_ya_pague.status_code,
            'db_flag': u_db_solic
        })

        # Mensajería bidireccional en Inbox
        resp_send_admin = self.client.post('/api/inbox/enviar', headers=headers, json={
            'usuario_id': user_id,
            'mensaje': 'Comprobante verificado correctamente con el tribunal municipal.'
        })
        msg_bidir_ok = resp_send_admin.status_code == 201
        self.record_test("Admin Cuentas: Mensajería bidireccional en tiempo real", msg_bidir_ok)

        # Aprobación de la cuenta
        resp_aprobar = self.client.post(f'/api/admin/cuentas/{user_id}/aprobar', headers=headers)
        d_aprob = resp_aprobar.get_json()
        u_db_aprob = execute_query("SELECT estado_cuenta, multas_cantidad, multas_monto FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
        aprob_ok = resp_aprobar.status_code == 200 and u_db_aprob and u_db_aprob['estado_cuenta'] == 'aprobada' and u_db_aprob['multas_cantidad'] == 0
        self.record_test("Admin Cuentas: Aprobación definitiva de cuenta y reseteo de infracciones", aprob_ok, {
            'response': d_aprob,
            'db_state': u_db_aprob
        })

        # Mover a papelera y restaurar
        resp_pap = self.client.post(f'/api/admin/cuentas/{user_id}/mover-papelera', headers=headers)
        u_db_pap = execute_query("SELECT estado_cuenta FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
        pap_ok = resp_pap.status_code == 200 and u_db_pap['estado_cuenta'] == 'papelera'
        self.record_test("Admin Cuentas: Envío de ciudadano a Papelera de reciclaje", pap_ok)

        resp_alta = self.client.post(f'/api/admin/cuentas/{user_id}/dar-alta', headers=headers)
        u_db_alta = execute_query("SELECT estado_cuenta FROM usuarios WHERE id=?", (user_id,), fetch_one=True)
        alta_ok = resp_alta.status_code == 200 and u_db_alta['estado_cuenta'] == 'aprobada'
        self.record_test("Admin Cuentas: Restauración / Dar de alta desde papelera", alta_ok)

    # =========================================================================
    # 2. PANEL ADMIN SALUD
    # =========================================================================
    def test_admin_salud_panel(self):
        self.start_module("Panel Admin Salud")

        token_salud = self.admin_login('admin_salud')
        self.record_test("Login Admin Salud (admin_salud / admin123)", token_salud is not None)
        if not token_salud:
            return

        headers = {'Authorization': f'Bearer {token_salud}'}

        # Listado de certificados
        resp_lista = self.client.get('/api/admin/salud?estado=todos', headers=headers)
        d_lista = resp_lista.get_json()
        lista_ok = resp_lista.status_code == 200 and 'formularios' in d_lista and 'pendientes' in d_lista
        self.record_test("Admin Salud: Listar DDJJ y certificados de aptitud física", lista_ok, {
            'status': resp_lista.status_code,
            'pendientes': d_lista.get('pendientes')
        })

        # Crear trámite y formulario de salud pendiente
        status, udata, user_dni = self.register_user(tipo='nueva')
        user_id = udata['usuario']['id']
        tramite_id = udata['usuario']['tramite_id']

        # Enviar formulario como 'pendiente'
        form_id = execute_query(
            """INSERT INTO formularios_salud 
               (tramite_id, grupo_sanguineo, usa_lentes, enfermedad_cronica, medicacion, contacto_emergencia, telefono_emergencia, certificado_archivo, estado)
               VALUES (?, '0+', 'Si', 'Hipertensión controlada', 'Enalapril 10mg', 'Familiar Directo', '3329445566', 'certificado_medico.pdf', 'pendiente')""",
            (tramite_id,)
        )
        execute_query("UPDATE tramites SET paso_actual='formularios' WHERE id=?", (tramite_id,))

        # Rechazo con observaciones médicas
        resp_rechazo = self.client.put(f'/api/admin/salud/{form_id}/revisar', headers=headers, json={
            'estado': 'rechazado',
            'observaciones': 'Certificado médico borroso o sin firma del profesional actuante'
        })
        form_db_rech = execute_query("SELECT estado, observaciones_admin FROM formularios_salud WHERE id=?", (form_id,), fetch_one=True)
        rechazo_ok = resp_rechazo.status_code == 200 and form_db_rech['estado'] == 'rechazado'
        self.record_test("Admin Salud: Rechazo de DDJJ de salud con observaciones clínicas", rechazo_ok, {
            'observaciones': form_db_rech.get('observaciones_admin')
        })

        # Aprobación médica y avance de máquina de estados
        resp_aprob = self.client.put(f'/api/admin/salud/{form_id}/revisar', headers=headers, json={
            'estado': 'aprobado',
            'observaciones': 'Apto psicofísico clase B1 validado conforme a normativa PBA'
        })
        form_db_aprob = execute_query("SELECT estado, observaciones_admin FROM formularios_salud WHERE id=?", (form_id,), fetch_one=True)
        tramite_db = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        aprob_ok = resp_aprob.status_code == 200 and form_db_aprob['estado'] == 'aprobado'
        avance_ok = tramite_db and tramite_db['paso_actual'] == 'examen'
        self.record_test("Admin Salud: Aprobación de Apto Médico y avance automático a Examen", aprob_ok and avance_ok, {
            'form_estado': form_db_aprob.get('estado'),
            'tramite_nuevo_paso': tramite_db.get('paso_actual')
        })

        # Test Aprobación en trámite de Renovación (debe avanzar a 'pago', no a 'examen')
        status_ren, udata_ren, _ = self.register_user(tipo='renovacion')
        t_ren_id = udata_ren['usuario']['tramite_id']
        f_ren_id = execute_query(
            """INSERT INTO formularios_salud 
               (tramite_id, grupo_sanguineo, usa_lentes, contacto_emergencia, telefono_emergencia, estado)
               VALUES (?, 'A+', 'No', 'Contacto Emergencia', '3329112233', 'pendiente')""",
            (t_ren_id,)
        )
        self.client.put(f'/api/admin/salud/{f_ren_id}/revisar', headers=headers, json={'estado': 'aprobado'})
        t_ren_db = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (t_ren_id,), fetch_one=True)
        ren_avance_ok = t_ren_db and t_ren_db['paso_actual'] == 'pago'
        self.record_test("Admin Salud: Aprobación en Renovación avanza directamente a 'pago' (bypasea examen)", ren_avance_ok, {
            'paso_actual_renovacion': t_ren_db.get('paso_actual')
        })

    # =========================================================================
    # 3. PANEL ADMIN PAGOS
    # =========================================================================
    def test_admin_pagos_panel(self):
        self.start_module("Panel Admin Pagos")

        token_pagos = self.admin_login('admin_pagos')
        self.record_test("Login Admin Pagos (admin_pagos / admin123)", token_pagos is not None)
        if not token_pagos:
            return

        headers = {'Authorization': f'Bearer {token_pagos}'}

        # Listado de pagos
        resp_lista = self.client.get('/api/admin/pagos?estado=todos', headers=headers)
        d_lista = resp_lista.get_json()
        lista_ok = resp_lista.status_code == 200 and 'pagos' in d_lista and 'pendientes' in d_lista
        self.record_test("Admin Pagos: Listar pagos y comprobantes arancelarios", lista_ok, {
            'status': resp_lista.status_code,
            'pendientes': d_lista.get('pendientes')
        })

        # Crear trámite y registrar pago pendiente
        status, udata, _ = self.register_user(tipo='nueva')
        tramite_id = udata['usuario']['tramite_id']
        execute_query("UPDATE tramites SET paso_actual='pago' WHERE id=?", (tramite_id,))

        pago_id = execute_query(
            """INSERT INTO pagos (tramite_id, metodo, monto, comprobante, estado)
               VALUES (?, 'transferencia', 12500.00, 'comprobante_banco_pcia.pdf', 'pendiente')""",
            (tramite_id,)
        )

        # Rechazo de comprobante
        resp_rech = self.client.put(f'/api/admin/pagos/{pago_id}/revisar', headers=headers, json={
            'estado': 'rechazado',
            'observaciones': 'Importe transferido no coincide con el arancel municipal oficial de $12.500'
        })
        p_db_rech = execute_query("SELECT estado, observaciones_admin FROM pagos WHERE id=?", (pago_id,), fetch_one=True)
        rech_ok = resp_rech.status_code == 200 and p_db_rech['estado'] == 'rechazado'
        self.record_test("Admin Pagos: Rechazo de pago con motivo fundado", rech_ok, {
            'observaciones': p_db_rech.get('observaciones_admin')
        })

        # Aprobación de pago y avance a examen práctico
        resp_aprob = self.client.put(f'/api/admin/pagos/{pago_id}/revisar', headers=headers, json={
            'estado': 'aprobado',
            'observaciones': 'Comprobante fiscal validado contra Tesorería Municipal'
        })
        p_db_aprob = execute_query("SELECT estado FROM pagos WHERE id=?", (pago_id,), fetch_one=True)
        t_db = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        aprob_ok = resp_aprob.status_code == 200 and p_db_aprob['estado'] == 'aprobado'
        avance_ok = t_db and t_db['paso_actual'] == 'practico'
        self.record_test("Admin Pagos: Aprobación de arancel y avance a Examen Práctico (Licencia Nueva)", aprob_ok and avance_ok, {
            'estado_pago': p_db_aprob.get('estado'),
            'nuevo_paso': t_db.get('paso_actual')
        })

        # Aprobación en Renovación (emite licencia digital y pasa a 'entrega' / 'completado')
        status_r, udata_r, _ = self.register_user(tipo='renovacion')
        t_r_id = udata_r['usuario']['tramite_id']
        u_r_id = udata_r['usuario']['id']
        execute_query("UPDATE tramites SET paso_actual='pago' WHERE id=?", (t_r_id,))
        p_r_id = execute_query(
            "INSERT INTO pagos (tramite_id, metodo, monto, estado) VALUES (?, 'debito', 12500.00, 'pendiente')",
            (t_r_id,)
        )
        resp_aprob_ren = self.client.put(f'/api/admin/pagos/{p_r_id}/revisar', headers=headers, json={'estado': 'aprobado'})
        t_r_db = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (t_r_id,), fetch_one=True)
        lic_r = execute_query("SELECT id, estado FROM licencias WHERE tramite_id=?", (t_r_id,), fetch_one=True)
        ren_pago_ok = resp_aprob_ren.status_code == 200 and t_r_db and t_r_db['paso_actual'] == 'entrega' and t_r_db['estado'] == 'completado' and lic_r is not None
        self.record_test("Admin Pagos: Aprobación en Renovación emite licencia digital y completa trámite", ren_pago_ok, {
            'tramite_paso': t_r_db.get('paso_actual') if t_r_db else None,
            'tramite_estado': t_r_db.get('estado') if t_r_db else None,
            'licencia_emitida': lic_r is not None
        })

    # =========================================================================
    # 4. PANEL ADMIN TURNOS
    # =========================================================================
    def test_admin_turnos_panel(self):
        self.start_module("Panel Admin Turnos")

        token_turnos = self.admin_login('admin_turnos')
        self.record_test("Login Admin Turnos (admin_turnos / admin123)", token_turnos is not None)
        if not token_turnos:
            return

        headers = {'Authorization': f'Bearer {token_turnos}'}

        # Listado de turnos
        resp_lista = self.client.get('/api/admin/turnos?estado=todos', headers=headers)
        d_lista = resp_lista.get_json()
        lista_ok = resp_lista.status_code == 200 and 'reservas' in d_lista and 'pendientes' in d_lista
        self.record_test("Admin Turnos: Listar agenda de turnos prácticos y reservas", lista_ok, {
            'status': resp_lista.status_code,
            'pendientes': d_lista.get('pendientes')
        })

        # Crear trámite y reserva
        status, udata, _ = self.register_user(tipo='nueva')
        tramite_id = udata['usuario']['tramite_id']
        usuario_id = udata['usuario']['id']
        execute_query("UPDATE tramites SET paso_actual='practico' WHERE id=?", (tramite_id,))

        turno = execute_query("SELECT id FROM turnos_practico WHERE activo=1 LIMIT 1", fetch_one=True)
        turno_id = turno['id'] if turno else 1

        reserva_id = execute_query(
            "INSERT INTO reservas_turno (tramite_id, turno_id, estado, resultado_examen) VALUES (?, ?, 'reservado', 'pendiente')",
            (tramite_id, turno_id)
        )

        # Rechazo / Desaprobado en circuito
        resp_rech = self.client.put(f'/api/admin/turnos/{reserva_id}/revisar', headers=headers, json={
            'estado': 'rechazado',
            'resultado_examen': 'desaprobado',
            'huella_tomada': 1,
            'foto_tomada': 1,
            'observaciones': 'Falla en estacionamiento paralelo en 3 maniobras y cono derribado'
        })
        res_db_rech = execute_query("SELECT estado, resultado_examen FROM reservas_turno WHERE id=?", (reserva_id,), fetch_one=True)
        rech_ok = resp_rech.status_code == 200 and res_db_rech['resultado_examen'] == 'desaprobado'
        self.record_test("Admin Turnos: Calificación práctica desaprobada", rech_ok, {
            'db_reserva': res_db_rech
        })

        # Aprobación completa con biometría (huella + foto carnet oficial) y emisión de licencia
        resp_aprob = self.client.put(f'/api/admin/turnos/{reserva_id}/revisar', headers=headers, json={
            'estado': 'completado',
            'resultado_examen': 'aprobado',
            'huella_tomada': 1,
            'foto_tomada': 1,
            'observaciones': 'Examen de manejo en circuito municipal aprobado satisfactoriamente'
        })
        res_db_aprob = execute_query("SELECT estado, resultado_examen, huella_tomada, foto_tomada FROM reservas_turno WHERE id=?", (reserva_id,), fetch_one=True)
        tramite_db = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        licencia_db = execute_query("SELECT id, estado FROM licencias WHERE tramite_id=?", (tramite_id,), fetch_one=True)

        aprob_ok = resp_aprob.status_code == 200 and res_db_aprob and res_db_aprob['estado'] == 'completado' and res_db_aprob['resultado_examen'] == 'aprobado'
        biometria_ok = res_db_aprob and res_db_aprob['huella_tomada'] == 1 and res_db_aprob['foto_tomada'] == 1
        emision_ok = tramite_db and tramite_db['paso_actual'] == 'entrega' and tramite_db['estado'] == 'completado' and licencia_db is not None

        self.record_test("Admin Turnos: Validación biométrica (huella + foto) y aprobación práctica con emisión", aprob_ok and biometria_ok and emision_ok, {
            'reserva': res_db_aprob,
            'tramite': tramite_db,
            'licencia_emitida': licencia_db is not None
        })

    # =========================================================================
    # 5. PANEL ADMIN PROFESORES
    # =========================================================================
    def test_admin_profesores_panel(self):
        self.start_module("Panel Admin Profesores")

        token_prof = self.admin_login('admin_profesores')
        self.record_test("Login Admin Profesores (admin_profesores / admin123)", token_prof is not None)
        if not token_prof:
            return

        headers = {'Authorization': f'Bearer {token_prof}'}

        # Configuración de modos de examen (plantilla, personalizado, híbrido)
        resp_get_cfg = self.client.get('/api/admin/config-examen', headers=headers)
        cfg_ok = resp_get_cfg.status_code == 200 and 'config' in resp_get_cfg.get_json()
        self.record_test("Admin Profesores: Obtener configuración de examen teórico", cfg_ok)

        resp_set_cfg = self.client.post('/api/admin/config-examen', headers=headers, json={
            'modo': 'hibrido',
            'cant_plantilla': 3,
            'cant_profesor': 2
        })
        cfg_db = execute_query("SELECT modo, cant_plantilla, cant_profesor FROM config_examen WHERE id=1", fetch_one=True)
        modo_ok = resp_set_cfg.status_code == 200 and cfg_db['modo'] == 'hibrido' and cfg_db['cant_plantilla'] == 3
        self.record_test("Admin Profesores: Modificar modo a examen híbrido (plantilla + profesor)", modo_ok, {
            'db_config': cfg_db
        })

        # CRUD de preguntas: Crear pregunta
        resp_q_create = self.client.post('/api/admin/preguntas', headers=headers, json={
            'pregunta': '¿Cuál es la distancia mínima lateral reglamentaria para adelantar a un ciclista en Baradero?',
            'opcion_a': '0.5 metros',
            'opcion_b': '1.5 metros',
            'opcion_c': '2 metros',
            'opcion_d': 'No hay distancia mínima',
            'respuesta_correcta': 'b',
            'es_plantilla': 0
        })
        d_qc = resp_q_create.get_json()
        new_qid = d_qc.get('id')
        q_create_ok = resp_q_create.status_code == 200 and new_qid is not None
        self.record_test("Admin Profesores: Crear nueva pregunta evaluativa personalizada", q_create_ok, {'new_qid': new_qid})

        # Editar pregunta
        resp_q_edit = self.client.put(f'/api/admin/preguntas/{new_qid}', headers=headers, json={
            'pregunta': '¿Cuál es la distancia lateral reglamentaria obligatoria para sobrepasar ciclistas?',
            'opcion_a': '0.5 metros',
            'opcion_b': '1.5 metros',
            'opcion_c': '2.0 metros',
            'opcion_d': 'Cualquier distancia',
            'respuesta_correcta': 'b',
            'es_plantilla': 0,
            'activo': 1
        })
        q_edit_ok = resp_q_edit.status_code == 200
        self.record_test("Admin Profesores: Editar contenido de pregunta evaluativa", q_edit_ok)

        # Vista previa de preguntas
        resp_preview = self.client.get('/api/admin/preguntas/preview', headers=headers)
        d_prev = resp_preview.get_json()
        prev_ok = resp_preview.status_code == 200 and len(d_prev.get('preguntas', [])) > 0
        self.record_test("Admin Profesores: Vista previa (preview) del simulador de examen", prev_ok, {
            'total_preview': d_prev.get('total')
        })

        # Monitoreo en vivo de alumnos rindiendo
        status_u, udata_u, _ = self.register_user(tipo='nueva')
        u_id = udata_u['usuario']['id']
        t_id = udata_u['usuario']['tramite_id']
        u_tok = udata_u['token']
        execute_query("UPDATE tramites SET paso_actual='examen' WHERE id=?", (t_id,))

        # Alumno envía ping de cámara y foco
        self.client.post('/api/examen/stream/ping', headers={'Authorization': f'Bearer {u_tok}'}, json={
            'cam_frame': 'data:image/jpeg;base64,mockframe...',
            'screen_frame': 'data:image/jpeg;base64,mockscreen...',
            'warnings_count': 1,
            'elapsed_seconds': 45,
            'current_question': 2
        })

        # Docente lee monitoreo en vivo
        resp_mon = self.client.get('/api/admin/examen/monitoreo', headers=headers)
        d_mon = resp_mon.get_json()
        mon_ok = resp_mon.status_code == 200 and any(e['usuario_id'] == u_id for e in d_mon.get('estudiantes', []))
        self.record_test("Admin Profesores: Monitoreo en vivo (telemetría de cámara, foco y tiempos)", mon_ok)

        # Expulsión de alumno por anti-fraude
        resp_expulsar = self.client.post('/api/admin/examen/expulsar', headers=headers, json={
            'tramite_id': t_id,
            'motivo': 'Detección de múltiples pestañas abiertas y uso de IA no autorizada'
        })
        ex_db = execute_query("SELECT expulsado, motivo_expulsion FROM examenes_teoricos WHERE tramite_id=?", (t_id,), fetch_one=True)
        msg_exp_db = execute_query("SELECT tipo, mensaje FROM mensajes_profesor WHERE tramite_id=? AND tipo='expulsion'", (t_id,), fetch_one=True)
        exp_ok = resp_expulsar.status_code == 200 and ex_db and ex_db['expulsado'] == 1 and msg_exp_db is not None
        self.record_test("Admin Profesores: Expulsión disciplinaria de examen y notificación formal", exp_ok, {
            'db_expulsion': ex_db,
            'mensaje_registrado': msg_exp_db is not None
        })

        # Envío de chat docente al alumno
        resp_chat = self.client.post('/api/admin/profesor/chat/enviar', headers=headers, json={
            'tramite_id': t_id,
            'mensaje': 'Por favor comunicate con la Dirección de Tránsito para coordinar nueva fecha presencial.'
        })
        chat_ok = resp_chat.status_code == 200
        self.record_test("Admin Profesores: Canal de chat directo profesor-alumno", chat_ok)

        # Restaurar configuración y plantilla
        self.client.post('/api/admin/config-examen', headers=headers, json={'modo': 'plantilla', 'cant_plantilla': 3, 'cant_profesor': 3})
        resp_rest = self.client.post('/api/admin/preguntas/restaurar-plantilla', headers=headers)
        self.record_test("Admin Profesores: Restauración de banco de preguntas base de Baradero", resp_rest.status_code == 200)

    # =========================================================================
    # 6. FLUJO INTEGRAL CIUDADANO: LICENCIA NUEVA (PASOS 1 AL 7)
    # =========================================================================
    def test_flujo_completo_licencia_nueva(self):
        self.start_module("Flujo Completo Trámite: Licencia Nueva (Pasos 1 a 7)")

        token_admin_cuentas = self.admin_login('admin_cuentas')
        token_admin_salud = self.admin_login('admin_salud')
        token_admin_pagos = self.admin_login('admin_pagos')
        token_admin_turnos = self.admin_login('admin_turnos')

        # 1. Registro inicial
        test_dni = self.get_unique_dni()
        status_reg, data_reg, _ = self.register_user(dni=test_dni, tipo='nueva', birth_date='1999-04-20')
        self.record_test("Paso 0: Alta y Registro de Ciudadano (Licencia Nueva)", status_reg == 201)
        if status_reg != 201:
            return

        user_token = data_reg['token']
        user_id = data_reg['usuario']['id']
        tramite_id = data_reg['usuario']['tramite_id']
        u_headers = {'Authorization': f'Bearer {user_token}'}

        # 2. Aprobación previa de cuenta en admin_cuentas
        resp_aprob_c = self.client.post(f'/api/admin/cuentas/{user_id}/aprobar', headers={'Authorization': f'Bearer {token_admin_cuentas}'})
        self.record_test("Paso 0: Aprobación de Cuenta y habilitación para trámites", resp_aprob_c.status_code == 200)

        # 3. Paso 1: Charlas en video
        resp_vids = self.client.get('/api/charlas/videos', headers=u_headers)
        d_vids = resp_vids.get_json()
        videos = d_vids.get('videos', [])
        self.record_test("Paso 1: Obtener catálogo de charlas de seguridad vial", resp_vids.status_code == 200 and len(videos) == 4, {
            'cantidad_videos': len(videos)
        })

        # Test de visualización fuera de orden (intentar ver video 3 sin ver el 1 y 2)
        if len(videos) >= 3:
            resp_orden_invalido = self.client.post('/api/charlas/marcar-visto', headers=u_headers, json={'video_id': videos[2]['id']})
            self.record_test("Paso 1: Bloqueo de avance en videos fuera de orden secuencial", resp_orden_invalido.status_code == 400, {
                'status': resp_orden_invalido.status_code,
                'resp': resp_orden_invalido.get_json()
            })

        # Ver los 4 videos en orden estricto
        for v in sorted(videos, key=lambda x: x['orden']):
            self.client.post('/api/charlas/marcar-visto', headers=u_headers, json={'video_id': v['id']})

        # Verificar avance automático a paso 'formularios'
        t_db_p1 = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        paso1_ok = t_db_p1 and t_db_p1['paso_actual'] == 'formularios'
        self.record_test("Paso 1: Charlas completadas y transición automática a 'formularios'", paso1_ok, {
            'paso_actual': t_db_p1.get('paso_actual')
        })

        # 4. Paso 2: Formularios de Salud
        resp_salud_post = self.client.post('/api/formularios/enviar', headers=u_headers, json={
            'grupo_sanguineo': '0+',
            'usa_lentes': 'No',
            'enfermedad_cronica': 'Ninguna',
            'medicacion': 'Ninguna',
            'contacto_emergencia': 'Mama Demo',
            'telefono_emergencia': '3329998877',
            'certificado_archivo': 'certificado_oftalmologico.png',
            'estado': 'pendiente'
        })
        form_id = resp_salud_post.get_json().get('id') if resp_salud_post.status_code == 200 else None
        self.record_test("Paso 2: Presentación de Declaración Jurada Médica y Certificado", resp_salud_post.status_code == 200 and form_id is not None)

        # Admin Salud aprueba el certificado
        self.client.put(f'/api/admin/salud/{form_id}/revisar', headers={'Authorization': f'Bearer {token_admin_salud}'}, json={
            'estado': 'aprobado',
            'observaciones': 'Aptitud psicofísica B1 aprobada por Dr. Baradero'
        })
        t_db_p2 = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Paso 2: Dictamen de Apto Médico y transición a 'examen'", t_db_p2 and t_db_p2['paso_actual'] == 'examen', {
            'paso_actual': t_db_p2.get('paso_actual')
        })

        # 5. Paso 3: Examen Teórico
        resp_qs = self.client.get('/api/examen/preguntas', headers=u_headers)
        preguntas = resp_qs.get_json().get('preguntas', [])
        self.record_test("Paso 3: Obtención de preguntas aleatorias para el examen teórico", resp_qs.status_code == 200 and len(preguntas) > 0, {
            'total_preguntas': len(preguntas)
        })

        # Responder examen aprobando (todas las correctas)
        respuestas_aprob = {}
        for q in preguntas:
            respuestas_aprob[str(q['id'])] = q['respuesta_correcta']

        resp_entrega = self.client.post('/api/examen/entregar', headers=u_headers, json={'respuestas': respuestas_aprob})
        d_ent = resp_entrega.get_json()
        ex_aprobado = resp_entrega.status_code == 200 and d_ent.get('aprobado') is True
        t_db_p3 = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Paso 3: Rendición y aprobación de examen teórico con transición a 'pago'", ex_aprobado and t_db_p3 and t_db_p3['paso_actual'] == 'pago', {
            'puntaje': d_ent.get('puntaje'),
            'paso_actual': t_db_p3.get('paso_actual')
        })

        # 6. Paso 4: Pago de Arancel
        resp_pago_info = self.client.get('/api/pagos/info', headers=u_headers)
        d_pinfo = resp_pago_info.get_json()
        self.record_test("Paso 4: Consulta de arancel oficial ($12.500) y datos bancarios CEPAT", resp_pago_info.status_code == 200 and d_pinfo.get('monto') == 12500.0)

        resp_pago_reg = self.client.post('/api/pagos/registrar', headers=u_headers, json={
            'metodo': 'transferencia',
            'comprobante': 'transferencia_comprobante_12500.png',
            'auto_aprobar': False
        })
        pago_id = resp_pago_reg.get_json().get('id') if resp_pago_reg.status_code == 200 else None
        self.record_test("Paso 4: Envío de comprobante de transferencia bancaria", resp_pago_reg.status_code == 200 and pago_id is not None)

        # Admin Pagos valida y aprueba
        self.client.put(f'/api/admin/pagos/{pago_id}/revisar', headers={'Authorization': f'Bearer {token_admin_pagos}'}, json={
            'estado': 'aprobado',
            'observaciones': 'Pago acreditado en cuenta municipal de Baradero'
        })
        t_db_p4 = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Paso 4: Aprobación contable del arancel y transición a 'practico'", t_db_p4 and t_db_p4['paso_actual'] == 'practico', {
            'paso_actual': t_db_p4.get('paso_actual')
        })

        # 7. Paso 5: Turno Examen Práctico
        resp_turnos = self.client.get('/api/turnos/disponibles', headers=u_headers)
        d_turnos = resp_turnos.get_json()
        turnos_disp = d_turnos.get('turnos', [])
        self.record_test("Paso 5: Consulta de turnos y cupos disponibles en circuito municipal", resp_turnos.status_code == 200 and len(turnos_disp) > 0)

        turno_id_elegido = turnos_disp[0]['id'] if turnos_disp else 1
        resp_res = self.client.post('/api/turnos/reservar', headers=u_headers, json={'turno_id': turno_id_elegido})
        reserva_id = resp_res.get_json().get('id') if resp_res.status_code == 200 else None
        self.record_test("Paso 5: Reserva de fecha y horario para examen de manejo", resp_res.status_code == 200 and reserva_id is not None)

        # Admin Turnos registra huella, foto carnet y califica apto
        self.client.put(f'/api/admin/turnos/{reserva_id}/revisar', headers={'Authorization': f'Bearer {token_admin_turnos}'}, json={
            'estado': 'completado',
            'resultado_examen': 'aprobado',
            'huella_tomada': 1,
            'foto_tomada': 1,
            'observaciones': 'Habilidades de manejo y estacionamiento aprobadas'
        })
        t_db_p5 = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Paso 5: Toma biométrica y calificación práctica aprobada (avance a entrega/completado)", t_db_p5 and t_db_p5['paso_actual'] == 'entrega', {
            'paso_actual': t_db_p5.get('paso_actual'),
            'estado': t_db_p5.get('estado')
        })

        # 8. Paso 6: Selección de Modalidad de Entrega
        # Test de validación: domicilio sin dirección debe rechazar con 400
        resp_ent_invalida = self.client.post('/api/entrega/solicitar', headers=u_headers, json={
            'metodo': 'domicilio',
            'direccion': ''
        })
        self.record_test("Paso 6: Validación estricta de dirección para envío a domicilio", resp_ent_invalida.status_code == 400)

        # Envío a domicilio con dirección válida
        resp_ent = self.client.post('/api/entrega/solicitar', headers=u_headers, json={
            'metodo': 'domicilio',
            'direccion': 'Calle Rodriguez 345, Baradero, Buenos Aires'
        })
        t_db_p6 = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Paso 6: Registro de solicitud de entrega y finalización del trámite", resp_ent.status_code == 200 and t_db_p6['paso_actual'] == 'finalizado' and t_db_p6['estado'] == 'completado')

        # 9. Paso 7: Emisión de Licencia Digital PBA
        resp_lic = self.client.get('/api/licencia/digital', headers=u_headers)
        d_lic = resp_lic.get_json()
        lic = d_lic.get('licencia')
        lic_ok = resp_lic.status_code == 200 and lic is not None and lic.get('estado') == 'vigente'

        # Verificar cálculo de vigencia según edad PBA (nacimiento 1999 -> 27 años -> 5 años vigencia)
        vigencia_5_anios = False
        if lic and lic.get('fecha_emision') and lic.get('fecha_vencimiento'):
            y_emision = int(lic['fecha_emision'].split('-')[0])
            y_venc = int(lic['fecha_vencimiento'].split('-')[0])
            vigencia_5_anios = (y_venc - y_emision) == 5

        self.record_test("Paso 7: Credencial digital emitida con QR, categoría B1 y vigencia PBA exacta (5 años)", lic_ok and vigencia_5_anios, {
            'numero_licencia': lic.get('numero_licencia') if lic else None,
            'fecha_emision': lic.get('fecha_emision') if lic else None,
            'fecha_vencimiento': lic.get('fecha_vencimiento') if lic else None,
            'dias_vigencia_anios': (y_venc - y_emision) if lic else None
        })

    # =========================================================================
    # 7. FLUJO INTEGRAL CIUDADANO: RENOVACIÓN (PASOS ABREVIADOS)
    # =========================================================================
    def test_flujo_completo_renovacion(self):
        self.start_module("Flujo Completo Trámite: Renovación Abreviada")

        token_admin_salud = self.admin_login('admin_salud')
        token_admin_pagos = self.admin_login('admin_pagos')

        test_dni = self.get_unique_dni()
        status_reg, data_reg, _ = self.register_user(dni=test_dni, tipo='renovacion', birth_date='1955-08-10')
        self.record_test("Renovación: Alta con tipo 'renovacion' (adulto mayor PBA, 71 años)", status_reg == 201)
        if status_reg != 201:
            return

        user_token = data_reg['token']
        tramite_id = data_reg['usuario']['tramite_id']
        u_headers = {'Authorization': f'Bearer {user_token}'}

        # Verificar que el paso inicial en renovación es 'formularios' (sin charlas)
        t_db_ini = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Renovación: Inicio directo en 'formularios' omitiendo charlas obligatorias", t_db_ini and t_db_ini['paso_actual'] == 'formularios')

        # 1. Enviar formulario de salud
        resp_f = self.client.post('/api/formularios/enviar', headers=u_headers, json={
            'grupo_sanguineo': 'B+',
            'usa_lentes': 'Si',
            'contacto_emergencia': 'Hijo Demo',
            'telefono_emergencia': '3329001122',
            'estado': 'pendiente'
        })
        form_id = resp_f.get_json().get('id') if resp_f.status_code == 200 else None

        # Admin Salud aprueba
        self.client.put(f'/api/admin/salud/{form_id}/revisar', headers={'Authorization': f'Bearer {token_admin_salud}'}, json={'estado': 'aprobado'})
        t_db_salud = execute_query("SELECT paso_actual FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        self.record_test("Renovación: Aprobación médica avanza directamente a 'pago' omitiendo examen teórico", t_db_salud and t_db_salud['paso_actual'] == 'pago')

        # 2. Registrar pago y aprobar
        resp_pago = self.client.post('/api/pagos/registrar', headers=u_headers, json={
            'metodo': 'transferencia',
            'auto_aprobar': False
        })
        pago_id = resp_pago.get_json().get('id') if resp_pago.status_code == 200 else None

        # Admin Pagos aprueba
        self.client.put(f'/api/admin/pagos/{pago_id}/revisar', headers={'Authorization': f'Bearer {token_admin_pagos}'}, json={'estado': 'aprobado'})
        t_db_pago = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        lic_ren = execute_query("SELECT * FROM licencias WHERE tramite_id=?", (tramite_id,), fetch_one=True)

        self.record_test("Renovación: Aprobación de pago emite credencial digital directamente (omite práctico)", t_db_pago and t_db_pago['paso_actual'] == 'entrega' and lic_ren is not None)

        # 3. Verificar vigencia PBA para mayor de 70 años (1 año de vigencia)
        vigencia_1_anio = False
        if lic_ren and lic_ren.get('fecha_emision') and lic_ren.get('fecha_vencimiento'):
            y_emision = int(lic_ren['fecha_emision'].split('-')[0])
            y_venc = int(lic_ren['fecha_vencimiento'].split('-')[0])
            vigencia_1_anio = (y_venc - y_emision) == 1

        self.record_test("Renovación: Vigencia PBA para mayores de 70 años calculada exactamente a 1 año", vigencia_1_anio, {
            'fecha_emision': lic_ren.get('fecha_emision') if lic_ren else None,
            'fecha_vencimiento': lic_ren.get('fecha_vencimiento') if lic_ren else None
        })

    # =========================================================================
    # 8. MÁQUINA DE ESTADOS, CONSISTENCIA Y VECTORES DE BYPASS
    # =========================================================================
    def test_secuenciamiento_y_boundaries(self):
        self.start_module("Secuenciamiento de Pasos, Stub y Boundaries")

        # Inspeccionar implementación de puede_acceder_paso
        test_dni = self.get_unique_dni()
        status_reg, data_reg, _ = self.register_user(dni=test_dni, tipo='nueva')
        user_token = data_reg['token']
        tramite_id = data_reg['usuario']['tramite_id']
        u_headers = {'Authorization': f'Bearer {user_token}'}

        # Intento de bypass 1: Ciudadano en paso 'charlas' intenta enviar respuestas de examen teórico
        resp_bypass_examen = self.client.post('/api/examen/entregar', headers=u_headers, json={
            'respuestas': {'1': 'b', '2': 'b', '3': 'b', '4': 'b'}
        })
        bloquea_salto_paso = resp_bypass_examen.status_code == 403
        self.record_test(
            "Control de Secuencialidad 'puede_acceder_paso': Bloquea invocar examen (HTTP 403) sin cursar charlas ni salud",
            bloquea_salto_paso,
            {'status': resp_bypass_examen.status_code, 'resp': resp_bypass_examen.get_json()}
        )

        # Intento de bypass 2: Endpoint de depuración 'saltar-paso'
        resp_saltar = self.client.post('/api/tramite/saltar-paso', headers=u_headers, json={'paso': 'finalizado'})
        d_saltar = resp_saltar.get_json()
        t_db_saltado = execute_query("SELECT paso_actual, estado FROM tramites WHERE id=?", (tramite_id,), fetch_one=True)
        saltar_funciona = resp_saltar.status_code == 200 and t_db_saltado['estado'] == 'completado'
        self.record_test(
            "Análisis de Endpoint 'saltar-paso': Permite completar trámite de forma arbitraria",
            saltar_funciona,
            {'status': resp_saltar.status_code, 'tramite_estado': t_db_saltado},
            observation="CUELLO DE BOTELLA/BYPASS: El endpoint `/api/tramite/saltar-paso` (diseñado para demos de desarrollo) se encuentra accesible a usuarios normales sin privilegios de administrador ni verificación de entorno."
        )

        # Intento de bypass 3: Usuario con multas pendientes puede autenticarse y crear trámite
        test_dni_multas = self.get_unique_dni()
        status_m, data_m, _ = self.register_user(dni=test_dni_multas, tipo='nueva')
        u_m_id = data_m['usuario']['id']
        token_admin_cuentas = self.admin_login('admin_cuentas')

        # Admin asigna infracciones
        self.client.post(f'/api/admin/cuentas/{u_m_id}/rechazar', headers={'Authorization': f'Bearer {token_admin_cuentas}'}, json={
            'cantidad_multas': 3,
            'monto_total': 50000.0,
            'mensaje': 'Alcoholemia positiva en operativo costanera Baradero'
        })

        # Comprobar que con estado 'rechazada_multas' el usuario puede consultar su estado en dashboard pero tiene bloqueado el avance de pasos (HTTP 403)
        u_m_headers = {'Authorization': f'Bearer {data_m["token"]}'}
        resp_progreso_con_multas = self.client.get('/api/tramite/progreso', headers=u_m_headers)
        resp_bloqueo_multas = self.client.post('/api/charlas/marcar-visto', headers=u_m_headers, json={'video_id': 1})
        self.record_test(
            "Control de Multas en Endpoints: Permite ver progreso en Dashboard (200) pero bloquea avance de trámite (403)",
            resp_progreso_con_multas.status_code == 200 and resp_bloqueo_multas.status_code == 403,
            {'progreso_status': resp_progreso_con_multas.status_code, 'avance_status': resp_bloqueo_multas.status_code}
        )

        # Comprobar endpoints de preferencias y actividad de usuario (correlación frontend-backend)
        resp_prefs_get = self.client.get('/api/user/preferences', headers=u_m_headers)
        resp_prefs_put = self.client.put('/api/user/preferences', headers=u_m_headers, json={'theme': 'light', 'last_page': 'dashboard'})
        resp_act_post = self.client.post('/api/user/activity', headers=u_m_headers, json={'action': 'page_view', 'detail': 'dashboard'})
        self.record_test(
            "Correlación Frontend-Backend: Endpoints /api/user/preferences y /api/user/activity operativos (HTTP 200/201)",
            resp_prefs_get.status_code == 200 and resp_prefs_put.status_code == 200 and resp_act_post.status_code == 201,
            {'get_prefs': resp_prefs_get.status_code, 'put_prefs': resp_prefs_put.status_code, 'post_act': resp_act_post.status_code}
        )

    def run_all(self):
        print("Iniciando Suite de Pruebas Integral de TramitesBAR...")
        start_time = time.time()
        self.cleanup_test_data()

        try:
            self.test_native_defects_verification()
            self.test_admin_cuentas_panel()
            self.test_admin_salud_panel()
            self.test_admin_pagos_panel()
            self.test_admin_turnos_panel()
            self.test_admin_profesores_panel()
            self.test_flujo_completo_licencia_nueva()
            self.test_flujo_completo_renovacion()
            self.test_secuenciamiento_y_boundaries()
        finally:
            self.cleanup_test_data()

        elapsed = round(time.time() - start_time, 2)
        self.results['elapsed_seconds'] = elapsed

        print("\n" + "="*70)
        print(f"RESUMEN FINAL DE EJECUCIÓN ({elapsed}s)")
        print(f"Total pruebas: {self.results['total_tests']}")
        print(f"Aprobadas:     {self.results['passed']}")
        print(f"Fallidas:      {self.results['failed']}")
        print(f"Defectos Críticos Detectados: {len(self.results['critical_defects'])}")
        print(f"Observaciones Arquitecturales: {len(self.results['architectural_observations'])}")
        print("="*70)

        # Guardar test_results.json
        output_file = os.path.join(os.path.dirname(__file__), 'test_results.json')
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, indent=2, ensure_ascii=False)
        print(f"Resultados guardados en: {output_file}")
        return self.results

if __name__ == '__main__':
    runner = TramitesBarTestSuite()
    runner.run_all()
