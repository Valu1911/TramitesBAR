/**
 * Página de Pago - Centro de Comercio
 */
class PagoPage {
    static metodoSeleccionado = null;
    static comprobante = null;

    static async render(app) {
        this.metodoSeleccionado = null;
        this.comprobante = null;

        app.innerHTML = `
        ${renderBackHeader('Pago del arancel')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando información de pago...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getPagosInfo();
            this.renderContent(app, data);
        } catch (err) {
            const demoPago = JSON.parse(localStorage.getItem('demo_pago') || 'null');
            this.renderContent(app, {
                pago: demoPago,
                monto: 15000,
                alias: 'BARADERO.LICENCIAS',
                cbu: '0140027401620001234567'
            });
            if (err && err.status === 403) {
                Toast.info('Modo Demo: Sección de Pago del Arancel.');
            }
        }
    }

    static renderContent(app, data) {
        if (data.pago) {
            const p = data.pago;
            const statusMap = {
                'pendiente': { icon: Icons.clock, bg: '#fef3c7', color: '#b45309', title: 'Comprobante en Auditoría', desc: 'Tu comprobante de pago fue recibido. La Tesorería Municipal de Baradero lo verificará a la brevedad.', badge: 'badge-warning', badgeText: 'En Verificación' },
                'aprobado': { icon: Icons.check, bg: '#dcfce7', color: '#15803d', title: '¡Pago Acreditado con Éxito!', desc: 'El arancel oficial fue validado. Podés continuar con la reserva de tu turno práctico en pista.', badge: 'badge-success', badgeText: 'Pago Aprobado' },
                'rechazado': { icon: Icons.x, bg: '#fee2e2', color: '#b91c1c', title: 'Comprobante Rechazado', desc: 'Motivo: ' + (p.observaciones_admin || 'Comprobante ilegible o transferencia no acreditada. Por favor reintentá.'), badge: 'badge-danger', badgeText: 'Rechazado' }
            };
            const st = statusMap[p.estado] || statusMap['pendiente'];

            app.innerHTML = `
            ${renderBackHeader('Arancel Municipal de Licencia')}
            <div class="page-content container-md animate-slideUp" style="max-width:760px;margin:0 auto;padding-top:14px;">
                <div class="dash-card text-center mb-4" style="border:1.5px solid #e2e8f0;padding:36px 24px;">
                    <div style="width:72px;height:72px;border-radius:50%;background:${st.bg};color:${st.color};display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 16px auto;">
                        ${st.icon}
                    </div>
                    <span class="badge ${st.badge} mb-2" style="font-size:0.8rem;padding:4px 12px;font-weight:700;">${st.badgeText}</span>
                    <h2 style="font-size:1.35rem;font-weight:800;color:#1e293b;margin-bottom:6px;">${st.title}</h2>
                    <p style="font-size:0.88rem;color:#64748b;margin:0 auto 20px auto;max-width:520px;">${st.desc}</p>

                    <div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto;">
                        ${p.estado === 'aprobado' ? `
                        <button class="btn btn-primary btn-block btn-lg" style="font-weight:700" onclick="Router.navigate('practico')">
                            Avanzar a Turno Práctico →
                        </button>` : `
                        <button class="btn btn-primary btn-block" style="font-weight:700" onclick="saltarDemoPaso('practico')">
                            ⚡ Modo Demo: Aprobar Pago y Avanzar a Práctico
                        </button>`}
                        
                        <button class="btn btn-outline btn-block btn-sm" onclick="PagoPage.reiniciarPago()">
                            🔄 Cambiar método / Reintentar pago
                        </button>
                        <button class="btn btn-ghost btn-block btn-sm" onclick="Router.navigate('dashboard')">
                            Volver al Panel Principal
                        </button>
                    </div>
                </div>
            </div>`;
            return;
        }

        // Sin pago registrado - mostrar opciones
        const monto = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(data.monto);

        app.innerHTML = `
        ${renderBackHeader('Pago de Tasas y Arancel')}
        <div class="page-content container-md animate-slideUp" style="max-width:880px;margin:0 auto;padding-top:12px;">
            
            <!-- TARJETA KPI DE MONTO (Estilo Tasas SUBI) -->
            <div class="dash-card mb-4" style="background:linear-gradient(135deg, #0d47a1 0%, #1565c0 60%, #0284c7 100%);color:#ffffff;border:none;box-shadow:0 10px 25px -5px rgba(21, 101, 192, 0.4);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:12px;">
                    <div>
                        <span style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.25);border-radius:9999px;padding:3px 12px;font-size:0.75rem;font-weight:700;color:#e0f2fe;display:inline-block;margin-bottom:8px;">
                            TASAS MUNICIPALES · BARADERO
                        </span>
                        <h1 style="font-size:1.3rem;font-weight:800;margin:0;color:#ffffff;">Arancel de Emisión de Licencia</h1>
                        <p style="font-size:0.82rem;color:#bfdbfe;margin:0;">Sellado de Tránsito, examen de aptitud y tasa administrativa provincial.</p>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem;color:#bfdbfe;text-transform:uppercase;font-weight:600;display:block;">Total a Regularizar</span>
                        <span style="font-size:2.2rem;font-weight:900;color:#ffffff;line-height:1;">${monto}</span>
                    </div>
                </div>
            </div>

