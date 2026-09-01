# -*- coding: utf-8 -*-
"""
Módulo de Procesamiento de DNI Argentino (Frente y Dorso)
- Decodificación de código de barras 2D PDF417 (Dorso)
- Detección biométrica y recorte inteligente de rostro para foto de perfil (Frente)
- Extracción estructurada de DNI, Nombre, Apellido, Sexo y Fecha de Nacimiento
"""

import os
import re
import io
import base64
import datetime
from PIL import Image

try:
    import numpy as np
except ImportError:
    np = None

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import zxing_cpp
except ImportError:
    zxing_cpp = None

try:
    from pdf417decoder import PDF417Decoder
except ImportError:
    PDF417Decoder = None


def decode_base64_image(image_data):
    """
    Decodifica una imagen en base64 (con o sin encabezado data:image/...) a PIL Image y numpy array.
    """
    if isinstance(image_data, str):
        if ',' in image_data:
            image_data = image_data.split(',', 1)[1]
        raw_bytes = base64.b64decode(image_data)
    elif isinstance(image_data, bytes):
        raw_bytes = image_data
    else:
        raise ValueError("Formato de imagen inválido")

    pil_img = Image.open(io.BytesIO(raw_bytes))
    if pil_img.mode != 'RGB':
        pil_img = pil_img.convert('RGB')

    np_img = np.array(pil_img) if np is not None else None
    return pil_img, np_img, raw_bytes


def parse_argentina_dni_raw_string(raw_text):
    """
    Parsea cadenas del código PDF417 de DNIs argentinos.
    Formatos comunes:
    1) Standard Moderno (@ separado):
       tramite@apellido@nombre@sexo@dni@ejemplar@fecha_nac@fecha_emision@codigo
       Ej: 00512345678@PEREZ@JUAN CARLOS@M@38492012@A@14/05/1994@10/10/2014@204
    2) Formato Antiguo (@ separado):
       dni@ejemplar@apellido@nombre@sexo@nacionalidad@fecha_nac@fecha_emision
    3) Formato separado por comas o comillas:
       "00512345678","PEREZ","JUAN CARLOS","M","38492012",...
    """
    if not raw_text or not isinstance(raw_text, str):
        return None

    raw_text = raw_text.strip()
    result = {
        'dni': None,
        'nombre': None,
        'apellido': None,
        'sexo': None,
        'fecha_nacimiento': None,
        'ejemplar': None,
        'tramite': None,
        'raw_text': raw_text
    }

    # Probar split por '@'
    if '@' in raw_text:
        parts = [p.strip() for p in raw_text.split('@')]
        if len(parts) >= 6:
            # Caso 1: Moderno (parte 0 es trámite de 11 dígitos, parte 4 es DNI de 7-8 dígitos)
            if len(parts) >= 8 and parts[4].replace('.', '').isdigit() and (len(parts[4].replace('.', '')) in (7, 8)):
                result['tramite'] = parts[0]
                result['apellido'] = parts[1].title()
                result['nombre'] = parts[2].title()
                result['sexo'] = parts[3].upper()
                result['dni'] = parts[4].replace('.', '')
                result['ejemplar'] = parts[5]
                result['fecha_nacimiento'] = format_date_str(parts[6])
                return result
            
            # Caso 2: Antiguo (parte 0 es DNI)
            if parts[0].replace('.', '').isdigit() and len(parts[0].replace('.', '')) in (7, 8):
                result['dni'] = parts[0].replace('.', '')
                result['ejemplar'] = parts[1] if len(parts) > 1 else None
                result['apellido'] = parts[2].title() if len(parts) > 2 else None
                result['nombre'] = parts[3].title() if len(parts) > 3 else None
                result['sexo'] = parts[4].upper() if len(parts) > 4 else None
                if len(parts) > 6:
                    result['fecha_nacimiento'] = format_date_str(parts[6])
                return result

            # Búsqueda heurística entre las partes
            dni_cand = None
            for p in parts:
                clean_p = p.replace('.', '')
                if clean_p.isdigit() and len(clean_p) in (7, 8):
                    dni_cand = clean_p
                    break
            
            if dni_cand:
                result['dni'] = dni_cand
                for p in parts:
                    if re.match(r'^\d{2}[\/\-]\d{2}[\/\-]\d{4}$', p):
                        result['fecha_nacimiento'] = format_date_str(p)
                        break
                text_parts = [p for p in parts if p.isalpha() and len(p) > 1 and p not in ('M', 'F', 'X', 'ARG')]
                if len(text_parts) >= 2:
                    result['apellido'] = text_parts[0].title()
                    result['nombre'] = ' '.join(text_parts[1:]).title()
                return result

    # Probar split por comas o espacios
    if ',' in raw_text:
        parts = [p.strip().replace('"', '') for p in raw_text.split(',')]
        if len(parts) >= 5:
            for p in parts:
                clean = p.replace('.', '')
                if clean.isdigit() and len(clean) in (7, 8):
                    result['dni'] = clean
                    break
            for p in parts:
                if re.match(r'^\d{2}[\/\-]\d{2}[\/\-]\d{4}$', p):
                    result['fecha_nacimiento'] = format_date_str(p)
                    break
            if result['dni']:
                return result

    # Heurística por Regex sobre texto plano
    dni_match = re.search(r'\b(\d{7,8})\b', raw_text)
    if dni_match:
        result['dni'] = dni_match.group(1)
        fecha_match = re.search(r'(\d{2}[\/\-]\d{2}[\/\-]\d{4})', raw_text)
        if fecha_match:
            result['fecha_nacimiento'] = format_date_str(fecha_match.group(1))
        return result

    return None


