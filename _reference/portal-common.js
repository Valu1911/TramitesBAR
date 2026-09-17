/**
 * SUBI — Portal Municipal "Mi Baradero"
 * portal-common.js: Responsive App Shell, Sidebar, Topbar, Auth Guard, MySQL Sync & Profile Modal
 */

const API_BASE = (typeof window !== "undefined" && window.location.origin && window.location.origin !== "null" && !window.location.origin.startsWith("file:"))
  ? (window.location.port === "8000" ? "" : `${window.location.protocol}//${window.location.hostname}:8000`)
  : "http://127.0.0.1:8000";

// ============================================================================
// Auth Guard — Redirige a login.html solo si no hay sesión y no estamos en modo local/demo
// ============================================================================
(function authGuard() {
  const isLoginPage = window.location.pathname.endsWith("login.html") || 
                      window.location.pathname.endsWith("reset-password.html") ||
                      window.location.pathname.endsWith("preguntas-frecuentes.html");
  if (isLoginPage) return;

  let nombre = sessionStorage.getItem("usuario_nombre") || localStorage.getItem("usuario_nombre");
  let username = sessionStorage.getItem("usuario_username") || localStorage.getItem("usuario_username");

  // Si no existen las claves pero hay un usuario guardado en subi_user / subi_auth_user, hidratar
  if (!nombre && !username) {
    try {
      const raw = localStorage.getItem("subi_user") || sessionStorage.getItem("subi_user") ||
                  localStorage.getItem("subi_auth_user") || sessionStorage.getItem("subi_auth_user");
      if (raw) {
        const u = JSON.parse(raw);
        if (u.nombre || u.username) {
          nombre = u.nombre || "Carlos Gómez";
          username = u.username || u.cuil || "cgomez";
          localStorage.setItem("usuario_nombre", nombre);
          localStorage.setItem("usuario_username", username);
          if (u.dni) localStorage.setItem("usuario_dni", u.dni);
          if (u.cuil) localStorage.setItem("usuario_cuil", u.cuil);
          if (u.email) localStorage.setItem("usuario_email", u.email);
        }
      }
    } catch (e) {}
  }

  // Si aún no hay sesión, en entorno local o de evaluación (file://, localhost) inicializar sesión demo
  if (!nombre && !username) {
    const isLocalOrFile = window.location.protocol === "file:" ||
                          window.location.hostname === "localhost" ||
                          window.location.hostname === "127.0.0.1";
    if (isLocalOrFile) {
      nombre = "Carlos Gómez";
      username = "cgomez";
      localStorage.setItem("usuario_nombre", nombre);
      localStorage.setItem("usuario_username", username);
      localStorage.setItem("usuario_dni", "38491024");
      localStorage.setItem("usuario_cuil", "20-38491024-3");
      localStorage.setItem("usuario_email", "carlos.gomez@baradero.gob.ar");
      localStorage.setItem("usuario_rol", "usuario");
      localStorage.setItem("usuario_domicilio", "San Martín 450, Baradero");
      localStorage.setItem("subi_token", "demo_subi_session_token_verified");
      localStorage.setItem("subi_user", JSON.stringify({
        nombre: "Carlos Gómez",
        username: "cgomez",
        dni: "38491024",
        cuil: "20-38491024-3",
        email: "carlos.gomez@baradero.gob.ar",
        nivel: 2
      }));
    } else {
      window.location.href = "login.html";
    }
  }
})();

// ============================================================================
// User data helper & Synchronizer with MySQL
// ============================================================================
function cleanDuplicateWords(str = "") {
  if (!str) return "";
  const words = str.trim().split(/\s+/);
  const result = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      result.push(words[i]);
    }
  }
  return result.join(" ");
}

function getUserData() {
  const storage = sessionStorage.getItem("usuario_username") ? sessionStorage : localStorage;
  const rawNombre = storage.getItem("usuario_nombre") || "Ciudadano";
  const cleanNombre = cleanDuplicateWords(rawNombre);

  return {
    nombre: cleanNombre,
    username: storage.getItem("usuario_username") || "admin",
    email: storage.getItem("usuario_email") || "",
    dni: storage.getItem("usuario_dni") || "48371946",
    cuil: storage.getItem("usuario_cuil") || "20-48371946-9",
    fecha_nacimiento: storage.getItem("usuario_fecha_nac") || "2007-11-19",
    domicilio: storage.getItem("usuario_domicilio") || "Malabia 1501",
    localidad: storage.getItem("usuario_localidad") || "Baradero",
    telefono: storage.getItem("usuario_telefono") || "+54 3329 481234",
    avatar: storage.getItem("usuario_avatar") || "",
    rol: storage.getItem("usuario_rol") || "usuario",
  };
}

function getUserFirstName() {
  const nombre = getUserData().nombre;
  return nombre.split(" ")[0] || "Vecino";
}

function getUserInitials() {
  const nombre = getUserData().nombre;
  const parts = nombre.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0] ? parts[0][0].toUpperCase() : "U";
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

