-- ============================================================
-- SISTEMA DE TRAMITES DE LICENCIAS DE CONDUCIR - BARADERO
-- Base de datos MySQL
-- ============================================================


-- ============================================================
-- TABLA: usuarios (login por DNI, sin duplicados)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
<<<<<<< HEAD
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dni           VARCHAR(50) NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL DEFAULT '',
  apellido      VARCHAR(100) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL DEFAULT '',
  email         VARCHAR(255) DEFAULT '',
  telefono      VARCHAR(50) DEFAULT '',
  fecha_nacimiento VARCHAR(50) DEFAULT NULL,
  direccion     TEXT,
  dni_frente    TEXT,
  dni_dorso     TEXT,
  foto_rostro   TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
=======
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
  tiene_cud     INTEGER DEFAULT 0,
  numero_cud    TEXT DEFAULT '',
  estado_cuenta TEXT DEFAULT 'pendiente', -- 'pendiente', 'aprobada', 'rechazada_multas', 'papelera'
  multas_cantidad INTEGER DEFAULT 0,
  multas_monto REAL DEFAULT 0.0,
  multas_motivo TEXT DEFAULT '',
  multas_fecha_revision TEXT DEFAULT NULL,
  bienvenida_mostrada INTEGER DEFAULT 0,
  infracciones_pagadas_solicitadas INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now','localtime')),
  updated_at    TEXT DEFAULT (datetime('now','localtime'))
>>>>>>> 68c55a60f7d0f4cd25d39b182726459d7a1587b2
);

-- ============================================================
-- TABLA: admins (panel de administracion, login por usuario+pass)
-- Roles: pagos, salud, turnos, profesores
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  rol           VARCHAR(50) NOT NULL,
  activo        TINYINT DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: tramites (un tramite por usuario, controla el flujo)