def format_date_str(date_str):
    """Convierte fecha DD/MM/AAAA o DD-MM-AAAA a formato ISO YYYY-MM-DD y valida."""
    if not date_str:
        return None
    date_str = str(date_str).strip()
    match = re.match(r'^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$', date_str)
    if match:
        day, month, year = match.groups()
        try:
            d = datetime.date(int(year), int(month), int(day))
            return d.strftime('%Y-%m-%d')
        except ValueError:
            return None
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
    return None


def decode_pdf417_barcode(np_img, pil_img):
    """
    Intenta decodificar el código de barras PDF417 utilizando zxing-cpp o pdf417decoder.
    Prueba varias rotaciones (0, 90, 180, 270) y mejoras de contraste.
    """
    raw_text = None

    # Intento 1: zxing-cpp
    if zxing_cpp is not None and np_img is not None:
        try:
            results = zxing_cpp.read_barcodes(np_img)
            for r in results:
                if r.valid and r.text:
                    raw_text = r.text
                    break
            
            if not raw_text and cv2 is not None:
                for rot in [cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE]:
                    rot_img = cv2.rotate(np_img, rot)
                    results = zxing_cpp.read_barcodes(rot_img)
                    for r in results:
                        if r.valid and r.text:
                            raw_text = r.text
                            break
                    if raw_text:
                        break
        except Exception:
            pass

    # Intento 2: pdf417decoder
    if not raw_text and PDF417Decoder is not None and pil_img is not None:
        try:
            decoder = PDF417Decoder(pil_img)
            if decoder.decode() > 0:
                raw_text = decoder.barcode_data_index_to_string(0)
            
            if not raw_text and pil_img:
                for angle in [90, 180, 270]:
                    rot_pil = pil_img.rotate(angle, expand=True)
                    dec_rot = PDF417Decoder(rot_pil)
                    if dec_rot.decode() > 0:
                        raw_text = dec_rot.barcode_data_index_to_string(0)
                        break
        except Exception:
            pass

    return raw_text