            <!-- MÉTODOS DE PAGO -->
            <div class="dash-card mb-4">
                <div class="card-header-row">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="width:34px;height:34px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </div>
                        <div>
                            <h2 style="font-size:1.05rem;font-weight:800;margin:0;color:#1e293b;">Seleccioná el Método de Pago</h2>
                            <p style="font-size:0.78rem;color:#64748b;margin:0;">Podés abonar por transferencia inmediata, tarjeta de débito o probar en modo demo.</p>
                        </div>
                    </div>
                </div>

                <div class="grid-3" style="gap:12px;margin-bottom:16px;" id="payMethods">
                    <div class="payment-method ${this.metodoSeleccionado === 'demo' ? 'payment-method--selected' : ''}"
                         style="border:1.5px solid ${this.metodoSeleccionado === 'demo' ? '#f59e0b' : '#fed7aa'};background:${this.metodoSeleccionado === 'demo' ? '#fef3c7' : '#fffaf0'};border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;"
                         onclick="PagoPage.selectMethod('demo')">
                        <div style="width:36px;height:36px;border-radius:50%;background:#fef3c7;color:#b45309;display:flex;align-items:center;justify-content:center;font-weight:bold;margin-bottom:8px;">⚡</div>
                        <h3 style="font-weight:800;font-size:0.9rem;color:#92400e;margin-bottom:2px;">Modo Demo Instantáneo</h3>
                        <p style="font-size:0.76rem;color:#b45309;margin:0;">Aprobación inmediata sin costo para evaluar el flujo</p>
                    </div>

                    <div class="payment-method ${this.metodoSeleccionado === 'transferencia' ? 'payment-method--selected' : ''}"
                         style="border:1.5px solid ${this.metodoSeleccionado === 'transferencia' ? '#0284c7' : '#e2e8f0'};background:${this.metodoSeleccionado === 'transferencia' ? '#e0f2fe' : '#ffffff'};border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;"
                         onclick="PagoPage.selectMethod('transferencia')">
                        <div style="width:36px;height:36px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;margin-bottom:8px;">${Icons.bank}</div>
                        <h3 style="font-weight:800;font-size:0.9rem;color:#1e293b;margin-bottom:2px;">Transferencia Bancaria</h3>
                        <p style="font-size:0.76rem;color:#64748b;margin:0;">Alias, CBU oficial o QR Interoperable</p>
                    </div>

                    <div class="payment-method ${this.metodoSeleccionado === 'debito' ? 'payment-method--selected' : ''}"
                         style="border:1.5px solid ${this.metodoSeleccionado === 'debito' ? '#0284c7' : '#e2e8f0'};background:${this.metodoSeleccionado === 'debito' ? '#e0f2fe' : '#ffffff'};border-radius:12px;padding:16px;cursor:pointer;transition:all 0.2s;"
                         onclick="PagoPage.selectMethod('debito')">
                        <div style="width:36px;height:36px;border-radius:50%;background:#e0f2fe;color:#0284c7;display:flex;align-items:center;justify-content:center;margin-bottom:8px;">${Icons.card}</div>
                        <h3 style="font-weight:800;font-size:0.9rem;color:#1e293b;margin-bottom:2px;">Tarjeta de Débito</h3>
                        <p style="font-size:0.76rem;color:#64748b;margin:0;">Visa Débito, Mastercard Débito, Maestro</p>
                    </div>
                </div>

                <div id="payDetails"></div>
            </div>

