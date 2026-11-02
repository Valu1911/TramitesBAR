"""
Test suite para el API del sistema de licencias.
"""
import urllib.request
import json
import sys

base = 'http://localhost:5000/api'

def api(path, data=None, token=None, method=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(base + path, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        return json.loads(e.read()), e.code

errors = 0

def check(name, condition, detail=""):
    global errors
    if condition:
        print(f"  [OK] {name}")
    else:
        print(f"  [FAIL] {name} - {detail}")
        errors += 1

import random
import time

test_dni = str(random.randint(40000000, 49999999))

# ============================================================
# Test 1: Registration
# ============================================================
print(f"=== TEST: User Registration (DNI {test_dni}) ===")
r, c = api('/auth/registro', {
    'dni': test_dni, 'nombre': 'Maria', 'apellido': 'Garcia',
    'email': 'maria@test.com', 'telefono': '1155667788',
    'password': 'test1234', 'tipo_tramite': 'nueva'
})
check("Register status 201", c == 201, f"Got {c}")
check("Has token", 'token' in r, str(r))
check("Has usuario", 'usuario' in r, str(r))
token = r.get('token', '')
user = r.get('usuario', {})
check("User has tramite_id", user.get('tramite_id') is not None, str(user))

# ============================================================
# Test 2: Duplicate registration
# ============================================================
print("\n=== TEST: Duplicate Registration ===")
r, c = api('/auth/registro', {
    'dni': test_dni, 'nombre': 'Maria', 'apellido': 'Garcia',
    'email': 'maria@test.com', 'telefono': '1155667788',
    'password': 'test1234', 'tipo_tramite': 'nueva'
})
check("Duplicate rejected 409", c == 409, f"Got {c}")

# ============================================================
# Test 3: Login
# ============================================================
print("\n=== TEST: User Login ===")
r, c = api('/auth/login', {'dni': test_dni, 'password': 'test1234'})
check("Login status 200", c == 200, f"Got {c}")
check("Login returns nombre", r.get('usuario', {}).get('nombre') == 'Maria', str(r))
token = r.get('token', token)

# ============================================================
# Test 4: Wrong password
# ============================================================
print("\n=== TEST: Wrong Password ===")
r, c = api('/auth/login', {'dni': test_dni, 'password': 'wrong'})
check("Wrong password 401", c == 401, f"Got {c}")

# ============================================================
# Test 5: Progreso
# ============================================================
print("\n=== TEST: Progreso ===")
r, c = api('/tramite/progreso', token=token)
check("Progreso status 200", c == 200, f"Got {c}")
pasos = [p['id'] for p in r.get('pasos', [])]
check("Flow order correct", pasos == ['charlas', 'formularios', 'examen', 'pago', 'practico', 'entrega'], str(pasos))
check("Paso actual is charlas", r.get('paso_actual') == 'charlas', r.get('paso_actual'))

# ============================================================
# Test 6: Videos
# ============================================================
print("\n=== TEST: Videos ===")
r, c = api('/charlas/videos', token=token)
check("Videos status 200", c == 200, f"Got {c}")
videos = r.get('videos', [])
check("Has 4 videos", len(videos) == 4, f"Got {len(videos)}")
check("Videos not watched", r.get('todos_vistos') == False, str(r.get('todos_vistos')))

# ============================================================
# Test 7: Mark videos as watched
# ============================================================
print("\n=== TEST: Watch Videos ===")
for vid in videos:
    r2, c2 = api('/charlas/marcar-visto', {'video_id': vid['id']}, token=token)
    check(f"Video {vid['id']} marked", c2 == 200, f"Got {c2}: {r2}")

# ============================================================
# Test 8: Progreso should now be 'formularios'
# ============================================================
print("\n=== TEST: Progreso After Charlas ===")
r, c = api('/tramite/progreso', token=token)
check("Paso now formularios", r.get('paso_actual') == 'formularios', r.get('paso_actual'))

print("\n=== TEST: Examen Accessible In Demo Mode ===")
r, c = api('/examen/preguntas', token=token)
check("Examen accessible 200", c == 200, f"Got {c}: {r}")

# ============================================================
# Test 10: Submit formularios
# ============================================================
print("\n=== TEST: Submit Formularios ===")
r, c = api('/formularios/enviar', {
    'grupo_sanguineo': 'A+', 'usa_lentes': 'No',
    'enfermedad_cronica': 'Ninguna', 'medicacion': 'Ninguna',
    'contacto_emergencia': 'Juan Perez', 'telefono_emergencia': '3329000000'
}, token=token)
check("Formularios submitted 200", c == 200, f"Got {c}: {r}")

# ============================================================
# Test 11: Admin login and approve formularios
# ============================================================
print("\n=== TEST: Admin Salud Flow ===")
r, c = api('/admin/login', {'usuario': 'admin_salud', 'password': 'admin123'})
check("Admin salud login 200", c == 200, f"Got {c}")
admin_token = r.get('token', '')

r, c = api('/admin/salud?estado=pendiente', token=admin_token)
check("Admin see pending forms", c == 200, f"Got {c}: {r}")
forms = r.get('formularios', [])
check("Has 1 pending form", len(forms) >= 1, f"Got {len(forms)}")

if forms:
    form_id = forms[0]['id']
    r, c = api(f'/admin/salud/{form_id}/revisar', {'estado': 'aprobado', 'observaciones': 'OK'},
               token=admin_token, method='PUT')
    check("Admin approved form", c == 200, f"Got {c}: {r}")

# ============================================================
# Test 12: Progreso should now be 'examen'
# ============================================================
print("\n=== TEST: Progreso After Salud Approval ===")
r, c = api('/tramite/progreso', token=token)
check("Paso now examen", r.get('paso_actual') == 'examen', r.get('paso_actual'))

# ============================================================
# Test 13: Get and submit examen
# ============================================================
print("\n=== TEST: Examen ===")
r, c = api('/examen/preguntas', token=token)
check("Get preguntas 200", c == 200, f"Got {c}")
check("Has 5 preguntas", len(r.get('preguntas', [])) == 5, f"Got {len(r.get('preguntas', []))}")

# Answer all correctly based on known answers
preguntas = r.get('preguntas', [])
respuestas = {}
# We know the correct answers from schema
correct_answers = {
    'b': True  # Most answers are 'b' except cinturon which is 'c' and alcohol which is 'a'
}
for p in preguntas:
    respuestas[str(p['id'])] = p.get('respuesta_correcta', 'b')

r, c = api('/examen/entregar', {'respuestas': respuestas}, token=token)
check("Examen submitted 200", c == 200, f"Got {c}: {r}")
check("Examen approved 5/5", r.get('aprobado') == True, f"Got {r}")
print(f"  Score: {r.get('puntaje')}/{r.get('total')}, Approved: {r.get('aprobado')}")

# ============================================================
# Test 14: Admin login for pagos
# ============================================================
print("\n=== TEST: Admin Pagos Login ===")
r, c = api('/admin/login', {'usuario': 'admin_pagos', 'password': 'admin123'})
check("Admin pagos login 200", c == 200, f"Got {c}")
admin_pagos_token = r.get('token', '')

# ============================================================
# Test 15: Admin login for turnos
# ============================================================
print("\n=== TEST: Admin Turnos Login ===")
r, c = api('/admin/login', {'usuario': 'admin_turnos', 'password': 'admin123'})
check("Admin turnos login 200", c == 200, f"Got {c}")
admin_turnos_token = r.get('token', '')

# ============================================================
# Test 16: Admin stats
# ============================================================
print("\n=== TEST: Admin Stats ===")
r, c = api('/admin/stats', token=admin_pagos_token)
check("Stats status 200", c == 200, f"Got {c}")
check("Has total_usuarios", 'total_usuarios' in r, str(r))
print(f"  Users: {r.get('total_usuarios')}, Tramites: {r.get('total_tramites')}")

# ============================================================
# Test 17: Check DNI endpoint
# ============================================================
print("\n=== TEST: Check DNI ===")
r, c = api('/auth/check-dni', {'dni': test_dni})
check("Existing DNI found", r.get('exists') == True, str(r))

r, c = api('/auth/check-dni', {'dni': '99999999'})
check("Non-existing DNI not found", r.get('exists') == False, str(r))

# ============================================================
# SUMMARY
# ============================================================
print("\n" + "=" * 60)
if errors == 0:
    print("ALL TESTS PASSED!")
else:
    print(f"TESTS COMPLETED WITH {errors} FAILURE(S)")
print("=" * 60)
