/**
 * Página de Entrega - Método de entrega de licencia
 */
class EntregaPage {
    static metodo = null;

    static async render(app) {
        this.metodo = null;

        app.innerHTML = `
        ${renderBackHeader('Entrega de licencia')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getEntregaEstado();
            this.renderContent(app, data);
        } catch (err) {
            app.innerHTML = `
            ${renderBackHeader('Entrega de licencia')}
            <div class="page-content container-md">
                <div class="info-box info-box--warning">
                    <span>⚠️</span>
                    <span>${err.message}</span>
                </div>
                <button class="btn btn-outline btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
        }
    }

    static renderContent(app, data) {
        if (data.entrega) {
            const e = data.entrega;
            app.innerHTML = `
            ${renderBackHeader('Entrega de licencia')}
            <div class="page-content container-md animate-slideUp">
                <div class="success-screen">
                    <div class="success-screen__icon">🎉</div>
                    <h2 class="success-screen__title">¡Solicitud registrada!</h2>
                    <p class="success-screen__desc">
                        ${e.metodo === 'domicilio' 
                            ? `Tu licencia será enviada a: <strong>${e.direccion}</strong>` 
                            : 'Retirá tu licencia en la Dirección de Tránsito de Baradero.'}
                    </p>
                    <div class="badge ${e.estado === 'entregado' ? 'badge-success' : 'badge-pending'} mt-3">
                        ${e.estado === 'entregado' ? '✅ Entregado' : '⏳ ' + (e.estado === 'en_camino' ? 'En camino' : 'Pendiente')}
                    </div>
                </div>

                <div class="info-box info-box--success mt-4">
                    <span>🎉</span>
                    <span>¡Felicitaciones! Has completado todo el trámite de tu licencia de conducir.</span>
                </div>

                <button class="btn btn-primary btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
            return;
        }

        // Sin entrega solicitada
        app.innerHTML = `
        ${renderBackHeader('Entrega de licencia')}
        <div class="page-content container-md animate-slideUp">
            <p class="text-sm text-muted mb-4">
                Elegí cómo querés recibir tu licencia de conducir.
            </p>

            <div class="stack mb-4">
                <div class="payment-method ${this.metodo === 'domicilio' ? 'payment-method--selected' : ''}"
                     onclick="EntregaPage.selectMetodo('domicilio')">
                    <div class="payment-method__icon">🚚</div>
                    <div style="flex:1">
                        <h3 class="font-semibold text-sm">Envío a domicilio</h3>
                        <p class="text-xs text-muted">Recibí tu licencia en tu casa</p>
                    </div>
                    ${this.metodo === 'domicilio' ? '<span style="color:var(--primary);font-size:1.2rem">✓</span>' : ''}
                </div>

                ${this.metodo === 'domicilio' ? `
                <div class="form-group" style="padding-left:4px">
                    <label class="form-label">Dirección de envío</label>
                    <input type="text" id="entregaDireccion" class="form-input" 
                           placeholder="Ej: Av. San Martín 1234, Baradero">
                </div>` : ''}

                <div class="payment-method ${this.metodo === 'presencial' ? 'payment-method--selected' : ''}"
                     onclick="EntregaPage.selectMetodo('presencial')">
                    <div class="payment-method__icon">🏢</div>
                    <div style="flex:1">
                        <h3 class="font-semibold text-sm">Retiro presencial</h3>
                        <p class="text-xs text-muted">Dirección de Tránsito, Baradero</p>
                    </div>
                    ${this.metodo === 'presencial' ? '<span style="color:var(--primary);font-size:1.2rem">✓</span>' : ''}
                </div>
            </div>

            <button class="btn btn-primary btn-block btn-lg" id="entregaBtn"
                    ${!this.metodo ? 'disabled' : ''}
                    onclick="EntregaPage.confirmar()">
                Confirmar método de entrega
            </button>
        </div>`;
    }

    static selectMetodo(metodo) {
        this.metodo = metodo;
        this.render(document.getElementById('app'));
    }

    static async confirmar() {
        if (!this.metodo) return;

        let direccion = '';
        if (this.metodo === 'domicilio') {
            direccion = document.getElementById('entregaDireccion')?.value?.trim() || '';
            if (!direccion) {
                Toast.warning('Ingresá tu dirección de envío');
                return;
            }
        }

        const btn = document.getElementById('entregaBtn');
        btn.disabled = true;
        btn.textContent = 'Confirmando...';

        try {
            await ApiService.solicitarEntrega(this.metodo, direccion);
            Toast.success('¡Solicitud de entrega registrada! Trámite finalizado.');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            btn.disabled = false;
            btn.textContent = 'Confirmar método de entrega';
        }
    }
}