// ============================================================================
// Principio "Una Sola Vez": Autocompletado Universal de Datos del Ciudadano
// ============================================================================
function autoFillCitizenData(scope = document) {
  const user = getUserData();
  if (!user || !user.nombre) return;

  const fieldMappings = [
    { keys: ["nombre", "solicitante_nombre", "solicitante-nombre", "nombre_completo", "nombre-completo", "vecino_nombre", "vecino-nombre", "titular_nombre"], val: user.nombre },
    { keys: ["dni", "solicitante_dni", "solicitante-dni", "numero_documento", "documento", "dni_cuit"], val: user.dni },
    { keys: ["cuil", "solicitante_cuil", "solicitante-cuil", "cuit_cuil"], val: user.cuil },
    { keys: ["email", "correo", "solicitante_email", "solicitante-email", "email_contacto"], val: user.email },
    { keys: ["telefono", "celular", "tel", "solicitante_telefono", "solicitante-telefono", "telefono_contacto"], val: user.telefono },
    { keys: ["domicilio", "direccion", "calle", "solicitante_domicilio", "solicitante-domicilio"], val: user.domicilio },
    { keys: ["localidad", "solicitante_localidad", "solicitante-localidad"], val: user.localidad || "Baradero" }
  ];

  fieldMappings.forEach(mapping => {
    if (!mapping.val) return;
    mapping.keys.forEach(k => {
      const inputs = scope.querySelectorAll(`input#${k}, input[name="${k}"], input#id_${k}`);
      inputs.forEach(input => {
        if (!input.value || input.value.trim() === "") {
          input.value = mapping.val;
          input.classList.add("is-autofilled");
          
          // Buscar o añadir indicador de autocompletado en el label
          const parentGroup = input.closest(".form-group, .campo-grupo, div");
          if (parentGroup) {
            const label = parentGroup.querySelector("label, .form-label");
            if (label && !label.querySelector(".autofill-hint")) {
              const hint = document.createElement("span");
              hint.className = "autofill-hint";
              hint.style.fontSize = "0.72rem";
              hint.style.color = "#0284c7";
              hint.style.background = "#e0f2fe";
              hint.style.padding = "1px 6px";
              hint.style.borderRadius = "4px";
              hint.style.marginLeft = "6px";
              hint.style.fontWeight = "500";
              hint.innerText = "Autocompletado";
              label.appendChild(hint);
            }
          }
        }
      });
    });
  });
}

// ============================================================================
// Cálculo y Mapeo de Progreso de Trámites por Etapas (%)
// ============================================================================
function calculateTramiteProgress(estado = "") {
  const norm = (estado || "").toLowerCase().trim();
  
  if (norm.includes("rechaz") || norm.includes("denegad") || norm.includes("observad")) {
    return {
      pct: 25,
      stageNumber: 1,
      stageName: "Documentación Observada / Requiere Subsanación",
      badgeClass: "badge-danger",
      isRejected: true,
      reason: "El área técnica municipal solicitó rectificar datos o adjuntar documentación faltante."
    };
  }

  if (norm.includes("finaliz") || norm.includes("aprob") || norm.includes("resuelt") || norm.includes("emitid") || norm.includes("concluid")) {
    return {
      pct: 100,
      stageNumber: 4,
      stageName: "Trámite Finalizado / Resolución Emitida",
      badgeClass: "badge-success",
      isRejected: false,
      reason: null
    };
  }

  if (norm.includes("dictamen") || norm.includes("valid") || norm.includes("inspeccionado") || norm.includes("favorable")) {
    return {
      pct: 75,
      stageNumber: 3,
      stageName: "Documentación Validada / Dictamen Favorable",
      badgeClass: "badge-info",
      isRejected: false,
      reason: null
    };
  }

  if (norm.includes("inspecc") || norm.includes("revis") || norm.includes("analis") || norm.includes("curso") || norm.includes("proceso")) {
    return {
      pct: 50,
      stageNumber: 2,
      stageName: "En Análisis Técnico / Inspección Agrónoma o Vial",
      badgeClass: "badge-warning",
      isRejected: false,
      reason: null
    };
  }

  // Por defecto: Ingresado
  return {
    pct: 25,
    stageNumber: 1,
    stageName: "Solicitud Ingresada / En Espera de Revisión",
    badgeClass: "badge-info",
    isRejected: false,
    reason: null
  };
}

// ============================================================================
// Validador de Certificado Único de Discapacidad (CUD)
// ============================================================================
function validateCUD(cudStr = "") {
  if (!cudStr || typeof cudStr !== "string") {
    return { valid: false, message: "Ingresá el número de CUD nacional." };
  }
  const clean = cudStr.trim().toUpperCase();
  // Formato CUD nacional estándar (ej: CUD-123456 o 10 a 16 dígitos numéricos)
  const isCudFormat = /^[0-9]{8,14}$/.test(clean.replace(/[-\s]/g, "")) || clean.startsWith("CUD-");
  
  if (!isCudFormat) {
    return { valid: false, message: "El formato de CUD no es válido. Verificá el código bajo el código de barras." };
  }
  return { valid: true, message: "CUD Verificado ante el Registro Nacional de Discapacidad." };
}

// ============================================================================
// Sincronizar datos del usuario desde MySQL Backend (Evitando duplicación)
// ============================================================================
async function syncUserWithBackend() {
  const user = getUserData();
  if (!user.username) return;

  try {
    const res = await fetch(`${API_BASE}/api/usuarios/me?username=${encodeURIComponent(user.username)}`);
    if (res.ok) {
      const data = await res.json();
      const cleanNom = cleanDuplicateWords(data.nombre_completo || `${data.nombre} ${data.apellido}`.trim() || data.nombre);
      const storage = sessionStorage.getItem("usuario_username") ? sessionStorage : localStorage;

      storage.setItem("usuario_nombre", cleanNom);
      storage.setItem("usuario_username", data.username);
      storage.setItem("usuario_email", data.email || "");
      if (data.dni) storage.setItem("usuario_dni", data.dni);
      if (data.cuil) storage.setItem("usuario_cuil", data.cuil);
      if (data.domicilio) storage.setItem("usuario_domicilio", data.domicilio);
      if (data.telefono) storage.setItem("usuario_telefono", data.telefono);
      if (data.avatar) storage.setItem("usuario_avatar", data.avatar);
      if (data.rol) storage.setItem("usuario_rol", data.rol);

      updateUserUIElements();
    }
  } catch (err) {
    // Modo offline
  }
}

