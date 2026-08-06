-- ============================================================
-- SISTEMA DE TRAMITES DE LICENCIAS DE CONDUCIR - BARADERO
-- Base de datos SQLite
-- ============================================================


-- ============================================================
-- TABLA: usuarios (login por DNI, sin duplicados)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  dni           TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL DEFAULT '',
  apellido      TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  email         TEXT DEFAULT '',
  telefono      TEXT DEFAULT '',
  fecha_nacimiento TEXT DEFAULT NULL,
  direccion     TEXT DEFAULT '',
  dni_frente    TEXT DEFAULT NULL,
  dni_dorso     TEXT DEFAULT NULL,
  foto_rostro   TEXT DEFAULT NULL,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  updated_at    TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: admins (panel de administracion, login por usuario+pass)
-- Roles: pagos, salud, turnos
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario       TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  rol           TEXT NOT NULL,
  activo        INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: licencias (credenciales digitales emitidas)
-- ============================================================
CREATE TABLE IF NOT EXISTS licencias (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL,
  tramite_id        INTEGER NOT NULL,
  numero_licencia   TEXT NOT NULL,
  categoria         TEXT NOT NULL DEFAULT 'B1',
  jurisdiccion      TEXT NOT NULL DEFAULT 'Provincia de Buenos Aires - Baradero',
  fecha_emision     TEXT NOT NULL,
  fecha_vencimiento TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'vigente',
  foto_rostro       TEXT DEFAULT NULL,
  qr_code_data      TEXT DEFAULT NULL,
  created_at        TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: tramites (un tramite por usuario, controla el flujo)
-- ============================================================
CREATE TABLE IF NOT EXISTS tramites (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id      INTEGER NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'nueva',
  paso_actual     TEXT NOT NULL DEFAULT 'charlas',
  estado          TEXT NOT NULL DEFAULT 'en_progreso',
  created_at      TEXT DEFAULT (datetime('now','localtime')),
  updated_at      TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);


-- ============================================================
-- TABLA: videos (charlas de seguridad vial)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT NOT NULL,
  descripcion TEXT,
  url_video   TEXT NOT NULL,
  duracion    TEXT DEFAULT '10 min',
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: videos_vistos (registro de videos vistos por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos_vistos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id  INTEGER NOT NULL,
  video_id    INTEGER NOT NULL,
  visto       INTEGER DEFAULT 1,
  fecha_visto TEXT DEFAULT (datetime('now','localtime')),
  UNIQUE(tramite_id, video_id),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: preguntas_examen
-- ============================================================
CREATE TABLE IF NOT EXISTS preguntas_examen (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  pregunta        TEXT NOT NULL,
  opcion_a        TEXT NOT NULL,
  opcion_b        TEXT NOT NULL,
  opcion_c        TEXT NOT NULL,
  opcion_d        TEXT NOT NULL,
  respuesta_correcta TEXT NOT NULL,
  activo          INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: examenes_teoricos (resultado del examen por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS examenes_teoricos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id      INTEGER NOT NULL,
  respuestas      TEXT DEFAULT NULL,
  puntaje         INTEGER DEFAULT 0,
  total_preguntas INTEGER DEFAULT 0,
  aprobado        INTEGER DEFAULT 0,
  fecha_examen    TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: formularios_salud
-- ============================================================
CREATE TABLE IF NOT EXISTS formularios_salud (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id          INTEGER NOT NULL,
  grupo_sanguineo     TEXT NOT NULL,
  usa_lentes          TEXT NOT NULL,
  enfermedad_cronica  TEXT DEFAULT 'Ninguna',
  medicacion          TEXT DEFAULT 'Ninguna',
  contacto_emergencia TEXT NOT NULL,
  telefono_emergencia TEXT NOT NULL,
  certificado_archivo TEXT DEFAULT NULL,
  estado              TEXT DEFAULT 'pendiente',
  observaciones_admin TEXT,
  fecha_envio         TEXT DEFAULT (datetime('now','localtime')),
  fecha_revision      TEXT DEFAULT NULL,
  admin_id            INTEGER DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id        INTEGER NOT NULL,
  metodo            TEXT NOT NULL,
  monto             REAL NOT NULL DEFAULT 12500.00,
  comprobante       TEXT DEFAULT NULL,
  numero_tarjeta    TEXT DEFAULT NULL,
  nombre_titular    TEXT DEFAULT NULL,
  estado            TEXT DEFAULT 'pendiente',
  observaciones_admin TEXT,
  fecha_pago        TEXT DEFAULT (datetime('now','localtime')),
  fecha_revision    TEXT DEFAULT NULL,
  admin_id          INTEGER DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: turnos_practico
-- ============================================================
CREATE TABLE IF NOT EXISTS turnos_practico (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha           TEXT NOT NULL,
  horario         TEXT NOT NULL,
  ubicacion       TEXT NOT NULL DEFAULT 'Circuito Municipal de Baradero',
  cupo_maximo     INTEGER DEFAULT 10,
  cupo_actual     INTEGER DEFAULT 0,
  activo          INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: reservas_turno (reservas de turnos por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS reservas_turno (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id      INTEGER NOT NULL,
  turno_id        INTEGER NOT NULL,
  estado          TEXT DEFAULT 'reservado',
  resultado_examen TEXT DEFAULT 'pendiente',
  observaciones_admin TEXT,
  fecha_reserva   TEXT DEFAULT (datetime('now','localtime')),
  fecha_revision  TEXT DEFAULT NULL,
  admin_id        INTEGER DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (turno_id) REFERENCES turnos_practico(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: entregas (metodo de entrega de licencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id      INTEGER NOT NULL,
  metodo          TEXT NOT NULL,
  direccion       TEXT DEFAULT '',
  estado          TEXT DEFAULT 'pendiente',
  fecha_solicitud TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);


-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Admins (passwords: admin123 - se actualizan al iniciar app.py)
INSERT INTO admins (usuario, password_hash, nombre, rol) VALUES
('admin_pagos', 'PENDING_HASH', 'Admin Pagos', 'pagos'),
('admin_salud', 'PENDING_HASH', 'Admin Salud', 'salud'),
('admin_turnos', 'PENDING_HASH', 'Admin Turnos', 'turnos');

-- Videos de seguridad vial
INSERT INTO videos (titulo, descripcion, url_video, duracion, orden) VALUES
('Señales de tránsito y su importancia', 'Aprendé sobre las señales de tránsito más importantes y cómo interpretarlas correctamente.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '12 min', 1),
('Conducción responsable y alcohol cero', 'La importancia de no consumir alcohol al conducir y las consecuencias legales.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '10 min', 2),
('Primeros auxilios en accidentes viales', 'Procedimientos básicos de primeros auxilios en caso de accidente de tránsito.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '15 min', 3),
('Normativa vigente en la Provincia de Buenos Aires', 'Conocé las leyes y regulaciones de tránsito vigentes en la provincia.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '8 min', 4);

-- Preguntas del examen teórico (10 preguntas, se eligen 5 al azar)
INSERT INTO preguntas_examen (pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
('¿Qué indica una luz amarilla de semáforo?', 'Acelerar para pasar', 'Precaución, detenerse si es posible', 'Vía libre', 'Girar a la derecha', 'b'),
('¿Cuál es el límite de velocidad en zona urbana?', '60 km/h', '40 km/h', '80 km/h', '30 km/h', 'b'),
('¿Qué documento es obligatorio llevar al conducir?', 'Partida de nacimiento', 'Licencia de conducir vigente', 'Título del auto', 'Boleta de impuestos', 'b'),
('¿Qué significa una señal de PARE?', 'Disminuir velocidad', 'Detenerse completamente', 'Ceder el paso', 'Estacionar', 'b'),
('¿Cuándo se debe usar el cinturón de seguridad?', 'Solo en ruta', 'Solo el conductor', 'Siempre todos los ocupantes', 'Solo de noche', 'c'),
('¿A qué distancia mínima se debe estacionar de una esquina?', '5 metros', '10 metros', '3 metros', '15 metros', 'b'),
('¿Qué se debe hacer ante un paso a nivel sin barreras?', 'Pasar rápidamente', 'Detenerse, mirar y escuchar', 'Tocar bocina y pasar', 'Pasar si no hay tren visible', 'b'),
('¿Cuál es la tasa de alcohol permitida para conductores particulares?', '0.5 g/l', '0.2 g/l', '0.0 g/l', '1.0 g/l', 'a'),
('¿Quién tiene prioridad en una rotonda?', 'El que entra', 'El que ya está circulando', 'El vehículo más grande', 'El que viene por la derecha', 'b'),
('¿Qué indica una línea amarilla continua en el centro de la calzada?', 'Se puede adelantar', 'Prohibido adelantar', 'Zona de estacionamiento', 'Carril exclusivo', 'b');

-- Turnos para examen práctico (fechas futuras)
INSERT INTO turnos_practico (fecha, horario, ubicacion, cupo_maximo) VALUES
('Lunes 11/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
('Miércoles 13/08/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10),
('Viernes 15/08/2026', '14:00 hs', 'Circuito Municipal de Baradero', 10),
('Lunes 18/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
('Miércoles 20/08/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10),
('Lunes 25/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
('Miércoles 27/08/2026', '14:00 hs', 'Circuito Municipal de Baradero', 10),
('Lunes 01/09/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10);
