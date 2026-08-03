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

    // ---- AUTH ----
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

    // ---- ENTREGA ----
    static async getEntregaEstado() {
        return this.request('/entrega/estado');
    }

    static async solicitarEntrega(metodo, direccion) {
        return this.request('/entrega/solicitar', {
            method: 'POST',
            body: { metodo, direccion }
        });
    }

    // ---- ADMIN ----
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

    static async adminRevisarTurno(reservaId, estado, resultadoExamen = 'pendiente', observaciones = '') {
        return this.request(`/admin/turnos/${reservaId}/revisar`, {
            method: 'PUT',
            body: { estado, resultado_examen: resultadoExamen, observaciones },
            useAdmin: true
        });
    }

    static async adminGetStats() {
        return this.request('/admin/stats', { useAdmin: true });
    }
}
