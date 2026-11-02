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
            const demoEntrega = JSON.parse(localStorage.getItem('demo_entrega') || 'null');
            this.renderContent(app, demoEntrega || { entrega: null });
            if (err && err.status === 403) {
                Toast.info('Modo Demo: Sección de Entrega de Licencia.');
            }
        }
    }

    static renderContent(app, data) {
        if (data.entrega) {
            const e = data.entrega;
            app.innerHTML = `
            ${renderBackHeader('Entrega de Licencia')}
            <div class="page-content container-md animate-slideUp" style="max-width:740px;margin:0 auto;padding-top:14px;">
                
                <div class="dash-card text-center mb-4" style="border:1.5px solid #86efac;background:#f0fdf4;padding:36px 24px;">
                    <div style="width:72px;height:72px;border-radius:50%;background:#dcfce7;color:#15803d;display:flex;align-items:center;justify-content:center;font-size:2.2rem;margin:0 auto 16px auto;">
                        🎉
                    </div>
                    <span class="badge ${e.estado === 'entregado' ? 'badge-success' : 'badge-info'} mb-2" style="font-size:0.8rem;padding:4px 12px;font-weight:700;">
                        ${e.estado === 'entregado' ? '✓ Entregada' : (e.estado === 'en_camino' ? '🚚 En Camino' : '⏳ En Impresión Oficial')}
                    </span>
                    <h2 style="font-size:1.35rem;font-weight:800;color:#1e293b;margin-bottom:6px;">¡Trámite Completado con Éxito!</h2>
                    <p style="font-size:0.88rem;color:#64748b;margin:0 auto 20px auto;max-width:520px;">
                        ${e.metodo === 'domicilio' 
                            ? `Tu plástico oficial será despachado a tu domicilio: <strong>${e.direccion}</strong>` 
                            : 'Tu plástico oficial te espera en la Dirección de Tránsito y Licencias del Municipio de Baradero.'}
                    </p>

                    <div style="background:#ffffff;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:left;margin-bottom:24px;display:flex;align-items:center;gap:14px;">
                        <div style="width:42px;height:42px;border-radius:50%;background:#ecfdf5;color:#059669;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                            ${Icons.shield}
                        </div>
                        <div style="font-size:0.82rem;color:#166534;line-height:1.4;">
                            <strong>Licencia Digital ya vigente:</strong> Mientras esperás el formato físico, tu credencial digital cuenta con plena validez legal para circular en la República Argentina.
                        </div>
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('dashboard')">
                        Volver al Panel Principal
                    </button>
                </div>

            </div>`;
            return;
        }

        // Sin entrega solicitada
        app.innerHTML = `
        ${renderBackHeader('Entrega de Licencia')}
        <div class="page-content container-md animate-slideUp" style="max-width:800px;margin:0 auto;padding-top:12px;">
            
            <div class="dash-card mb-4">
                <div class="card-header-row">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:40px;height:40px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
                            ${Icons.package}
                        </div>
                        <div>
                            <h2 style="font-size:1.1rem;font-weight:800;margin:0;color:#1e293b;">Modalidad de Entrega del Plástico</h2>
                            <p style="font-size:0.8rem;color:#64748b;margin:0;">Paso 7 de 7 · Seleccioná cómo deseás recibir tu licencia física oficial.</p>
                        </div>
                    </div>
                    <span class="badge badge-success" style="font-size:0.75rem;padding:3px 8px;">Instancia Final</span>
                </div>

                <div class="stack mb-4" style="gap:14px;">
                    <!-- Opción 1: Retiro Presencial -->
                    <div class="payment-method ${this.metodo === 'presencial' ? 'payment-method--selected' : ''}"
                         style="border:1.5px solid ${this.metodo === 'presencial' ? '#0284c7' : '#e2e8f0'};background:${this.metodo === 'presencial' ? '#e0f2fe' : '#ffffff'};border-radius:12px;padding:16px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;transition:all 0.2s;"
                         onclick="EntregaPage.selectMetodo('presencial')">
                        <div style="width:44px;height:44px;border-radius:50%;background:${this.metodo === 'presencial' ? '#0284c7' : '#f1f5f9'};color:${this.metodo === 'presencial' ? '#ffffff' : '#0284c7'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                            ${Icons.building}
                        </div>
                        <div style="flex:1;">
                            <h3 style="font-weight:800;font-size:0.95rem;color:#1e293b;margin-bottom:2px;">Retiro Presencial en Dirección de Tránsito</h3>
                            <p style="font-size:0.8rem;color:#64748b;margin:0;">Edificio Municipal · Lunes a Viernes de 07:30 a 13:00 hs (Gratuito y sin demora)</p>
                        </div>
                        <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${this.metodo === 'presencial' ? '#0284c7' : '#cbd5e1'};background:${this.metodo === 'presencial' ? '#0284c7' : '#ffffff'};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;">
                            ${this.metodo === 'presencial' ? '✓' : ''}
                        </div>
                    </div>

                    <!-- Opción 2: Envío a Domicilio -->
                    <div class="payment-method ${this.metodo === 'domicilio' ? 'payment-method--selected' : ''}"
                         style="border:1.5px solid ${this.metodo === 'domicilio' ? '#0284c7' : '#e2e8f0'};background:${this.metodo === 'domicilio' ? '#e0f2fe' : '#ffffff'};border-radius:12px;padding:16px 20px;cursor:pointer;display:flex;align-items:center;gap:16px;transition:all 0.2s;"
                         onclick="EntregaPage.selectMetodo('domicilio')">
                        <div style="width:44px;height:44px;border-radius:50%;background:${this.metodo === 'domicilio' ? '#0284c7' : '#f1f5f9'};color:${this.metodo === 'domicilio' ? '#ffffff' : '#0284c7'};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">
                            ${Icons.truck}
                        </div>
                        <div style="flex:1;">
                            <h3 style="font-weight:800;font-size:0.95rem;color:#1e293b;margin-bottom:2px;">Envío Postal a Domicilio en Baradero</h3>
                            <p style="font-size:0.8rem;color:#64748b;margin:0;">Entrega bajo sobre cerrado con seguimiento oficial municipal</p>
                        </div>
                        <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${this.metodo === 'domicilio' ? '#0284c7' : '#cbd5e1'};background:${this.metodo === 'domicilio' ? '#0284c7' : '#ffffff'};color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;">
                            ${this.metodo === 'domicilio' ? '✓' : ''}
                        </div>
                    </div>

                    ${this.metodo === 'domicilio' ? `
                    <div class="form-group p-4" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                        <label class="form-label font-bold" style="color:#1e293b;">Dirección Exacta de Envío en Baradero *</label>
                        <input type="text" id="entregaDireccion" class="form-input" 
                               placeholder="Ej: Av. San Martín 1234, Barrio Centro, Baradero" required>
                    </div>` : ''}
                </div>

                <button class="btn btn-primary btn-block btn-lg" id="entregaBtn" style="font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;"
                        ${!this.metodo ? 'disabled' : ''}
                        onclick="EntregaPage.confirmar()">
                    Confirmar Modalidad de Entrega
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
            </div>

        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('entrega'), 300);
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
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Confirmando...';
        }

        try {
            await ApiService.solicitarEntrega(this.metodo, direccion);
            Toast.success('¡Solicitud de entrega registrada! Trámite finalizado.');
            this.render(document.getElementById('app'));
        } catch (err) {
            localStorage.setItem('demo_entrega', JSON.stringify({
                entrega: {
                    metodo: this.metodo,
                    direccion: direccion || 'Presencial Municipalidad de Baradero',
                    estado: 'completado',
                    created_at: new Date().toISOString()
                }
            }));
            Toast.success('¡Trámite de licencia finalizado con éxito! (Modo Demo)');
            this.render(document.getElementById('app'));
        }
    }
}