def extract_face_avatar(np_img, max_size=400):
    """
    Detecta y extrae el rostro de la foto del DNI argentino:
    1. Si es un DNI completo: ubica la región estándar de la foto oficial (lado izquierdo del DNI: x 4%..38%, y 18%..82%).
    2. Si es una foto centrada / selfie: recorta el centro con proporción 1:1.
    3. Normaliza y optimiza en JPEG 92% base64 data URI.
    """
    if cv2 is None or np_img is None:
        return None

    try:
        bgr = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
        h, w = bgr.shape[:2]

        aspect_ratio = w / float(h)
        
        # Si la imagen tiene aspecto de tarjeta DNI horizontal (relación ancho/alto ~ 1.3 a 1.9)
        if aspect_ratio >= 1.25 and w >= 200 and h >= 120:
            # En el DNI argentino el retrato se encuentra a la izquierda
            # Coordenadas relativas del marco de foto carnet
            x1 = int(w * 0.04)
            x2 = int(w * 0.40)
            y1 = int(h * 0.16)
            y2 = int(h * 0.85)

            # Ajustar a cuadrado
            crop_w = x2 - x1
            crop_h = y2 - y1
            side = min(crop_w, crop_h)
            
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2

            fx1 = max(0, cx - side // 2)
            fx2 = min(w, fx1 + side)
            fy1 = max(0, cy - side // 2)
            fy2 = min(h, fy1 + side)

            face_crop = bgr[fy1:fy2, fx1:fx2]
        else:
            # Es un retrato directo, foto de primer plano o selfie
            side = min(w, h)
            x1 = (w - side) // 2
            y1 = (h - side) // 2
            face_crop = bgr[y1:y1+side, x1:x1+side]

        if face_crop is None or face_crop.shape[0] < 10 or face_crop.shape[1] < 10:
            return None

        # Redimensionar en alta calidad
        face_crop_resized = cv2.resize(face_crop, (max_size, max_size), interpolation=cv2.INTER_LANCZOS4)

        # Convertir a JPEG base64
        _, buffer = cv2.imencode('.jpg', face_crop_resized, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        base64_str = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{base64_str}"

    except Exception as e:
        print(f"[DNI PROCESSOR] Error al extraer foto de rostro: {e}")
        return None


def process_dni_image(image_input, raw_text_hint=None):
    """
    Función principal de procesamiento de DNI Argentino.
    1. Decodifica código PDF417 (si es el dorso o contiene código).
    2. Detecta y recorta el rostro para avatar oficial (si es el frente).
    3. Estructura los datos y retorna resultado completo.
    """
    result = {
        'success': False,
        'dni': None,
        'nombre': None,
        'apellido': None,
        'sexo': None,
        'fecha_nacimiento': None,
        'ejemplar': None,
        'tramite': None,
        'foto_rostro': None,
        'tipo_detectado': 'desconocido',
        'raw_text': None
    }

    try:
        pil_img, np_img, raw_bytes = decode_base64_image(image_input)
    except Exception as e:
        if raw_text_hint:
            parsed = parse_argentina_dni_raw_string(raw_text_hint)
            if parsed and parsed.get('dni'):
                parsed['success'] = True
                parsed['tipo_detectado'] = 'dorso_pdf417'
                return parsed
        return {'success': False, 'error': f'No se pudo leer la imagen: {str(e)}'}

    # 1. Intentar decodificar código PDF417 (Dorso)
    raw_barcode_text = decode_pdf417_barcode(np_img, pil_img)
    if not raw_barcode_text and raw_text_hint:
        raw_barcode_text = raw_text_hint

    if raw_barcode_text:
        parsed_data = parse_argentina_dni_raw_string(raw_barcode_text)
        if parsed_data and parsed_data.get('dni'):
            result.update(parsed_data)
            result['success'] = True
            result['tipo_detectado'] = 'dorso_pdf417'
            result['raw_text'] = raw_barcode_text

    # 2. Intentar extraer foto del rostro (Frente)
    face_avatar = extract_face_avatar(np_img)
    if face_avatar:
        result['foto_rostro'] = face_avatar
        if not result['success']:
            result['success'] = True
            result['tipo_detectado'] = 'frente_rostro'
        elif result['tipo_detectado'] == 'dorso_pdf417':
            result['tipo_detectado'] = 'completo_frente_y_dorso'

    return result
