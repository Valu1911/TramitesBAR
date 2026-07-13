-- ============================================================
-- SISTEMA DE TRAMITES DE LICENCIAS DE CONDUCIR - BARADERO
-- Base de datos MySQL para WAMP Server
-- ============================================================

CREATE DATABASE IF NOT EXISTS sistema_licencias
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sistema_licencias;

-- ============================================================
-- TABLA: usuarios (login por DNI, sin duplicados)
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  dni           VARCHAR(10) NOT NULL UNIQUE,
  nombre        VARCHAR(100) NOT NULL DEFAULT '',
  apellido      VARCHAR(100) NOT NULL DEFAULT '',
  email         VARCHAR(150) DEFAULT '',
  telefono      VARCHAR(30) DEFAULT '',
  fecha_nacimiento DATE DEFAULT NULL,
  direccion     VARCHAR(255) DEFAULT '',
  dni_frente    LONGTEXT DEFAULT NULL,
  dni_dorso     LONGTEXT DEFAULT NULL,
  foto_rostro   LONGTEXT DEFAULT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: admins (panel de administracion, login por usuario+pass)
-- Roles: pagos, salud, turnos
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario       VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nombre        VARCHAR(100) NOT NULL,
  rol           ENUM('pagos','salud','turnos') NOT NULL,
  activo        TINYINT(1) DEFAULT 1,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: tramites (un tramite por usuario, controla el flujo)
