# Principios de Diseño y Desarrollo — SUBI Baradero

## 1. Validación de Identidad, Escáner de DNI y Prevención de Fraudes
- **Escáner Óptico de DNI (PDF417 / OCR):**
  - Permite capturar con cámara o adjuntar foto del DNI (frente/dorso).
  - Extrae y valida datos oficiales: Apellido, Nombre, N° de DNI, Sexo, Trámite N°, Fecha de Nacimiento y Domicilio.
  - **Autocompletado en el Registro:** Precarga automáticamente los campos del formulario de registro en `login.html`, permitiendo al usuario corregir o actualizar su domicilio real en Baradero antes de crear la cuenta.
  - **Foto de Perfil Vinculada al DNI:** La foto del documento queda vinculada al perfil del vecino para evitar suplantaciones de identidad y fraudes.
- **Actualización y Biometría en Mi Legajo / Perfil:**
  - Panel de configuración en `legajo.html` para actualizar la foto del DNI y realizar validación biométrica facial opcional.
- **Validación de CUD (Certificado Único de Discapacidad):**
  - Verificación del número de CUD para habilitar automáticamente beneficios en pasajes y trámites especiales.

## 2. Metodología SDD (Spec-Driven Development), TDD y Autocorrección Rigurosa
- Todo cambio se rige estrictamente por la especificación del plan maestro.
- Ante cualquier error en tests o en la interfaz, se investiga la causa raíz y se reescribe limpiamente sin acumular parches provisionales hasta lograr un funcionamiento 100% perfecto.

## 3. Principio de "Una Sola Vez" y Autocompletado Universal
- Todo formulario de trámites (`formulario-tramites-ambientales.html`, `punto-de-ramas.html`, `reserva-parque-del-este.html`, `atencion147.html`, etc.) autocompleta los datos del ciudadano desde `getUserData()`.

## 4. Preservación del Panel General de Login
- Estructura, ondas de fondo de Baradero, tarjeta y distribución intactas en `login.html`.
- Mejoras focalizadas exclusivamente en:
  1. Modal de ingreso de código 2FA (6 dígitos con auto-focus y temporizador).
  2. Modal de recuperación de contraseña y flujo en `reset-password.html`.
  3. Integración operativa del Escáner de DNI con autocompletado en el registro.

## 5. Diseño Totalmente Adaptativo y Multiplataforma (Desktop, Tablet y Mobile)
- Experiencia de élite en monitores de escritorio (1080p/1440p+), tablets y teléfonos móviles (Mobile-First en trámites).

## 6. Seguimiento en Vivo del Trámite y Barra de Progreso (%)
- Barra de avance dinámico por etapas (25%, 50%, 75%, 100%) en Home y Legajo.
- Alertas claras de rechazo con motivo específico y botón de **"Subsanar Documentación"** para corregir en 1 clic.

## 7. Asistente Virtual / Chatbot IA & Soporte Técnico 147
- Tutorial interactivo guiado de bienvenida.
- Guía conversacional paso a paso para evitar equivocaciones en trámites.
- Canal directo a la Línea 147.

## 8. Reglas Estrictas de Estética e Iconografía (Anti-IA / Cero Trivialidades)
- **PROHIBIDO EL USO DE EMOJIS.**
- Uso exclusivo de iconos SVG vectoriales lineales profesionales (estilo Lucide / Heroicons).
- Lenguaje formal, sobrio y conciso.

## 9. Lenguaje Visual: Clean Minimalist (Azul Institucional & Slate)
- Paleta: Fondo `#f8fafc`/`#ffffff`, Cabecera `#0f172a`, Acentos `#0284c7`, Bordes `#e2e8f0`.
- Tipografía: `Inter` + `Plus Jakarta Sans`.

## 10. Verificacion sin Browser Automatico
- **NO** usar subagentes de browser para verificar paginas protegidas por login/2FA.
- Las verificaciones visuales las hace el usuario manualmente.
- Para verificar CSS/JS, usar revision de codigo o pedir al usuario que compare con las maquetas.

## 11. Fidelidad Estricta a Maquetas
- Cuando el usuario provee imagenes de referencia/maquetas, el resultado debe ser una **replica 1:1** adaptada a Baradero.
- No reinterpretar, no agregar elementos que no estan en la maqueta, no quitar elementos que si estan.
- Si una seccion de la maqueta no se puede replicar exactamente (falta asset, funcionalidad no disponible), usar placeholder y documentar que falta.

## 12. Assets Faltantes: Placeholder + Pedido Explicito
- Cuando falta una imagen, logo o asset visual, usar un **placeholder limpio** (SVG con color de fondo solido que matchee el design system).
- **NO** generar imagenes con IA como relleno definitivo.
- Documentar en un comentario HTML o en el walkthrough que assets faltan y el usuario los provee despues.
- Formatos de placeholder: `<div>` con background-color del design system + icono SVG centrado.