-- ============================================================
CREATE TABLE IF NOT EXISTS tramites (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL,
  tipo            VARCHAR(50) NOT NULL DEFAULT 'nueva',
  paso_actual     VARCHAR(50) NOT NULL DEFAULT 'charlas',
  estado          VARCHAR(50) NOT NULL DEFAULT 'en_progreso',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: licencias (credenciales digitales emitidas)
-- ============================================================
CREATE TABLE IF NOT EXISTS licencias (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id        INT NOT NULL,
  tramite_id        INT NOT NULL,
  numero_licencia   VARCHAR(100) NOT NULL,
  categoria         VARCHAR(20) NOT NULL DEFAULT 'B1',
  jurisdiccion      VARCHAR(255) NOT NULL DEFAULT 'Provincia de Buenos Aires - Baradero',
  fecha_emision     VARCHAR(50) NOT NULL,
  fecha_vencimiento VARCHAR(50) NOT NULL,
  estado            VARCHAR(50) NOT NULL DEFAULT 'vigente',
  foto_rostro       TEXT,
  qr_code_data      TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: videos (charlas de seguridad vial)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(255) NOT NULL,
  descripcion TEXT,
  url_video   VARCHAR(255) NOT NULL,
  duracion    VARCHAR(50) DEFAULT '10 min',
  orden       INT NOT NULL DEFAULT 0,
  activo      TINYINT DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: videos_vistos (registro de videos vistos por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos_vistos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id  INT NOT NULL,
  video_id    INT NOT NULL,
  visto       TINYINT DEFAULT 1,
  fecha_visto TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tramite_id, video_id),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: preguntas_examen
-- ============================================================
CREATE TABLE IF NOT EXISTS preguntas_examen (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pregunta        TEXT NOT NULL,
  opcion_a        TEXT NOT NULL,
  opcion_b        TEXT NOT NULL,
  opcion_c        TEXT NOT NULL,
  opcion_d        TEXT NOT NULL,
<<<<<<< HEAD
  respuesta_correcta VARCHAR(10) NOT NULL,
  activo          TINYINT DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
=======
  respuesta_correcta TEXT NOT NULL,
  es_plantilla    INTEGER DEFAULT 1,
  profesor_id     INTEGER DEFAULT NULL,
  activo          INTEGER DEFAULT 1,
  created_at      TEXT DEFAULT (datetime('now','localtime'))
>>>>>>> 68c55a60f7d0f4cd25d39b182726459d7a1587b2
);

-- ============================================================
-- TABLA: config_examen (configuración del profesor: plantilla, personalizado, hibrido)
-- ============================================================
CREATE TABLE IF NOT EXISTS config_examen (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  modo            TEXT NOT NULL DEFAULT 'plantilla', -- 'plantilla', 'personalizado', 'hibrido'
  cant_plantilla  INTEGER NOT NULL DEFAULT 3,
  cant_profesor   INTEGER NOT NULL DEFAULT 3,
  updated_at      TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: examenes_teoricos (resultado del examen por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS examenes_teoricos (
<<<<<<< HEAD
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  respuestas      TEXT,
  puntaje         INT DEFAULT 0,
  total_preguntas INT DEFAULT 0,
  aprobado        TINYINT DEFAULT 0,
  fecha_examen    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
=======
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id          INTEGER NOT NULL,
  respuestas          TEXT DEFAULT NULL,
  puntaje             INTEGER DEFAULT 0,
  total_preguntas     INTEGER DEFAULT 0,
  aprobado            INTEGER DEFAULT 0,
  fecha_examen        TEXT DEFAULT (datetime('now','localtime')),
  estado_revision     TEXT DEFAULT 'pendiente_revision',
  porcentaje_acierto  REAL DEFAULT 0,
  motivo_justificacion TEXT DEFAULT '',
  expulsado           INTEGER DEFAULT 0,
  motivo_expulsion    TEXT DEFAULT '',
  created_at          TEXT DEFAULT (datetime('now','localtime')),
>>>>>>> 6f76f9f210706d776aadebe1ca9ea1a0132ab0c2
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mensajes_profesor (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id        INTEGER NOT NULL,
  usuario_id        INTEGER NOT NULL,
  profesor_nombre   TEXT DEFAULT 'Profesor Evaluador',
  mensaje           TEXT NOT NULL,
  tipo              TEXT DEFAULT 'justificacion',
  created_at        TEXT DEFAULT (datetime('now','localtime'))
);

-- ============================================================
-- TABLA: formularios_salud
-- ============================================================
CREATE TABLE IF NOT EXISTS formularios_salud (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id          INT NOT NULL,
  grupo_sanguineo     VARCHAR(20) NOT NULL,
  usa_lentes          VARCHAR(20) NOT NULL,
  enfermedad_cronica  TEXT,
  medicacion          TEXT,
  contacto_emergencia VARCHAR(100) NOT NULL,
  telefono_emergencia VARCHAR(50) NOT NULL,
  certificado_archivo TEXT,
  estado              VARCHAR(50) DEFAULT 'pendiente',
  observaciones_admin TEXT,
  fecha_envio         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_revision      TIMESTAMP NULL DEFAULT NULL,
  admin_id            INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id        INT NOT NULL,
  metodo            VARCHAR(50) NOT NULL,
  monto             DECIMAL(10,2) NOT NULL DEFAULT 12500.00,
  comprobante       TEXT,
  numero_tarjeta    VARCHAR(50),
  nombre_titular    VARCHAR(100),
  estado            VARCHAR(50) DEFAULT 'pendiente',
  observaciones_admin TEXT,
  fecha_pago        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_revision    TIMESTAMP NULL DEFAULT NULL,
  admin_id          INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: turnos_practico
-- ============================================================
CREATE TABLE IF NOT EXISTS turnos_practico (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  fecha           VARCHAR(50) NOT NULL,
  horario         VARCHAR(50) NOT NULL,
  ubicacion       VARCHAR(255) NOT NULL DEFAULT 'Circuito Municipal de Baradero',
  cupo_maximo     INT DEFAULT 10,
  cupo_actual     INT DEFAULT 0,
  activo          TINYINT DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- TABLA: reservas_turno (reservas de turnos por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS reservas_turno (
<<<<<<< HEAD
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  turno_id        INT NOT NULL,
  estado          VARCHAR(50) DEFAULT 'reservado',
  resultado_examen VARCHAR(50) DEFAULT 'pendiente',
=======
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tramite_id      INTEGER NOT NULL,
  turno_id        INTEGER NOT NULL,
  estado          TEXT DEFAULT 'reservado',
  resultado_examen TEXT DEFAULT 'pendiente',
  huella_tomada   INTEGER DEFAULT 0,
  foto_tomada     INTEGER DEFAULT 0,
>>>>>>> 68c55a60f7d0f4cd25d39b182726459d7a1587b2
  observaciones_admin TEXT,
  fecha_reserva   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_revision  TIMESTAMP NULL DEFAULT NULL,
  admin_id        INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (turno_id) REFERENCES turnos_practico(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLA: entregas (metodo de entrega de licencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  metodo          VARCHAR(50) NOT NULL,
  direccion       TEXT,
  estado          VARCHAR(50) DEFAULT 'pendiente',
  fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: inbox_cuentas (mensajes y comprobantes de multas entre usuario y admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS inbox_cuentas (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL,
  admin_id          INTEGER DEFAULT NULL,
  emisor            TEXT NOT NULL, -- 'usuario' o 'admin'
  mensaje           TEXT NOT NULL,
  adjunto_url       TEXT DEFAULT NULL,
  adjunto_nombre    TEXT DEFAULT NULL,
  leido             INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);


-- ============================================================
-- TABLA: user_activity_log (memoria de interacciones del usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT DEFAULT NULL,
  created_at  TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLA: user_preferences (preferencias persistentes del usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL UNIQUE,
  theme             TEXT DEFAULT 'light',
  last_page         TEXT DEFAULT 'dashboard',
  sidebar_collapsed INTEGER DEFAULT 0,
  updated_at        TEXT DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);


-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Admins (passwords: admin123 - se actualizan al iniciar app.py)
<<<<<<< HEAD
INSERT IGNORE INTO admins (usuario, password_hash, nombre, rol) VALUES
=======
INSERT INTO admins (usuario, password_hash, nombre, rol) VALUES
('admin_cuentas', 'PENDING_HASH', 'Admin Cuentas e Infracciones', 'cuentas'),
>>>>>>> 6f76f9f210706d776aadebe1ca9ea1a0132ab0c2
('admin_pagos', 'PENDING_HASH', 'Admin Pagos', 'pagos'),
('admin_salud', 'PENDING_HASH', 'Admin Salud', 'salud'),
('admin_turnos', 'PENDING_HASH', 'Admin Turnos', 'turnos'),
('admin_profesores', 'PENDING_HASH', 'Profesor Admin', 'profesores');

-- Configuración inicial del examen
INSERT OR IGNORE INTO config_examen (id, modo, cant_plantilla, cant_profesor) VALUES (1, 'plantilla', 3, 3);

-- Videos de seguridad vial
INSERT IGNORE INTO videos (id, titulo, descripcion, url_video, duracion, orden) VALUES
(1, 'Señales de tránsito y su importancia', 'Aprendé sobre las señales de tránsito más importantes y cómo interpretarlas correctamente.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '12 min', 1),
(2, 'Conducción responsable y alcohol cero', 'La importancia de no consumir alcohol al conducir y las consecuencias legales.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '10 min', 2),
(3, 'Primeros auxilios en accidentes viales', 'Procedimientos básicos de primeros auxilios en caso de accidente de tránsito.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '15 min', 3),
(4, 'Normativa vigente en la Provincia de Buenos Aires', 'Conocé las leyes y regulaciones de tránsito vigentes en la provincia.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '8 min', 4);

<<<<<<< HEAD
-- Preguntas del examen teórico
INSERT IGNORE INTO preguntas_examen (id, pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta) VALUES
(1, '¿Qué indica una luz amarilla de semáforo?', 'Acelerar para pasar', 'Precaución, detenerse si es posible', 'Vía libre', 'Girar a la derecha', 'b'),
(2, '¿Cuál es el límite de velocidad en zona urbana?', '60 km/h', '40 km/h', '80 km/h', '30 km/h', 'b'),
(3, '¿Qué documento es obligatorio llevar al conducir?', 'Partida de nacimiento', 'Licencia de conducir vigente', 'Título del auto', 'Boleta de impuestos', 'b'),
(4, '¿Qué significa una señal de PARE?', 'Disminuir velocidad', 'Detenerse completamente', 'Ceder el paso', 'Estacionar', 'b'),
(5, '¿Cuándo se debe usar el cinturón de seguridad?', 'Solo en ruta', 'Solo el conductor', 'Siempre todos los ocupantes', 'Solo de noche', 'c'),
(6, '¿A qué distancia mínima se debe estacionar de una esquina?', '5 metros', '10 metros', '3 metros', '15 metros', 'b'),
(7, '¿Qué se debe hacer ante un paso a nivel sin barreras?', 'Pasar rápidamente', 'Detenerse, mirar y escuchar', 'Tocar bocina y pasar', 'Pasar si no hay tren visible', 'b'),
(8, '¿Cuál es la tasa de alcohol permitida para conductores particulares?', '0.5 g/l', '0.2 g/l', '0.0 g/l', '1.0 g/l', 'a'),
(9, '¿Quién tiene prioridad en una rotonda?', 'El que entra', 'El que ya está circulando', 'El vehículo más grande', 'El que viene por la derecha', 'b'),
(10, '¿Qué indica una línea amarilla continua en el centro de la calzada?', 'Se puede adelantar', 'Prohibido adelantar', 'Zona de estacionamiento', 'Carril exclusivo', 'b');

-- Turnos para examen práctico
INSERT IGNORE INTO turnos_practico (id, fecha, horario, ubicacion, cupo_maximo) VALUES
(1, 'Lunes 11/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
(2, 'Miércoles 13/08/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10),
(3, 'Viernes 15/08/2026', '14:00 hs', 'Circuito Municipal de Baradero', 10),
(4, 'Lunes 18/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
(5, 'Miércoles 20/08/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10),
(6, 'Lunes 25/08/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
(7, 'Miércoles 27/08/2026', '14:00 hs', 'Circuito Municipal de Baradero', 10),
(8, 'Lunes 01/09/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10);

=======
-- Preguntas del examen teórico (10 preguntas, se eligen según modo)
INSERT INTO preguntas_examen (pregunta, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, es_plantilla) VALUES
('¿Qué indica una luz amarilla de semáforo?', 'Acelerar para pasar', 'Precaución, detenerse si es posible', 'Vía libre', 'Girar a la derecha', 'b', 1),
('¿Cuál es el límite de velocidad en zona urbana?', '60 km/h', '40 km/h', '80 km/h', '30 km/h', 'b', 1),
('¿Qué documento es obligatorio llevar al conducir?', 'Partida de nacimiento', 'Licencia de conducir vigente', 'Título del auto', 'Boleta de impuestos', 'b', 1),
('¿Qué significa una señal de PARE?', 'Disminuir velocidad', 'Detenerse completamente', 'Ceder el paso', 'Estacionar', 'b', 1),
('¿Cuándo se debe usar el cinturón de seguridad?', 'Solo en ruta', 'Solo el conductor', 'Siempre todos los ocupantes', 'Solo de noche', 'c', 1),
('¿A qué distancia mínima se debe estacionar de una esquina?', '5 metros', '10 metros', '3 metros', '15 metros', 'b', 1),
('¿Qué se debe hacer ante un paso a nivel sin barreras?', 'Pasar rápidamente', 'Detenerse, mirar y escuchar', 'Tocar bocina y pasar', 'Pasar si no hay tren visible', 'b', 1),
('¿Cuál es la tasa de alcohol permitida para conductores particulares?', '0.5 g/l', '0.2 g/l', '0.0 g/l', '1.0 g/l', 'a', 1),
('¿Quién tiene prioridad en una rotonda?', 'El que entra', 'El que ya está circulando', 'El vehículo más grande', 'El que viene por la derecha', 'b', 1),
('¿Qué indica una línea amarilla continua en el centro de la calzada?', 'Se puede adelantar', 'Prohibido adelantar', 'Zona de estacionamiento', 'Carril exclusivo', 'b', 1);

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

>>>>>>> 68c55a60f7d0f4cd25d39b182726459d7a1587b2