-- ============================================================
CREATE TABLE IF NOT EXISTS tramites (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL,
  tipo            ENUM('nueva','renovacion') NOT NULL DEFAULT 'nueva',
  paso_actual     ENUM('charlas','examen','formularios','pago','practico','entrega','finalizado') NOT NULL DEFAULT 'charlas',
  estado          ENUM('en_progreso','completado','cancelado') NOT NULL DEFAULT 'en_progreso',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: videos (charlas de seguridad vial)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(200) NOT NULL,
  descripcion TEXT DEFAULT '',
  url_video   VARCHAR(500) NOT NULL,
  duracion    VARCHAR(20) DEFAULT '10 min',
  orden       INT NOT NULL DEFAULT 0,
  activo      TINYINT(1) DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: videos_vistos (registro de videos vistos por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS videos_vistos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id  INT NOT NULL,
  video_id    INT NOT NULL,
  visto       TINYINT(1) DEFAULT 1,
  fecha_visto DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_tramite_video (tramite_id, video_id),
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: preguntas_examen
-- ============================================================
CREATE TABLE IF NOT EXISTS preguntas_examen (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  pregunta        TEXT NOT NULL,
  opcion_a        VARCHAR(255) NOT NULL,
  opcion_b        VARCHAR(255) NOT NULL,
  opcion_c        VARCHAR(255) NOT NULL,
  opcion_d        VARCHAR(255) NOT NULL,
  respuesta_correcta ENUM('a','b','c','d') NOT NULL,
  activo          TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: examenes_teoricos (resultado del examen por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS examenes_teoricos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  respuestas      JSON DEFAULT NULL,
  puntaje         INT DEFAULT 0,
  total_preguntas INT DEFAULT 0,
  aprobado        TINYINT(1) DEFAULT 0,
  fecha_examen    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: formularios_salud
-- ============================================================
CREATE TABLE IF NOT EXISTS formularios_salud (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id          INT NOT NULL,
  grupo_sanguineo     VARCHAR(10) NOT NULL,
  usa_lentes          VARCHAR(5) NOT NULL,
  enfermedad_cronica  VARCHAR(255) DEFAULT 'Ninguna',
  medicacion          VARCHAR(255) DEFAULT 'Ninguna',
  contacto_emergencia VARCHAR(100) NOT NULL,
  telefono_emergencia VARCHAR(30) NOT NULL,
  certificado_archivo LONGTEXT DEFAULT NULL,
  estado              ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
  observaciones_admin TEXT DEFAULT '',
  fecha_envio         DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_revision      DATETIME DEFAULT NULL,
  admin_id            INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: pagos
-- ============================================================
CREATE TABLE IF NOT EXISTS pagos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id        INT NOT NULL,
  metodo            ENUM('transferencia','debito') NOT NULL,
  monto             DECIMAL(10,2) NOT NULL DEFAULT 12500.00,
  comprobante       LONGTEXT DEFAULT NULL,
  numero_tarjeta    VARCHAR(20) DEFAULT NULL,
  nombre_titular    VARCHAR(100) DEFAULT NULL,
  estado            ENUM('pendiente','aprobado','rechazado') DEFAULT 'pendiente',
  observaciones_admin TEXT DEFAULT '',
  fecha_pago        DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_revision    DATETIME DEFAULT NULL,
  admin_id          INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: turnos_practico
-- ============================================================
CREATE TABLE IF NOT EXISTS turnos_practico (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  fecha           VARCHAR(100) NOT NULL,
  horario         VARCHAR(20) NOT NULL,
  ubicacion       VARCHAR(255) NOT NULL DEFAULT 'Circuito Municipal de Baradero',
  cupo_maximo     INT DEFAULT 10,
  cupo_actual     INT DEFAULT 0,
  activo          TINYINT(1) DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: reservas_turno (reservas de turnos por tramite)
-- ============================================================
CREATE TABLE IF NOT EXISTS reservas_turno (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  turno_id        INT NOT NULL,
  estado          ENUM('reservado','aprobado','rechazado','completado') DEFAULT 'reservado',
  resultado_examen ENUM('pendiente','aprobado','reprobado') DEFAULT 'pendiente',
  observaciones_admin TEXT DEFAULT '',
  fecha_reserva   DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_revision  DATETIME DEFAULT NULL,
  admin_id        INT DEFAULT NULL,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE,
  FOREIGN KEY (turno_id) REFERENCES turnos_practico(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TABLA: entregas (metodo de entrega de licencia)
-- ============================================================
CREATE TABLE IF NOT EXISTS entregas (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  tramite_id      INT NOT NULL,
  metodo          ENUM('domicilio','presencial') NOT NULL,
  direccion       VARCHAR(255) DEFAULT '',
  estado          ENUM('pendiente','en_camino','entregado') DEFAULT 'pendiente',
  fecha_solicitud DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tramite_id) REFERENCES tramites(id) ON DELETE CASCADE
) ENGINE=InnoDB;


-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Admins (passwords: admin123 hasheados con werkzeug)
-- Los passwords se actualizan automáticamente al iniciar app.py (admin123)
INSERT INTO admins (usuario, password_hash, nombre, rol) VALUES
('admin_pagos', 'PENDING_HASH', 'Admin Pagos', 'pagos'),
('admin_salud', 'PENDING_HASH', 'Admin Salud', 'salud'),
('admin_turnos', 'PENDING_HASH', 'Admin Turnos', 'turnos');

-- Videos de seguridad vial
INSERT INTO videos (titulo, descripcion, url_video, duracion, orden) VALUES
('Señales de tránsito y su importancia', 'Aprende sobre las señales de tránsito más importantes y cómo interpretarlas correctamente.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '12 min', 1),
('Conducción responsable y alcohol cero', 'La importancia de no consumir alcohol al conducir y las consecuencias legales.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '10 min', 2),
('Primeros auxilios en accidentes viales', 'Procedimientos básicos de primeros auxilios en caso de accidente de tránsito.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '15 min', 3),
('Normativa vigente en la Provincia de Buenos Aires', 'Conoce las leyes y regulaciones de tránsito vigentes en la provincia.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '8 min', 4);

-- Preguntas del examen teorico
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

-- Turnos para examen practico
INSERT INTO turnos_practico (fecha, horario, ubicacion, cupo_maximo) VALUES
('Lunes 21/07/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
('Miércoles 23/07/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10),
('Viernes 25/07/2026', '14:00 hs', 'Circuito Municipal de Baradero', 10),
('Lunes 28/07/2026', '09:00 hs', 'Circuito Municipal de Baradero', 10),
('Miércoles 30/07/2026', '10:30 hs', 'Circuito Municipal de Baradero', 10);
