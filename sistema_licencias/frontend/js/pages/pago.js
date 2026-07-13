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
            app.innerHTML = `
            ${renderBackHeader('Pago del arancel')}
            <div class="page-content container-md">
                <div class="info-box info-box--warning">
                    <span style="display:flex;align-items:center">${Icons.alert}</span>
                    <span>${err.message}</span>
                </div>
                <button class="btn btn-outline btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
        }
    }

    static renderContent(app, data) {
        if (data.pago) {
            const p = data.pago;
            const statusMap = {
                'pendiente': { icon: Icons.clock, title: 'Pago en revisión', desc: 'Tu comprobante fue enviado. Un administrador lo validará a la brevedad.', badge: 'badge-pending' },
                'aprobado': { icon: Icons.check, title: '¡Pago confirmado!', desc: 'Tu pago fue aprobado. Podés continuar con el trámite.', badge: 'badge-success' },
                'rechazado': { icon: Icons.x, title: 'Pago rechazado', desc: 'Motivo: ' + (p.observaciones_admin || 'Sin observaciones'), badge: 'badge-danger' }
            };
            const st = statusMap[p.estado] || statusMap['pendiente'];

            app.innerHTML = `
            ${renderBackHeader('Pago del arancel')}
            <div class="page-content container-md animate-slideUp">
                <div class="waiting-status ${p.estado === 'pendiente' ? 'waiting-status--pending' : ''}">
                    <div class="waiting-status__icon" style="display:flex;align-items:center;justify-content:center">${st.icon}</div>
                    <h2 class="font-bold" style="font-size:1.25rem;margin-bottom:8px">${st.title}</h2>
                    <span class="badge ${st.badge}">${p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}</span>
                    <p class="text-muted text-sm mt-3">${st.desc}</p>
                </div>
                <button class="btn btn-primary btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
            return;
        }

        // Sin pago registrado - mostrar opciones
        const monto = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(data.monto);

        app.innerHTML = `
        ${renderBackHeader('Pago del arancel')}
        <div class="page-content container-md animate-slideUp">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
                <span style="font-size:1.5rem;color:var(--primary);display:flex;align-items:center">${Icons.card}</span>
                <div>
                    <h1 style="font-size:1.1rem;font-weight:700">Centro de Comercio</h1>
                    <p class="text-sm text-muted">Aboná el arancel de tu licencia de conducir</p>
                </div>
            </div>

            <!-- Monto -->
            <div class="glass-card p-5 text-center mb-4">
                <p class="text-xs text-muted">Monto a pagar</p>
                <p style="font-size:2rem;font-weight:800;color:var(--text-primary);margin:4px 0">${monto}</p>
                <p class="text-xs text-muted">Arancel licencia de conducir - Municipalidad de Baradero</p>
            </div>

            <!-- Métodos -->
            <h2 class="section-title mb-3">Elegí cómo pagar</h2>
            <div class="stack mb-4" id="payMethods">
                <div class="payment-method ${this.metodoSeleccionado === 'transferencia' ? 'payment-method--selected' : ''}"
                     onclick="PagoPage.selectMethod('transferencia')">
                    <div class="payment-method__icon" style="display:flex;align-items:center;justify-content:center">${Icons.bank}</div>
                    <div style="flex:1">
                        <h3 class="font-semibold text-sm">Transferencia bancaria</h3>
                        <p class="text-xs text-muted">Pagá con alias, CBU o QR interoperable</p>
                    </div>
                </div>
                <div class="payment-method ${this.metodoSeleccionado === 'debito' ? 'payment-method--selected' : ''}"
                     onclick="PagoPage.selectMethod('debito')">
                    <div class="payment-method__icon" style="display:flex;align-items:center;justify-content:center">${Icons.card}</div>
                    <div style="flex:1">
                        <h3 class="font-semibold text-sm">Tarjeta de débito</h3>
                        <p class="text-xs text-muted">Ingresá los datos de tu tarjeta</p>
                    </div>
                </div>
            </div>

            <div id="payDetails"></div>
        </div>`;

        if (this.metodoSeleccionado) {
            this.renderPayDetails(data);
        }
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

        if (this.metodoSeleccionado === 'transferencia') {
            container.innerHTML = `
            <div class="glass-card p-5 animate-slideUp">
                <h3 class="font-semibold text-sm mb-3">Datos para transferir</h3>
                <div class="stack">
                    <div class="copy-box">
                        <div>
                            <div class="copy-box__label">Alias</div>
                            <div class="copy-box__value">${data.alias}</div>
                        </div>
                        <button class="btn btn-ghost btn-sm" style="display:flex;align-items:center" onclick="PagoPage.copyText('${data.alias}')">${Icons.copy}</button>
                    </div>
                    <div class="copy-box">
                        <div>
                            <div class="copy-box__label">CBU</div>
                            <div class="copy-box__value">${data.cbu}</div>
                        </div>
                        <button class="btn btn-ghost btn-sm" style="display:flex;align-items:center" onclick="PagoPage.copyText('${data.cbu}')">${Icons.copy}</button>
                    </div>

                    <div class="text-center p-4">
                        <div style="width:160px;height:160px;margin:0 auto;background:var(--bg);border-radius:var(--radius-lg);border:2px dashed var(--border);display:flex;align-items:center;justify-content:center">
                            <span style="font-size:3rem;color:var(--text-muted);display:flex;align-items:center;justify-content:center">${Icons.smartphone}</span>
                        </div>
                        <p class="text-xs text-muted mt-2">Escaneá el QR desde tu app bancaria</p>
                    </div>

                    <button class="btn btn-primary btn-block" onclick="PagoPage.showUploadReceipt()">
                        Ya transferí, continuar →
                    </button>
                </div>
            </div>

            <div id="receiptUpload" class="mt-4" style="display:none"></div>`;
        } else if (this.metodoSeleccionado === 'debito') {
            container.innerHTML = `
            <div class="glass-card p-5 animate-slideUp">
                <h3 class="font-semibold text-sm mb-3">Datos de la tarjeta de débito</h3>
                <form onsubmit="PagoPage.handleDebitPay(event)">
                    <div class="stack">
                        <div class="form-group">
                            <input type="text" id="cardNumber" class="form-input" placeholder="Número de tarjeta" 
                                   inputmode="numeric" maxlength="19" required>
                        </div>
                        <div class="form-group">
                            <input type="text" id="cardName" class="form-input" placeholder="Nombre del titular" required>
                        </div>
                        <div class="grid-2">
                            <div class="form-group">
                                <input type="text" id="cardExpiry" class="form-input" placeholder="MM/AA" maxlength="5" required>
                            </div>
                            <div class="form-group">
                                <input type="password" id="cardCvv" class="form-input" placeholder="CVV" 
                                       inputmode="numeric" maxlength="4" required>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block" id="debitBtn">
                            Pagar ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(data.monto)}
                        </button>
                    </div>
                </form>
            </div>`;
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
            Toast.error(err.message);
            btn.disabled = false;
            btn.textContent = 'Enviar comprobante';
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
                numero_tarjeta: document.getElementById('cardNumber').value,
                nombre_titular: document.getElementById('cardName').value
            });

            // Simular procesamiento
            await new Promise(r => setTimeout(r, 2000));
            Toast.success('¡Pago registrado exitosamente!');
            this.render(app);
        } catch (err) {
            Toast.error(err.message);
            btn.disabled = false;
            btn.textContent = 'Pagar';
        }
    }
}
