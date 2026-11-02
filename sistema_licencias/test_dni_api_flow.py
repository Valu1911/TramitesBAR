# -*- coding: utf-8 -*-
"""
Test completo de flujo de integración para Lector de DNI, Extracción de Rostro y Auto-completado
"""
import os
import sys
import json
import base64
import random
from PIL import Image, ImageDraw
import io

# Import backend app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
from app import app, init_db
from db import execute_query

def run_integration_tests():
    print("============================================================")
    print(" INICIANDO TESTS DE INTEGRACIÓN: LECTOR DNI Y ROSTRO")
    print("============================================================")
    
    init_db()
    client = app.test_client()

    # 1. Crear una imagen simulada con retrato de DNI
    img = Image.new('RGB', (500, 320), color=(220, 235, 252))
    draw = ImageDraw.Draw(img)
    # Dibujar recuadro de foto carnet a la izquierda
    draw.rectangle([20, 40, 160, 220], fill=(254, 215, 170), outline=(30, 58, 138), width=3)
    draw.ellipse([50, 70, 130, 160], fill=(253, 224, 71)) # cabeza
    draw.rectangle([30, 180, 150, 220], fill=(30, 58, 138)) # hombros
    
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    b64_img = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # Generar DNI aleatorio de prueba
    test_dni = str(random.randint(30000000, 49999999))
    pdf417_str = f"00512345678@ALVAREZ@MARCELO JAVIER@M@{test_dni}@A@15/07/1992@10/10/2015@204"

    print(f"\n[PASO 1] Probando /api/dni/procesar con imagen y código PDF417 (DNI: {test_dni})...")
    resp = client.post('/api/dni/procesar', json={
        'image': b64_img,
        'raw_text': pdf417_str
    })
    
    assert resp.status_code == 200, f"Error status: {resp.status_code} {resp.data}"
    data = resp.get_json()
    print("Respuesta /api/dni/procesar:", data.get('success'), data.get('dni'), data.get('nombre'), data.get('apellido'))
    
    assert data['success'] == True
    assert data['dni'] == test_dni
    assert data['nombre'] == 'Marcelo Javier'
    assert data['apellido'] == 'Alvarez'
    assert data['fecha_nacimiento'] == '1992-07-15'
    assert data['user_exists'] == False, "No debería existir antes de registrarse"
    assert data.get('foto_rostro') is not None, "Debe haber extraído la foto del rostro"
    print("[OK] Paso 1 Exitoso: DNI detectado, datos parseados y rostro extraido correctamente.")

    foto_rostro_extraida = data['foto_rostro']

    # 2. Registrar usuario con los datos y la foto extraídos
    print(f"\n[PASO 2] Registrando usuario con DNI {test_dni} y foto de perfil del DNI...")
    reg_payload = {
        'dni': test_dni,
        'nombre': data['nombre'],
        'apellido': data['apellido'],
        'fecha_nacimiento': data['fecha_nacimiento'],
        'email': f'marcelo_{test_dni}@baradero.gob.ar',
        'telefono': '3329-554433',
        'direccion': 'San Martin 450',
        'password': 'password123',
        'tipo_tramite': 'nueva',
        'foto_rostro': foto_rostro_extraida
    }
    
    reg_resp = client.post('/api/auth/registro', json=reg_payload)
    assert reg_resp.status_code == 201, f"Error registro: {reg_resp.status_code} {reg_resp.data}"
    reg_data = reg_resp.get_json()
    assert reg_data['usuario']['dni'] == test_dni
    assert reg_data['usuario']['foto_rostro'] == foto_rostro_extraida
    token = reg_data['token']
    print("[OK] Paso 2 Exitoso: Usuario registrado con foto_rostro persistida.")

    # 3. Procesar nuevamente el DNI y verificar que ahora user_exists es True
    print(f"\n[PASO 3] Re-escaneando DNI en Login (verificar deteccion de usuario existente)...")
    re_resp = client.post('/api/dni/procesar', json={
        'image': b64_img,
        'raw_text': pdf417_str
    })
    assert re_resp.status_code == 200
    re_data = re_resp.get_json()
    assert re_data['user_exists'] == True, "Ahora debe reportar que el usuario ya existe"
    assert re_data['usuario_existente']['nombre'] == 'Marcelo Javier'
    assert re_data['usuario_existente']['foto_rostro'] is not None
    print("[OK] Paso 3 Exitoso: Login reconoce automaticamente al usuario existente con su avatar.")

    # 4. Probar Login estándar y chequear que retorne foto_rostro
    print(f"\n[PASO 4] Iniciando sesion con contrasena...")
    login_resp = client.post('/api/auth/login', json={
        'dni': test_dni,
        'password': 'password123'
    })
    assert login_resp.status_code == 200
    login_data = login_resp.get_json()
    assert login_data['usuario']['foto_rostro'] == foto_rostro_extraida
    print("[OK] Paso 4 Exitoso: Login retorna la foto de perfil oficial.")

    # 5. Probar Dashboard / Progreso y chequear foto_rostro
    print(f"\n[PASO 5] Verificando progreso en el Dashboard...")
    prog_resp = client.get('/api/tramite/progreso', headers={'Authorization': f'Bearer {token}'})
    assert prog_resp.status_code == 200
    prog_data = prog_resp.get_json()
    assert prog_data['usuario']['foto_rostro'] == foto_rostro_extraida
    print("[OK] Paso 5 Exitoso: Dashboard contiene la foto_rostro en los datos del ciudadano.")

    # 6. Probar actualización voluntaria de foto de perfil
    print(f"\n[PASO 6] Actualizando foto de perfil voluntaria...")
    nueva_foto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP..."
    upd_resp = client.post('/api/usuario/foto-perfil', json={'foto_rostro': nueva_foto}, headers={'Authorization': f'Bearer {token}'})
    assert upd_resp.status_code == 200
    print("[OK] Paso 6 Exitoso: Endpoint de actualizacion de foto funciona correctamente.")

    print("\n============================================================")
    print(" TODOS LOS 6 PASOS DE INTEGRACIÓN COMPLETADOS CON ÉXITO [OK]")
    print("============================================================")

if __name__ == '__main__':
    run_integration_tests()