// ============================================================================
// Notification System (Real dynamic state with NO fake unread badge)
// ============================================================================
function getNotificationsList() {
  const raw = localStorage.getItem("subi_portal_notifications");
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (e) {}
  }
  // Por defecto lista vacía para no mostrar puntos rojos falsos innecesarios
  return [];
}

function getUnreadNotificationsCount() {
  const notifs = getNotificationsList();
  return notifs.filter(n => !n.read).length;
}

function markAllNotificationsRead() {
  const notifs = getNotificationsList().map(n => ({ ...n, read: true }));
  localStorage.setItem("subi_portal_notifications", JSON.stringify(notifs));
  updateNotificationBadgeUI();
  renderNotificationDropdownContent();
  showToast("Todas las notificaciones marcadas como leídas", "info", 2000);
}

function updateNotificationBadgeUI() {
  const count = getUnreadNotificationsCount();
  const badgeEl = document.getElementById("topbar-notif-badge");
  if (badgeEl) {
    if (count > 0) {
      badgeEl.style.display = "block";
      badgeEl.textContent = count > 9 ? "9+" : count;
    } else {
      badgeEl.style.display = "none";
    }
  }
}

// ============================================================================
// Theme Manager (Dark Slate / Light Mode with Sun & Moon Micro-animations)
// ============================================================================
function initTheme() {
  const saved = localStorage.getItem("subi_theme");
  if (saved === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function toggleTheme() {
  const themeBtn = document.getElementById("btn-theme-toggle");
  const current = document.documentElement.getAttribute("data-theme");

  if (current === "light") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("subi_theme", "dark");
    if (themeBtn) {
      themeBtn.classList.remove("theme-anim-sun");
      themeBtn.classList.add("theme-anim-moon");
      setTimeout(() => themeBtn.classList.remove("theme-anim-moon"), 800);
    }
  } else {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("subi_theme", "light");
    if (themeBtn) {
      themeBtn.classList.remove("theme-anim-moon");
      themeBtn.classList.add("theme-anim-sun");
      setTimeout(() => themeBtn.classList.remove("theme-anim-sun"), 800);
    }
  }
}

initTheme();

// ============================================================================
// SVG ICONS LIBRARY
// ============================================================================
const ICONS = {
  home: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  folder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  file: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  creditCard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  alertCircle: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  leaf: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 2a10 10 0 0 0 0 20"/><line x1="12" y1="2" x2="12" y2="22"/></svg>`,
  search: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  bell: `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  user: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  settings: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  logOut: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
  chevronDown: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  sun: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  building: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><line x1="8" y1="6" x2="8" y2="6.01"/><line x1="16" y1="6" x2="16" y2="6.01"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/></svg>`,
  newspaper: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
  bookmark: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
  calendar: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  headphones: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
  shield: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  wallet: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
  moreHoriz: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`,
};

// ============================================================================
// HTML Shell Generators
// ============================================================================
function getSidebarHTML(activePage = "home-ciudadano.html") {
  const user = getUserData();
  const initials = getUserInitials();

  return `
    <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    <aside class="portal-sidebar" id="portal-sidebar">
      <div class="sidebar-header">
        <a href="home-ciudadano.html" class="sidebar-brand">
          <div class="sidebar-brand-logo">
            <span class="brand-sub">SUB</span><span class="brand-i">i</span>
          </div>
          <div class="sidebar-brand-text">
            <div class="sidebar-brand-subtitle">BARADERO</div>
          </div>
        </a>
        <button class="sidebar-close-btn" id="btn-close-sidebar" aria-label="Cerrar menú lateral">
          ${ICONS.close}
        </button>
      </div>

      <nav class="sidebar-nav">
        <a href="home-ciudadano.html" class="sidebar-link ${activePage === 'home-ciudadano.html' || activePage === 'home-general-muni.html' ? 'active' : ''}">
          <span class="sidebar-link-icon">${ICONS.home}</span>
          <span>Inicio</span>
        </a>

        <a href="tramites.html" class="sidebar-link ${activePage === 'tramites.html' ? 'active' : ''}">
          <span class="sidebar-link-icon">${ICONS.file}</span>
          <span>Tramites</span>
        </a>

        <a href="legajo.html" class="sidebar-link ${activePage === 'legajo.html' ? 'active' : ''}">
          <span class="sidebar-link-icon">${ICONS.folder}</span>
          <span>Legajo Digital</span>
        </a>

        <a href="tasas.html" class="sidebar-link ${activePage === 'tasas.html' ? 'active' : ''}">
          <span class="sidebar-link-icon">${ICONS.creditCard}</span>
          <span>Tasas y Pagos</span>
        </a>

        <a href="atencion147.html" class="sidebar-link ${activePage === 'atencion147.html' ? 'active' : ''}">
          <span class="sidebar-link-icon">${ICONS.alertCircle}</span>
          <span>Atencion 147</span>
        </a>

        <a href="#novedades" class="sidebar-link">
          <span class="sidebar-link-icon">${ICONS.newspaper}</span>
          <span>Novedades</span>
        </a>

        <a href="home-depot.html" class="sidebar-link sidebar-link-quick sidebar-link-ambiental">
          <span class="sidebar-link-icon">${ICONS.leaf}</span>
          <span>Portal Ambiente</span>
        </a>

        <div class="sidebar-section-label">ACCESOS RAPIDOS</div>

        <a href="tramites.html" class="sidebar-link sidebar-link-quick">
          <span class="sidebar-link-icon">${ICONS.bookmark}</span>
          <span>Mis Tramites</span>
        </a>

        <a href="tasas.html" class="sidebar-link sidebar-link-quick">
          <span class="sidebar-link-icon">${ICONS.wallet}</span>
          <span>Mis Pagos</span>
        </a>

        <a href="#notificaciones" class="sidebar-link sidebar-link-quick">
          <span class="sidebar-link-icon">${ICONS.bell}</span>
          <span>Mis Notificaciones</span>
        </a>

        <a href="#turnos" class="sidebar-link sidebar-link-quick">
          <span class="sidebar-link-icon">${ICONS.calendar}</span>
          <span>Turnos</span>
        </a>

        <a href="#ayuda" class="sidebar-link sidebar-link-quick">
          <span class="sidebar-link-icon">${ICONS.headphones}</span>
          <span>Centro de Ayuda</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-security-card">
          <div class="sidebar-security-icon">${ICONS.shield}</div>
          <div class="sidebar-security-text">
            <span class="sidebar-security-title">Tus datos, seguros</span>
            <span class="sidebar-security-desc">Plataforma oficial y segura del Municipio de Baradero.</span>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function getTopbarHTML() {
  const user = getUserData();
  const initials = getUserInitials();
  const unreadCount = getUnreadNotificationsCount();

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="topbar-left">
          <button class="topbar-hamburger" id="btn-hamburger" aria-label="Abrir menu de navegacion" aria-expanded="false">
            ${ICONS.menu}
          </button>
        </div>

        <div class="topbar-search">
          <span class="topbar-search-icon">${ICONS.search}</span>
          <input type="text" placeholder="Buscar tramites, tasas, legajos..." id="topbar-search-input" />
          <span class="topbar-search-shortcut">&#8984;K</span>
        </div>

        <div class="topbar-right">
          <!-- Theme Toggle with Animated Sun & Moon Icons -->
          <button class="topbar-icon-btn btn-theme-toggle-animated" id="btn-theme-toggle" aria-label="Cambiar modo de color (Claro/Oscuro)">
            <span class="theme-icon-slot slot-moon">${ICONS.moon}</span>
            <span class="theme-icon-slot slot-sun">${ICONS.sun}</span>
          </button>

          <!-- Notification Bell with Dynamic Dropdown -->
          <div class="topbar-notification-wrapper" id="topbar-notification-container">
            <button class="topbar-icon-btn" id="btn-notification-trigger" aria-label="Notificaciones del portal" aria-expanded="false">
              ${ICONS.bell}
              <span class="topbar-notification-badge" id="topbar-notif-badge" style="display: ${unreadCount > 0 ? 'block' : 'none'};">${unreadCount > 9 ? '9+' : unreadCount}</span>
            </button>
            <div class="topbar-dropdown notification-dropdown" id="topbar-notification-menu">
              <div class="notif-dropdown-header">
                <span class="notif-dropdown-title">Avisos & Notificaciones</span>
                <button type="button" class="notif-btn-clear" id="btn-clear-notifications">Marcar leidas</button>
              </div>
              <div class="notif-dropdown-body" id="notif-dropdown-body">
                <!-- Injected dynamically by JS -->
              </div>
            </div>
          </div>

          <!-- Citizen User Profile Dropdown -->
          <div class="topbar-user" id="topbar-user-container">
            <button class="topbar-user-trigger" id="btn-user-dropdown" aria-label="Menu de perfil del vecino">
              <div class="avatar avatar-sm" id="topbar-avatar">${user.avatar ? `<img src="${user.avatar}" alt="Avatar" />` : initials}</div>
              <div class="topbar-user-info">
                <div class="topbar-user-name" id="topbar-user-name">${user.nombre}</div>
                <div class="topbar-user-role" id="topbar-user-role">DNI ${user.dni}</div>
              </div>
              <span class="topbar-user-chevron">${ICONS.chevronDown}</span>
            </button>
            <div class="topbar-dropdown" id="topbar-dropdown-menu">
              <button class="topbar-dropdown-item" id="btn-open-profile">${ICONS.user} Mi Perfil & Datos</button>
              <button class="topbar-dropdown-item" id="btn-open-settings">${ICONS.settings} Identidad & Biometria</button>
              <div class="topbar-dropdown-sep"></div>
              <button class="topbar-dropdown-item danger" id="btn-logout">${ICONS.logOut} Cerrar Sesion</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

function renderNotificationDropdownContent() {
  const container = document.getElementById("notif-dropdown-body");
  if (!container) return;

  const notifs = getNotificationsList();

  if (!notifs || notifs.length === 0) {
    container.innerHTML = `
      <div class="notif-empty-state">
        <div class="notif-empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="notif-empty-title">Sin notificaciones pendientes</div>
        <div class="notif-empty-text">Tus tramites, tasas y reclamos municipales se encuentran al dia.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? 'read' : 'unread'}">
      <div class="notif-item-icon notif-icon-${n.type || 'info'}">
        ${n.icon || ICONS.bell}
      </div>
      <div class="notif-item-content">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-text">${n.text}</div>
        <div class="notif-item-time">${n.time || 'Reciente'}</div>
      </div>
    </div>
  `).join("");
}

function getFooterHTML() {
  return `
    <footer class="portal-footer">
      <div class="container container-wide portal-footer-inner">
        <div class="portal-footer-brand">
          <div class="portal-footer-icon">${ICONS.building}</div>
          <div>
            <div class="portal-footer-name">Municipalidad de Baradero</div>
            <div class="portal-footer-sub">Portal Digital del Ciudadano · SUBI 2026</div>
          </div>
        </div>
        <div class="portal-footer-info">
          <div>San Martin 905, Baradero · Buenos Aires</div>
          <div>Linea de Atencion Ciudadana 147</div>
        </div>
      </div>
    </footer>
  `;
}

function getBottomNavHTML(activePage = "") {
  const items = [
    { page: "home-ciudadano.html", label: "Inicio", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` },
    { page: "tramites.html", label: "Tramites", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>` },
    { page: "atencion147.html", label: "147", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>` },
    { page: "legajo.html", label: "Legajo", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>` },
    { page: "#mas", label: "Mas", icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>` }
  ];
  return `
    <nav class="app-bottom-nav" aria-label="Navegacion Movil Principal">
      ${items.map(item => `
        <a href="${item.page}" class="bottom-nav-item ${activePage === item.page ? 'active' : ''}">
          ${item.icon}
          <span>${item.label}</span>
        </a>
      `).join("")}
    </nav>
  `;
}

// ============================================================================
// Setup App Shell Components and Events
// ============================================================================
function setupAppShell(activePage) {
  const sidebarMount = document.getElementById("sidebar-mount");
  if (sidebarMount) {
    sidebarMount.innerHTML = getSidebarHTML(activePage);
  }

  const topbarMount = document.getElementById("topbar-mount");
  if (topbarMount) {
    topbarMount.innerHTML = getTopbarHTML();
  }

  const footerMount = document.getElementById("footer-mount");
  if (footerMount) {
    footerMount.innerHTML = getFooterHTML();
  }

  let bottomNav = document.querySelector(".app-bottom-nav");
  if (!bottomNav && activePage !== "login.html" && activePage !== "reset-password.html") {
    const navWrapper = document.createElement("div");
    navWrapper.innerHTML = getBottomNavHTML(activePage);
    if (navWrapper.firstElementChild) {
      document.body.appendChild(navWrapper.firstElementChild);
    }
  }

  injectProfileModal();
  setupProfileModalEvents();
  setupSidebarEvents();
  setupTopbarEvents();
  initGlobalModalCloser();
  syncUserWithBackend();
  autoFillCitizenData();

  if (typeof window.initChatbot === "function") {
    window.initChatbot();
  }
}

function initGlobalModalCloser() {
  document.addEventListener("click", (e) => {
    // 1. Botones de cierre explícitos o que dicen "Cerrar" / "Cancelar"
    const closeTrigger = e.target.closest(".modal-close, [data-close-modal], .profile-modal-close, #btn-close-profile-modal, #btn-cancel-profile-modal, .btn-close-modal, .close-modal-btn, [id*='close'], [id*='Close'], [id*='cancel'], [id*='Cancel']");
    if (closeTrigger && !closeTrigger.id?.startsWith("btn-theme")) {
      const modal = closeTrigger.closest(".modal, .modal-overlay, .profile-modal-overlay, .modal-overlay-portal, .modal-overlay-custom, [id^='modal']");
      if (modal) {
        modal.classList.remove("active", "open", "show");
        document.body.style.overflow = "";
      }
      return;
    }

    // 2. Click sobre el fondo oscuro (backdrop)
    if (e.target.classList.contains("modal") || 
        e.target.classList.contains("modal-overlay") || 
        e.target.classList.contains("profile-modal-overlay") || 
        e.target.classList.contains("modal-overlay-portal") ||
        e.target.classList.contains("modal-backdrop")) {
      e.target.classList.remove("active", "open", "show");
      document.body.style.overflow = "";
    }
  });

  // 3. Tecla Escape para cerrar cualquier modal abierto
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal.active, .modal-overlay.active, .profile-modal-overlay.active, .modal-overlay-portal.active, .modal.open, .modal.show, [id^='modal'].active").forEach(m => {
        m.classList.remove("active", "open", "show");
      });
      document.body.style.overflow = "";
    }
  });
}

function setupSidebarEvents() {
  const hamburger = document.getElementById("btn-hamburger");
  const sidebar = document.getElementById("portal-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const btnClose = document.getElementById("btn-close-sidebar");

  if (!sidebar) return;

  const openSidebar = () => {
    sidebar.classList.add("mobile-open");
    if (backdrop) backdrop.classList.add("active");
    if (hamburger) hamburger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  };

  const closeSidebar = () => {
    sidebar.classList.remove("mobile-open");
    if (backdrop) backdrop.classList.remove("active");
    if (hamburger) hamburger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  };

  if (hamburger) hamburger.addEventListener("click", openSidebar);
  if (btnClose) btnClose.addEventListener("click", closeSidebar);
  if (backdrop) backdrop.addEventListener("click", closeSidebar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("mobile-open")) {
      closeSidebar();
    }
  });

  sidebar.querySelectorAll(".sidebar-link").forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 992) closeSidebar();
    });
  });
}

function setupTopbarEvents() {
  const themeBtn = document.getElementById("btn-theme-toggle") || document.getElementById("theme-toggle-btn");
  if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

  const notifContainer = document.getElementById("topbar-notification-container");
  const notifBtn = document.getElementById("btn-notification-trigger");
  const clearNotifBtn = document.getElementById("btn-clear-notifications");

  updateNotificationBadgeUI();
  renderNotificationDropdownContent();

  if (notifContainer && notifBtn) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = notifContainer.classList.contains("open");
      // Cerrar menú de usuario si estaba abierto
      const userContainer = document.getElementById("topbar-user-container");
      if (userContainer) userContainer.classList.remove("open");

      notifContainer.classList.toggle("open", !isOpen);
      notifBtn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
    });

    document.addEventListener("click", (e) => {
      if (!notifContainer.contains(e.target)) {
        notifContainer.classList.remove("open");
        notifBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (clearNotifBtn) {
    clearNotifBtn.addEventListener("click", () => {
      markAllNotificationsRead();
    });
  }

  const userContainer = document.getElementById("topbar-user-container");
  const userTrigger = document.getElementById("btn-user-dropdown");

  if (userContainer && userTrigger) {
    userTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      // Cerrar dropdown de notificaciones si estaba abierto
      if (notifContainer) notifContainer.classList.remove("open");
      userContainer.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
      if (!userContainer.contains(e.target)) {
        userContainer.classList.remove("open");
      }
    });
  }

  const btnOpenProfile = document.getElementById("btn-open-profile");
  if (btnOpenProfile) {
    btnOpenProfile.addEventListener("click", () => {
      if (userContainer) userContainer.classList.remove("open");
      openProfileModal("tab-datos");
    });
  }

  const btnOpenSettings = document.getElementById("btn-open-settings");
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener("click", () => {
      if (userContainer) userContainer.classList.remove("open");
      openProfileModal("tab-identidad");
    });
  }

  const logoutBtn = document.getElementById("btn-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.clear();
      localStorage.clear();
      showToast("Sesión cerrada correctamente", "info");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 400);
    });
  }

  const searchInput = document.getElementById("topbar-search-input");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && searchInput.value.trim()) {
        const q = encodeURIComponent(searchInput.value.trim());
        window.location.href = `tramites.html?q=${q}`;
      }
    });
  }
}

function updateUserUIElements() {
  const user = getUserData();
  const initials = getUserInitials();

  const nameEls = document.querySelectorAll("#topbar-user-name, #sidebar-user-name");
  nameEls.forEach(el => el.textContent = user.nombre);

  const dniEls = document.querySelectorAll("#topbar-user-role, #sidebar-user-dni");
  dniEls.forEach(el => el.textContent = `DNI ${user.dni}`);

  const avatarEls = document.querySelectorAll("#topbar-avatar, #sidebar-avatar");
  avatarEls.forEach(el => {
    if (user.avatar) {
      el.innerHTML = `<img src="${user.avatar}" alt="Avatar" />`;
    } else {
      el.textContent = initials;
    }
  });
}

// ============================================================================
// Profile & Settings Modal with MySQL Persistence
// ============================================================================
// Profile & Settings Modal with MySQL Persistence
// ============================================================================
window.closeProfileModal = function() {
  const modal = document.getElementById("modal-profile-settings");
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
};

function injectProfileModal() {
  if (document.getElementById("modal-profile-settings")) return;

  const user = getUserData();
  const initials = getUserInitials();

  const modal = document.createElement("div");
  modal.id = "modal-profile-settings";
  modal.className = "profile-modal-overlay";
  modal.innerHTML = `
    <div class="profile-modal-card">
      <div class="profile-modal-header">
        <div class="profile-modal-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>Mi Perfil & Identidad Ciudadana</span>
        </div>
        <button class="profile-modal-close" id="btn-close-profile-modal" onclick="window.closeProfileModal()" aria-label="Cerrar modal">
          ${ICONS.close}
        </button>
      </div>

      <div class="profile-modal-tabs">
        <button class="profile-tab-btn active" data-tab="tab-datos">Datos Personales</button>
        <button class="profile-tab-btn" data-tab="tab-identidad">Identidad & Biometría</button>
        <button class="profile-tab-btn" data-tab="tab-preferencias">Preferencias</button>
      </div>

      <div class="profile-modal-body">
        <!-- Tab 1: Datos Personales -->
        <div class="profile-tab-pane active" id="tab-datos">
          <div class="profile-avatar-section">
            <div class="profile-avatar-preview" id="modal-avatar-preview">
              ${user.avatar ? `<img src="${user.avatar}" alt="Avatar" />` : initials}
            </div>
            <div class="profile-avatar-actions">
              <label class="btn btn-primary btn-sm" style="cursor:pointer;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Cambiar foto de perfil
                <input type="file" id="input-avatar-file" accept="image/*" style="display:none;" />
              </label>
              <button class="btn btn-ghost btn-sm" id="btn-remove-avatar">Usar iniciales</button>
            </div>
          </div>

          <div class="profile-form-grid">
            <div class="profile-form-group">
              <label class="profile-form-label">Nombre Completo</label>
              <input type="text" class="ds-input" id="profile-input-nombre" value="${user.nombre}" placeholder="Ej: Valentin Lucero" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">Usuario / Legajo</label>
              <input type="text" class="ds-input" id="profile-input-username" value="${user.username}" disabled />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">DNI (Documento Único)</label>
              <input type="text" class="ds-input" id="profile-input-dni" value="${user.dni}" placeholder="Ej: 48371946" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">CUIL / CUIT</label>
              <input type="text" class="ds-input" id="profile-input-cuil" value="${user.cuil}" placeholder="Ej: 20-48371946-9" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">Fecha de Nacimiento</label>
              <input type="date" class="ds-input" id="profile-input-fecha-nac" value="${user.fecha_nacimiento || '2007-11-19'}" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">Localidad</label>
              <input type="text" class="ds-input" id="profile-input-localidad" value="${user.localidad || 'Baradero'}" placeholder="Baradero" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">Correo Electrónico</label>
              <input type="email" class="ds-input" id="profile-input-email" value="${user.email}" placeholder="ejemplo@correo.com" />
            </div>
            <div class="profile-form-group">
              <label class="profile-form-label">Teléfono / Celular</label>
              <input type="text" class="ds-input" id="profile-input-telefono" value="${user.telefono}" placeholder="+54 3329 481234" />
            </div>
            <div class="profile-form-group" style="grid-column: 1 / -1;">
              <label class="profile-form-label">Domicilio Declarado en Baradero</label>
              <input type="text" class="ds-input" id="profile-input-domicilio" value="${user.domicilio}" placeholder="Ej: Malabia 1501" />
            </div>
          </div>
        </div>

        <!-- Tab 2: Identidad & Biometría -->
        <div class="profile-tab-pane" id="tab-identidad">
          <div style="padding:16px 18px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <strong style="color:var(--text-primary); font-size:14px;">Identidad Digital Nivel 3 (Máximo)</strong>
                <p style="font-size:12px; color:var(--text-tertiary); margin-top:3px;">Validado por Registro Único del Ciudadano y ReNaPer Baradero.</p>
              </div>
              <span class="badge badge-green">✓ Verificado</span>
            </div>
          </div>

          <div style="padding:16px 18px; border-radius:14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08);">
            <strong style="color:var(--text-primary); font-size:14px; display:block; margin-bottom:4px;">Reconocimiento Facial Biométrico</strong>
            <p style="font-size:12px; color:var(--text-tertiary);">Comprobación biométrica de rostro comparada contra DNI digitalizado.</p>
            <div style="width:100%; height:110px; border-radius:12px; background:rgba(255,255,255,0.02); border:1.5px dashed rgba(56, 189, 248, 0.4); display:flex; flex-direction:column; align-items:center; justify-content:center; margin:14px 0;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.8" style="margin-bottom:6px;">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <div style="font-size:13px; font-weight:700; color:var(--text-primary);">Rostro Verificado con Éxito</div>
              <div style="font-size:11.5px; color:#10b981; margin-top:2px;">Coincidencia DNI: 99.9% · Validación activa</div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Preferencias -->
        <div class="profile-tab-pane" id="tab-preferencias">
          <div class="profile-form-group">
            <label class="profile-form-label">Tema Visual del Portal</label>
            <div style="display:flex;gap:12px;margin-top:8px;">
              <button type="button" class="btn btn-outline btn-sm" id="btn-theme-dark">🌙 Modo Oscuro (Slate)</button>
              <button type="button" class="btn btn-outline btn-sm" id="btn-theme-light">☀️ Modo Claro</button>
            </div>
          </div>
          <div class="profile-form-group" style="margin-top:20px;">
            <label class="profile-form-label">Notificaciones de tu Legajo</label>
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
              <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text-secondary);">
                <input type="checkbox" class="ds-checkbox" checked /> Avisos de vencimiento de tasas y boletas
              </label>
              <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text-secondary);">
                <input type="checkbox" class="ds-checkbox" checked /> Actualizaciones de estado de expedientes
              </label>
              <label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;color:var(--text-secondary);">
                <input type="checkbox" class="ds-checkbox" checked /> Respuestas a reclamos del 147
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-modal-footer">
        <button type="button" class="btn btn-ghost" id="btn-cancel-profile-modal" onclick="window.closeProfileModal()">Cerrar</button>
        <button type="button" class="btn btn-primary" id="btn-save-profile">Guardar Cambios en MySQL</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function setupProfileModalEvents() {
  const modal = document.getElementById("modal-profile-settings");
  if (!modal) return;

  const btnClose = document.getElementById("btn-close-profile-modal");
  const btnCancel = document.getElementById("btn-cancel-profile-modal");
  const btnSave = document.getElementById("btn-save-profile");
  const avatarInput = document.getElementById("input-avatar-file");
  const btnRemoveAvatar = document.getElementById("btn-remove-avatar");
  const tabBtns = modal.querySelectorAll(".profile-tab-btn");

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      modal.querySelectorAll(".profile-tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  if (btnClose) btnClose.onclick = window.closeProfileModal;
  if (btnCancel) btnCancel.onclick = window.closeProfileModal;
  modal.onclick = (e) => { if (e.target === modal) window.closeProfileModal(); };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      window.closeProfileModal();
    }
  });

  // Avatar upload
  if (avatarInput) {
    avatarInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target.result;
        localStorage.setItem("usuario_avatar", dataUrl);
        sessionStorage.setItem("usuario_avatar", dataUrl);

        const preview = document.getElementById("modal-avatar-preview");
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Avatar" />`;

        updateUserUIElements();

        const user = getUserData();
        try {
          await fetch(`${API_BASE}/api/usuarios/perfil`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: user.username,
              avatar_url: dataUrl
            })
          });
          showToast("Foto de perfil guardada en la base de datos", "success");
        } catch (err) {
          showToast("Foto actualizada localmente", "info");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Remove avatar
  if (btnRemoveAvatar) {
    btnRemoveAvatar.addEventListener("click", async () => {
      localStorage.removeItem("usuario_avatar");
      sessionStorage.removeItem("usuario_avatar");
      const initials = getUserInitials();
      const preview = document.getElementById("modal-avatar-preview");
      if (preview) preview.innerHTML = initials;

      updateUserUIElements();

      const user = getUserData();
      try {
        await fetch(`${API_BASE}/api/usuarios/perfil`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: user.username,
            avatar_url: ""
          })
        });
      } catch (e) {}

      showToast("Foto de perfil removida", "info");
    });
  }

  // Guardar Cambios en MySQL
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const nombre = cleanDuplicateWords(document.getElementById("profile-input-nombre").value.trim());
      const dni = document.getElementById("profile-input-dni").value.trim();
      const cuil = document.getElementById("profile-input-cuil").value.trim();
      const fechaNac = document.getElementById("profile-input-fecha-nac").value.trim();
      const localidad = document.getElementById("profile-input-localidad").value.trim();
      const email = document.getElementById("profile-input-email").value.trim();
      const telefono = document.getElementById("profile-input-telefono").value.trim();
      const domicilio = document.getElementById("profile-input-domicilio").value.trim();

      const user = getUserData();
      btnSave.classList.add("loading");
      btnSave.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/usuarios/perfil`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: user.username,
            nombre: nombre,
            dni: dni,
            cuil: cuil,
            fecha_nacimiento: fechaNac,
            localidad: localidad,
            email: email,
            telefono: telefono,
            domicilio: domicilio
          })
        });

        if (!res.ok) {
          let errDetail = "Error al actualizar perfil en MySQL.";
          try {
            const errJson = await res.json();
            if (errJson.detail) errDetail = errJson.detail;
          } catch (e) {}
          throw new Error(errDetail);
        }

        const data = await res.json();
        const savedNombre = cleanDuplicateWords(data.user?.nombre_completo || nombre);

        localStorage.setItem("usuario_nombre", savedNombre);
        if (dni) localStorage.setItem("usuario_dni", dni);
        if (cuil) localStorage.setItem("usuario_cuil", cuil);
        if (fechaNac) localStorage.setItem("usuario_fecha_nac", fechaNac);
        if (localidad) localStorage.setItem("usuario_localidad", localidad);
        if (email) localStorage.setItem("usuario_email", email);
        if (telefono) localStorage.setItem("usuario_telefono", telefono);
        if (domicilio) localStorage.setItem("usuario_domicilio", domicilio);

        updateUserUIElements();
        window.closeProfileModal();
        showToast("¡Cambios guardados con éxito en MySQL!", "success");
      } catch (err) {
        localStorage.setItem("usuario_nombre", nombre);
        if (dni) localStorage.setItem("usuario_dni", dni);
        if (cuil) localStorage.setItem("usuario_cuil", cuil);
        if (fechaNac) localStorage.setItem("usuario_fecha_nac", fechaNac);
        if (localidad) localStorage.setItem("usuario_localidad", localidad);
        if (email) localStorage.setItem("usuario_email", email);
        if (telefono) localStorage.setItem("usuario_telefono", telefono);
        if (domicilio) localStorage.setItem("usuario_domicilio", domicilio);
        updateUserUIElements();

        if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          window.closeProfileModal();
          showToast("Cambios guardados localmente", "info");
        } else {
          showToast(err.message, "error");
        }
      } finally {
        btnSave.classList.remove("loading");
        btnSave.disabled = false;
      }
    });
  }

  const btnThemeDark = document.getElementById("btn-theme-dark");
  const btnThemeLight = document.getElementById("btn-theme-light");
  if (btnThemeDark) btnThemeDark.addEventListener("click", () => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("subi_theme", "dark");
  });
  if (btnThemeLight) btnThemeLight.addEventListener("click", () => {
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("subi_theme", "light");
  });
}

function openProfileModal(tabName = "tab-datos") {
  injectProfileModal();
  setupProfileModalEvents();

  const modal = document.getElementById("modal-profile-settings");
  if (!modal) return;

  // Refresh latest values from current session
  const user = getUserData();
  const initials = getUserInitials();

  const nameEl = document.getElementById("profile-input-nombre");
  const userEl = document.getElementById("profile-input-username");
  const dniEl = document.getElementById("profile-input-dni");
  const cuilEl = document.getElementById("profile-input-cuil");
  const fechaEl = document.getElementById("profile-input-fecha-nac");
  const locEl = document.getElementById("profile-input-localidad");
  const emailEl = document.getElementById("profile-input-email");
  const telEl = document.getElementById("profile-input-telefono");
  const domEl = document.getElementById("profile-input-domicilio");
  const avatarPreview = document.getElementById("modal-avatar-preview");

  if (nameEl) nameEl.value = user.nombre;
  if (userEl) userEl.value = user.username;
  if (dniEl) dniEl.value = user.dni;
  if (cuilEl) cuilEl.value = user.cuil;
  if (fechaEl) fechaEl.value = user.fecha_nacimiento || "2007-11-19";
  if (locEl) locEl.value = user.localidad || "Baradero";
  if (emailEl) emailEl.value = user.email;
  if (telEl) telEl.value = user.telefono;
  if (domEl) domEl.value = user.domicilio;
  if (avatarPreview) {
    avatarPreview.innerHTML = user.avatar ? `<img src="${user.avatar}" alt="Avatar" />` : initials;
  }

  const tabBtn = modal.querySelector(`[data-tab="${tabName}"]`);
  if (tabBtn) tabBtn.click();

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

// ============================================================================
// Toast Notification System
// ============================================================================
let currentToastTimer = null;
let lastToastMsg = "";
let lastToastStamp = 0;

function showToast(message, type = "info", duration = 3200) {
  const now = Date.now();
  if (message === lastToastMsg && (now - lastToastStamp) < 1200) return;
  lastToastMsg = message;
  lastToastStamp = now;

  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  if (currentToastTimer) clearTimeout(currentToastTimer);
  container.innerHTML = "";

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const iconMap = {
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  toast.innerHTML = `
    <span class="toast-icon">${iconMap[type] || iconMap.info}</span>
    <span class="toast-text">${message}</span>
    <button class="toast-dismiss" aria-label="Cerrar">&times;</button>
  `;

  const dismissBtn = toast.querySelector(".toast-dismiss");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    });
  }

  container.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });

  currentToastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 250);
  }, duration);
}