        </div>`;

        if (this.metodoSeleccionado) {
            this.renderPayDetails(data);
        }
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('pago'), 300);
    }

    static selectMethod(method) {
        this.metodoSeleccionado = method;
        // Re-render only details
        const app = document.getElementById('app');
        this.render(app);
    }

    static renderPayDetails(data) {
        const container = document.getElementById('payDetails');
        if (!container) return;

        if (this.metodoSeleccionado === 'demo') {
            container.innerHTML = `
            <div class="dash-card p-5 animate-slideUp text-center" style="border:1.5px solid #fed7aa;background:#fffaf0;">
                <h3 style="font-weight:800;font-size:1rem;color:#92400e;margin-bottom:6px;">⚡ Simulación de Pago (Modo Demo)</h3>
                <p style="font-size:0.82rem;color:#b45309;margin-bottom:16px;">Elegí el tipo de prueba que deseás realizar:</p>
                <div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto;">
                    <button class="btn btn-primary btn-block btn-lg" id="demoAdminBtn" style="font-weight:700" onclick="PagoPage.handleDemoAdminPay()">
                        📥 Enviar comprobante a Panel Admin (Auditoría Real)
                    </button>
                    <button class="btn btn-outline btn-block" style="border-color:#b45309;color:#b45309;font-weight:700" id="demoPayBtn" onclick="PagoPage.handleDemoPay()">
                        ⚡ Aprobación Inmediata Automática
                    </button>
                </div>
            </div>`;
        } else if (this.metodoSeleccionado === 'transferencia') {
            container.innerHTML = `
            <div class="dash-card p-5 animate-slideUp" style="border:1.5px solid #bae6fd;background:#f0f9ff;">
                <div class="card-header-row" style="margin-bottom:12px;">
                    <h3 style="font-weight:800;font-size:0.95rem;color:#1e293b;margin:0;">Datos Bancarios Oficiales de Baradero</h3>
                    <span class="badge badge-info" style="font-size:0.72rem;padding:2px 8px;">Cuenta Corriente</span>
                </div>
                
                <div class="stack" style="gap:12px;">
                    <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
                        <div>
                            <div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase;">Alias CBU</div>
                            <div style="font-size:1rem;font-weight:800;color:#0284c7;letter-spacing:0.5px;">${data.alias}</div>
                        </div>
                        <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;" onclick="PagoPage.copyText('${data.alias}')">
                            ${Icons.copy} Copiar Alias
                        </button>
                    </div>

                    <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:10px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;">
                        <div>
                            <div style="font-size:0.7rem;font-weight:700;color:#64748b;text-transform:uppercase;">CBU Bancario (Banco Provincia)</div>
                            <div style="font-size:0.95rem;font-weight:800;color:#1e293b;letter-spacing:0.5px;">${data.cbu}</div>
                        </div>
                        <button class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;font-weight:700;" onclick="PagoPage.copyText('${data.cbu}')">
                            ${Icons.copy} Copiar CBU
                        </button>
                    </div>

                    <div style="text-align:center;padding:16px 0;">
                        <div style="width:140px;height:140px;margin:0 auto;background:#ffffff;border-radius:14px;border:2px dashed #0284c7;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(2,132,199,0.1);">
                            <span style="font-size:2.8rem;color:#0284c7;display:flex;align-items:center;justify-content:center">${Icons.smartphone}</span>
                        </div>
                        <p style="font-size:0.78rem;color:#64748b;margin-top:8px;">Escaneá el código QR interoperable desde Mercado Pago o app bancaria</p>
                    </div>

                    <button class="btn btn-primary btn-block btn-lg" style="font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="PagoPage.showUploadReceipt()">
                        Ya realicé la transferencia, adjuntar comprobante
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </button>
                </div>
            </div>

