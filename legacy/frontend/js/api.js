/**
 * API Helper - Comunicación con el backend
 */
const API_BASE = 'http://localhost:5000/api';

class ApiService {
    static getToken() {
        return localStorage.getItem('token');
    }

    static setToken(token) {
        localStorage.setItem('token', token);
    }

    static clearToken() {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
    }

    static getUsuario() {
        const data = localStorage.getItem('usuario');
        return data ? JSON.parse(data) : null;
    }

    static setUsuario(usuario) {
        localStorage.setItem('usuario', JSON.stringify(usuario));
    }

    static getAdminToken() {
        return localStorage.getItem('admin_token');
    }

    static setAdminToken(token) {
        localStorage.setItem('admin_token', token);
    }

    static getAdmin() {
        const data = localStorage.getItem('admin');
        return data ? JSON.parse(data) : null;
    }

    static setAdmin(admin) {
        localStorage.setItem('admin', JSON.stringify(admin));
    }

    static clearAdmin() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin');
    }

    static async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        const token = options.useAdmin ? this.getAdminToken() : this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                body: options.body ? JSON.stringify(options.body) : undefined
            });

            const data = await response.json();

            if (!response.ok) {
                throw { status: response.status, message: data.error || 'Error desconocido', data };
            }

            return data;
        } catch (error) {
            if (error.status) throw error;
            throw { status: 0, message: 'Error de conexión con el servidor' };
        }
    }

    // ---- AUTH & DNI ----
    static async procesarDni(imageOrPayload) {
        let body = {};
        if (typeof imageOrPayload === 'string') {
            body = { image: imageOrPayload };
        } else if (imageOrPayload && typeof imageOrPayload === 'object') {
            body = imageOrPayload;
        }
        return this.request('/dni/procesar', {
            method: 'POST',
            body: body
        });
    }

    static async actualizarFotoPerfil(fotoRostro) {
        const data = await this.request('/usuario/foto-perfil', {
            method: 'POST',
            body: { foto_rostro: fotoRostro }
        });
        const current = this.getUsuario();
        if (current) {
            current.foto_rostro = fotoRostro;
            this.setUsuario(current);
        }
        return data;
    }

    static async checkDni(dni) {
        return this.request('/auth/check-dni', {
            method: 'POST',
            body: { dni }
        });
    }

    static async login(dni, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: { dni, password }
        });
        this.setToken(data.token);
        this.setUsuario(data.usuario);
        return data;
    }

    static async registro(formData) {
        const data = await this.request('/auth/registro', {
            method: 'POST',
            body: formData
        });
        this.setToken(data.token);
        this.setUsuario(data.usuario);
        return data;
    }

    static async adminLogin(usuario, password) {
        const data = await this.request('/admin/login', {
            method: 'POST',
            body: { usuario, password }
        });
        this.setAdminToken(data.token);
        this.setAdmin(data.admin);
        return data;
    }

    // ---- PROGRESO ----
    static async getProgreso() {
        return this.request('/tramite/progreso');
    }

    static async saltarPaso(paso) {
        return this.request('/tramite/saltar-paso', {
            method: 'POST',
            body: { paso }
        });
    }

    // ---- CHARLAS ----
    static async getVideos() {
        return this.request('/charlas/videos');
    }

    static async marcarVideoVisto(video_id) {
        return this.request('/charlas/marcar-visto', {
            method: 'POST',
            body: { video_id }
        });
    }

    // ---- EXAMEN ----
    static async getPreguntas(force = false) {
        return this.request(`/examen/preguntas${force ? '?force=1' : ''}`);
    }

    static async reiniciarExamen() {
        return this.request('/examen/reiniciar', { method: 'POST' });
    }

    static async entregarExamen(respuestas) {
        return this.request('/examen/entregar', {
            method: 'POST',
            body: { respuestas }
        });
    }

    // ---- FORMULARIOS ----
    static async getFormularioEstado() {
        return this.request('/formularios/estado');
    }

    static async enviarFormularios(formData) {
        return this.request('/formularios/enviar', {
            method: 'POST',
            body: formData
        });
    }

    // ---- PAGOS ----
    static async getPagosInfo() {
        return this.request('/pagos/info');
    }

    static async registrarPago(pagoData) {
        return this.request('/pagos/registrar', {
            method: 'POST',
            body: pagoData
        });
    }

    static async reiniciarPago() {
        return this.request('/pagos/reiniciar', {
            method: 'POST'
        });
    }

    // ---- TURNOS ----
    static async getTurnosDisponibles() {
        return this.request('/turnos/disponibles');
    }

    static async reservarTurno(turno_id) {
        return this.request('/turnos/reservar', {
            method: 'POST',
            body: { turno_id }
        });
    }

    // ---- ENTREGA & CREDENCIAL DIGITAL ----
    static async getEntregaEstado() {
        return this.request('/entrega/estado');
    }

    static async solicitarEntrega(metodo, direccion) {
        return this.request('/entrega/solicitar', {
            method: 'POST',
            body: { metodo, direccion }
        });
    }

    static async getLicenciaDigital() {
        return this.request('/licencia/digital');
    }

    static async iniciarRenovacion() {
        const data = await this.request('/licencia/renovar', {
            method: 'POST'
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }


    static async iniciarTramite(tipo) {
        const data = await this.request('/tramite/iniciar', {
            method: 'POST',
            body: { tipo }
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    static async actualizarCud(tieneCud, numeroCud = '') {
        return this.request('/usuario/cud', {
            method: 'POST',
            body: { tiene_cud: tieneCud, numero_cud: numeroCud }
        });
    }

    static async sendExamenPing(pingData) {
        return this.request('/examen/stream/ping', {
            method: 'POST',
            body: pingData
        });
    }

    // ---- ADMIN & PROFESORES ----
    static async adminGetPagos(estado = 'todos') {
        return this.request(`/admin/pagos?estado=${estado}`, { useAdmin: true });
    }

    static async adminRevisarPago(pagoId, estado, observaciones = '') {
        return this.request(`/admin/pagos/${pagoId}/revisar`, {
            method: 'PUT',
            body: { estado, observaciones },
            useAdmin: true
        });
    }

    static async adminGetSalud(estado = 'todos') {
        return this.request(`/admin/salud?estado=${estado}`, { useAdmin: true });
    }

    static async adminRevisarSalud(formId, estado, observaciones = '') {
        return this.request(`/admin/salud/${formId}/revisar`, {
            method: 'PUT',
            body: { estado, observaciones },
            useAdmin: true
        });
    }

    static async adminGetTurnos(estado = 'todos') {
        return this.request(`/admin/turnos?estado=${estado}`, { useAdmin: true });
    }

    static async adminRevisarTurno(reservaId, estado, resultadoExamen = 'pendiente', huellaTomada = 0, fotoTomada = 0, observaciones = '') {
        return this.request(`/admin/turnos/${reservaId}/revisar`, {
            method: 'PUT',
            body: { 
                estado, 
                resultado_examen: resultadoExamen, 
                huella_tomada: huellaTomada, 
                foto_tomada: fotoTomada, 
                observaciones 
            },
            useAdmin: true
        });
    }

    static async adminGetConfigExamen() {
        return this.request('/admin/config-examen', { useAdmin: true });
    }

    static async adminUpdateConfigExamen(configData) {
        return this.request('/admin/config-examen', {
            method: 'POST',
            body: configData,
            useAdmin: true
        });
    }

    static async adminGetPreguntas() {
        return this.request('/admin/preguntas', { useAdmin: true });
    }

    static async adminCreatePregunta(preguntaData) {
        return this.request('/admin/preguntas', {
            method: 'POST',
            body: preguntaData,
            useAdmin: true
        });
    }

    static async adminUpdatePregunta(pid, preguntaData) {
        return this.request(`/admin/preguntas/${pid}`, {
            method: 'PUT',
            body: preguntaData,
            useAdmin: true
        });
    }

    static async adminDeletePregunta(pid) {
        return this.request(`/admin/preguntas/${pid}`, {
            method: 'DELETE',
            useAdmin: true
        });
    }

    static async adminVaciarPreguntas(soloProfesor = true) {
        return this.request('/admin/preguntas/vaciar', {
            method: 'POST',
            body: { solo_profesor: soloProfesor },
            useAdmin: true
        });
    }

    static async adminVaciarPlantilla() {
        return this.request('/admin/preguntas/vaciar', {
            method: 'POST',
            body: { tipo: 'plantilla' },
            useAdmin: true
        });
    }

    static async adminRestaurarPlantilla() {
        return this.request('/admin/preguntas/restaurar-plantilla', {
            method: 'POST',
            useAdmin: true
        });
    }

    static async adminGetPreguntasPreview() {
        return this.request('/admin/preguntas/preview', { useAdmin: true });
    }

    static async adminGetExamenMonitoreo() {
        return this.request('/admin/examen/monitoreo', { useAdmin: true });
    }

    static async adminExpulsarExamen(tramiteId, motivo) {
        return this.request('/admin/examen/expulsar', {
            method: 'POST',
            body: { tramite_id: tramiteId, motivo },
            useAdmin: true
        });
    }

    static async adminGetExamenesRevision() {
        return this.request('/admin/examen/revision-lista', { useAdmin: true });
    }

    static async adminRevisarExamen(tramiteId, decision, motivo) {
        return this.request('/admin/examen/revisar', {
            method: 'POST',
            body: { tramite_id: tramiteId, decision, motivo },
            useAdmin: true
        });
    }

    static async adminEnviarMensajeProfesor(tramiteId, mensaje) {
        return this.request('/admin/profesor/chat/enviar', {
            method: 'POST',
            body: { tramite_id: tramiteId, mensaje },
            useAdmin: true
        });
    }

    static async getMensajesProfesor() {
        return this.request('/profesor/chat/mensajes');
    }

    static async adminGetStats() {
        return this.request('/admin/stats', { useAdmin: true });
    }

    // ============================================================
    // GESTIÓN DE CUENTAS E INFRACCIONES & INBOX
    // ============================================================

    static async adminGetCuentas(filtro = 'todos') {
        return this.request(`/admin/cuentas?filtro=${encodeURIComponent(filtro)}`, { useAdmin: true });
    }

    static async adminGetCuentaDetalle(userId) {
        return this.request(`/admin/cuentas/${userId}`, { useAdmin: true });
    }

    static async adminAprobarCuenta(userId) {
        return this.request(`/admin/cuentas/${userId}/aprobar`, {
            method: 'POST',
            useAdmin: true
        });
    }

    static async adminRechazarCuenta(userId, data) {
        return this.request(`/admin/cuentas/${userId}/rechazar`, {
            method: 'POST',
            body: data,
            useAdmin: true
        });
    }

    static async adminMoverPapeleraCuenta(userId) {
        return this.request(`/admin/cuentas/${userId}/mover-papelera`, {
            method: 'POST',
            useAdmin: true
        });
    }

    static async adminDarAltaCuenta(userId) {
        return this.request(`/admin/cuentas/${userId}/dar-alta`, {
            method: 'POST',
            useAdmin: true
        });
    }

    static async getInboxMensajes(userId = null, useAdmin = false) {
        const url = useAdmin && userId ? `/inbox/mensajes?usuario_id=${userId}` : '/inbox/mensajes';
        return this.request(url, { useAdmin });
    }

    static async sendInboxMensaje(data, useAdmin = false) {
        return this.request('/inbox/enviar', {
            method: 'POST',
            body: data,
            useAdmin
        });
    }

    static async notificarYaPague(data = {}) {
        return this.request('/usuario/notificar-ya-pague', {
            method: 'POST',
            body: data
        });
    }

    static async marcarBienvenidaVista() {
        return this.request('/usuario/bienvenida-vista', {
            method: 'POST'
        });
    }
}

