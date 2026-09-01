# -*- coding: utf-8 -*-
"""
Test de verificación para decodificación de DNI argentino y extracción facial
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from dni_processor import parse_argentina_dni_raw_string, process_dni_image, extract_face_avatar

def run_tests():
    print("=== TEST 1: Decodificación de Strings PDF417 Argentino ===")
    
    # Formato Moderno
    sample_moderno = "00512345678@GONZALEZ@CARLOS ALBERTO@M@38123456@A@14/05/1994@10/10/2014@204"
    res1 = parse_argentina_dni_raw_string(sample_moderno)
    print(f"Sample Moderno parseado: {res1}")
    assert res1['dni'] == '38123456', f"Error DNI: {res1['dni']}"
    assert res1['nombre'] == 'Carlos Alberto', f"Error Nombre: {res1['nombre']}"
    assert res1['apellido'] == 'Gonzalez', f"Error Apellido: {res1['apellido']}"
    assert res1['fecha_nacimiento'] == '1994-05-14', f"Error Fecha: {res1['fecha_nacimiento']}"
    assert res1['sexo'] == 'M', f"Error Sexo: {res1['sexo']}"
    print("[PASS] Test 1.1: Formato Moderno OK")

    # Formato Antiguo
    sample_antiguo = "29876543@B@RODRIGUEZ@MARIA LAURA@F@ARG@22/08/1982@01/03/2012"
    res2 = parse_argentina_dni_raw_string(sample_antiguo)
    print(f"Sample Antiguo parseado: {res2}")
    assert res2['dni'] == '29876543', f"Error DNI: {res2['dni']}"
    assert res2['nombre'] == 'Maria Laura', f"Error Nombre: {res2['nombre']}"
    assert res2['apellido'] == 'Rodriguez', f"Error Apellido: {res2['apellido']}"
    assert res2['fecha_nacimiento'] == '1982-08-22', f"Error Fecha: {res2['fecha_nacimiento']}"
    print("[PASS] Test 1.2: Formato Antiguo OK")

    # Formato separado por comas
    sample_comas = '"00123456789","FERNANDEZ","LUCAS GABRIEL","M","41987654","A","03/11/1999"'
    res3 = parse_argentina_dni_raw_string(sample_comas)
    print(f"Sample Comas parseado: {res3}")
    assert res3['dni'] == '41987654', f"Error DNI: {res3['dni']}"
    print("[PASS] Test 1.3: Formato Comas OK")

    print("\n=== TEST 2: Detección y Procesamiento de Imagen ===")
    # Crear imagen sintética de prueba
    img = Image.new('RGB', (600, 400), color=(240, 240, 240))
    draw = ImageDraw.Draw(img)
    draw.rectangle([20, 20, 580, 380], outline=(37, 99, 235), width=4)
    draw.text((40, 40), "REPUBLICA ARGENTINA - DNI", fill=(0, 0, 0))
    
    import io
    import base64
    buf = io.BytesIO()
    img.save(buf, format='JPEG')
    b64_img = f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}"

    # Probar endpoint helper con raw text hint
    res_proc = process_dni_image(b64_img, raw_text_hint=sample_moderno)
    print(f"Resultado process_dni_image: {res_proc['success']}, DNI={res_proc.get('dni')}, Tipo={res_proc.get('tipo_detectado')}")
    assert res_proc['success'] == True
    assert res_proc['dni'] == '38123456'
    print("[PASS] Test 2: Process DNI con imagen y hint OK")

    print("\nTODOS LOS TESTS DE DNI UNITARIOS PASARON CORRECTAMENTE [OK]")

if __name__ == '__main__':
    run_tests()