            <div id="receiptUpload" class="mt-4" style="display:none"></div>`;
        } else if (this.metodoSeleccionado === 'debito') {
            container.innerHTML = `
            <div class="dash-card p-5 animate-slideUp">
                <div class="card-header-row">
                    <h3 style="font-weight:800;font-size:0.95rem;color:#1e293b;margin:0;">Pago Seguro con Tarjeta de Débito</h3>
                    <span class="badge badge-success" style="font-size:0.72rem;padding:2px 8px;">SSL 256-bit</span>
                </div>
                <form onsubmit="PagoPage.handleDebitPay(event)">
                    <div class="stack" style="gap:14px;">
                        <div class="form-group">
                            <label class="form-label font-bold">Número de Tarjeta</label>
                            <input type="text" id="cardNumber" class="form-input" placeholder="0000 0000 0000 0000" 
                                   inputmode="numeric" maxlength="19" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label font-bold">Nombre y Apellido del Titular</label>
                            <input type="text" id="cardName" class="form-input" placeholder="Como figura en el plástico" required>
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <label class="form-label font-bold">Vencimiento</label>
                                <input type="text" id="cardExpiry" class="form-input" placeholder="MM/AA" maxlength="5" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label font-bold">Código de Seguridad (CVV)</label>
                                <input type="password" id="cardCvv" class="form-input" placeholder="3 o 4 dígitos" 
                                       inputmode="numeric" maxlength="4" required>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block btn-lg" id="debitBtn" style="font-weight:700">
                            Abonar ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(data.monto)}
                        </button>
                    </div>
                </form>
            </div>`;
        }
    }

    static async handleDemoAdminPay() {
        const btn = document.getElementById('demoAdminBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando comprobante a Admin Pagos...'; }

        try {
            await ApiService.registrarPago({
                metodo: 'transferencia',
                monto: 12500.00,
                comprobante: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                auto_aprobar: false
            });
            Toast.warning('⚡ Pago enviado. Ingresá al Panel Admin (usuario: admin_pagos / clave: admin123) para verificar y aprobar.');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            if (btn) { btn.disabled = false; btn.textContent = '📥 Enviar pago a Admin Pagos (Probar verificación real)'; }
        }
    }

    static async handleDemoPay() {
        const btn = document.getElementById('demoPayBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Procesando pago demo...'; }

        try {
            await ApiService.registrarPago({ metodo: 'demo', auto_aprobar: true });
            Toast.success('⚡ Modo Demo: ¡Pago aprobado automáticamente!');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
            if (btn) { btn.disabled = false; btn.textContent = '⚡ Aprobar pago instantáneo →'; }
        }
    }

    static async reiniciarPago() {
        try {
            await ApiService.reiniciarPago();
            Toast.info('Se restablecieron las opciones de pago');
            this.render(document.getElementById('app'));
        } catch (err) {
            Toast.error(err.message);
        }
    }

    static copyText(text) {
        navigator.clipboard.writeText(text);
        Toast.success('Copiado al portapapeles');
    }

    static showUploadReceipt() {
        const container = document.getElementById('receiptUpload');
        if (!container) return;
        container.style.display = 'block';
        container.innerHTML = `
        <div class="glass-card p-5 animate-slideUp">
            <h3 class="font-semibold text-sm mb-2">Adjuntá el comprobante de pago</h3>
            <p class="text-xs text-muted mb-3">Subí una captura o foto del comprobante de transferencia.</p>
            
            <input type="file" id="receiptFile" accept="image/*" class="hidden" onchange="PagoPage.handleReceipt(event)">
            
            <div id="receiptPreviewArea">
                <div class="file-upload" onclick="document.getElementById('receiptFile').click()">
                    <div class="file-upload__icon" style="display:flex;align-items:center;justify-content:center">${Icons.upload}</div>
                    <div class="file-upload__text">Subir comprobante</div>
                </div>
            </div>

            <button class="btn btn-primary btn-block mt-3" id="submitReceiptBtn" disabled
                    onclick="PagoPage.submitTransferPayment()">
                Enviar comprobante
            </button>
        </div>`;
    }

    static handleReceipt(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            this.comprobante = ev.target.result;
            const preview = document.getElementById('receiptPreviewArea');
            preview.innerHTML = `
            <div class="file-preview">
                <img src="${ev.target.result}" alt="Comprobante">
                <button class="file-preview__remove" onclick="PagoPage.removeReceipt()">✕</button>
            </div>`;
            document.getElementById('submitReceiptBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }

    static removeReceipt() {
        this.comprobante = null;
        const preview = document.getElementById('receiptPreviewArea');
        preview.innerHTML = `
        <div class="file-upload" onclick="document.getElementById('receiptFile').click()">
            <div class="file-upload__icon" style="display:flex;align-items:center;justify-content:center">${Icons.upload}</div>
            <div class="file-upload__text">Subir comprobante</div>
        </div>`;
        document.getElementById('submitReceiptBtn').disabled = true;
    }

    static async submitTransferPayment() {
        const btn = document.getElementById('submitReceiptBtn');
        btn.disabled = true;
        btn.textContent = 'Enviando...';

        try {
            await ApiService.registrarPago({
                metodo: 'transferencia',
                comprobante: this.comprobante
            });
            Toast.success('Comprobante enviado correctamente');
            this.render(document.getElementById('app'));
        } catch (err) {
            localStorage.setItem('demo_pago', JSON.stringify({
                estado: 'pendiente',
                metodo: 'transferencia',
                monto: 15000,
                created_at: new Date().toISOString()
            }));
            Toast.success('Comprobante registrado correctamente (Modo Demo)');
            this.render(document.getElementById('app'));
        }
    }

    static async handleDebitPay(e) {
        e.preventDefault();
        const btn = document.getElementById('debitBtn');
        btn.disabled = true;
        btn.textContent = 'Procesando pago...';

        const app = document.getElementById('app');

        try {
            await ApiService.registrarPago({
                metodo: 'debito',
                numero_tarjeta: document.getElementById('cardNumber')?.value,
                nombre_titular: document.getElementById('cardName')?.value
            });

            await new Promise(r => setTimeout(r, 1000));
            Toast.success('¡Pago registrado exitosamente!');
            this.render(app);
        } catch (err) {
            localStorage.setItem('demo_pago', JSON.stringify({
                estado: 'aprobado',
                metodo: 'debito',
                monto: 15000,
                created_at: new Date().toISOString()
            }));
            Toast.success('¡Pago procesado exitosamente! (Modo Demo)');
            this.render(app);
        }
    }
}
