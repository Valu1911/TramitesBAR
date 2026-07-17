/**
 * Página de Examen Teórico - 5 preguntas, un solo intento
 */
class ExamenPage {
    static preguntas = [];
    static currentQ = 0;
    static answers = {};

    static async render(app) {
        app.innerHTML = `
        ${renderBackHeader('Examen teórico')}
        <div class="page-content container-md">
            <div class="text-center" style="padding:40px 0">
                <div class="spinner" style="margin:0 auto"></div>
                <p class="text-muted mt-3">Cargando examen...</p>
            </div>
        </div>`;

        try {
            const data = await ApiService.getPreguntas();

            if (data.ya_rendido) {
                this.renderResult(app, data);
                return;
            }

            this.preguntas = data.preguntas;
            this.currentQ = 0;
            this.answers = {};
            this.renderExam(app);
        } catch (err) {
            app.innerHTML = `
            ${renderBackHeader('Examen teórico')}
            <div class="page-content container-md">
                <div class="info-box info-box--warning">
                        <span style="display:flex;align-items:center">${Icons.alert}</span>
                    <span>${err.message}</span>
                </div>
                <button class="btn btn-outline btn-block mt-4" onclick="Router.navigate('dashboard')">Volver al panel</button>
            </div>`;
        }
    }

    static renderExam(app) {
        const q = this.preguntas[this.currentQ];
        const options = [
            { key: 'a', text: q.opcion_a },
            { key: 'b', text: q.opcion_b },
            { key: 'c', text: q.opcion_c },
            { key: 'd', text: q.opcion_d }
        ];

        const allAnswered = Object.keys(this.answers).length === this.preguntas.length;

        app.innerHTML = `
        ${renderBackHeader('Examen teórico')}
        <div class="page-content container-md animate-fadeIn">
            <!-- Progress dots -->
            <div style="display:flex;gap:8px;justify-content:center;margin-bottom:20px">
                ${this.preguntas.map((_, i) => `
                <div style="width:10px;height:10px;border-radius:50%;transition:all 0.2s;
                    background:${i === this.currentQ ? 'var(--primary)' : (this.answers[this.preguntas[i].id] ? 'var(--blue-300)' : 'var(--blue-100)')}">
                </div>`).join('')}
            </div>

            <div style="text-align:right;margin-bottom:12px">
                <span class="text-xs text-muted font-semibold">${this.currentQ + 1}/${this.preguntas.length}</span>
            </div>

            <div class="glass-card p-5 mb-4">
                <h2 style="font-size:0.95rem;font-weight:700;margin-bottom:16px">${q.pregunta}</h2>
                <div class="stack">
                    ${options.map(opt => `
                    <button class="exam-option ${this.answers[q.id] === opt.key ? 'exam-option--selected' : ''}"
                            onclick="ExamenPage.selectAnswer(${q.id}, '${opt.key}')">
                        ${opt.text}
                    </button>`).join('')}
                </div>
            </div>

            <div style="display:flex;gap:12px">
                ${this.currentQ > 0 ? `
                <button class="btn btn-outline" style="flex:1" onclick="ExamenPage.prevQuestion()">
                    ← Anterior
                </button>` : ''}

                ${this.currentQ < this.preguntas.length - 1 ? `
                <button class="btn btn-primary" style="flex:1" 
                        ${!this.answers[q.id] ? 'disabled' : ''}
                        onclick="ExamenPage.nextQuestion()">
                    Siguiente →
                </button>` : `
                <button class="btn btn-primary" style="flex:1" 
                        ${!allAnswered ? 'disabled' : ''}
                        onclick="ExamenPage.submitExam()">
                    Entregar examen
                </button>`}
            </div>

            <div class="info-box info-box--info mt-4">
                <span style="display:flex;align-items:center">${Icons.info}</span>
                <span>Examen de ${this.preguntas.length} preguntas · 1 solo intento · Mínimo 4 correctas para aprobar</span>
            </div>
        </div>`;
        if (window.Tutorial) setTimeout(() => window.Tutorial.startTutorialWithContext('examen'), 300);
    }

    staticic selectAnswer(questionId, answer) {
        this.answers[questionId] = answer;
        this.renderExam(document.getElementById('app'));
    }

    static nextQuestion() {
        if (this.currentQ < this.preguntas.length - 1) {
            this.currentQ++;
            this.renderExam(document.getElementById('app'));
        }
    }

    static prevQuestion() {
        if (this.currentQ > 0) {
            this.currentQ--;
            this.renderExam(document.getElementById('app'));
        }
    }

    static async submitExam() {
        if (!confirm('¿Estás seguro? Solo tenés un intento para rendir el examen.')) return;

        const app = document.getElementById('app');
        app.innerHTML = `
        ${renderBackHeader('Examen teórico')}
        <div class="page-content container-md text-center" style="padding-top:60px">
            <div class="spinner" style="margin:0 auto"></div>
            <p class="text-muted mt-3">Corrigiendo examen...</p>
        </div>`;

        try {
            const result = await ApiService.entregarExamen(this.answers);
            this.renderResult(app, result);
        } catch (err) {
            Toast.error(err.message);
            this.renderExam(app);
        }
    }

    static renderResult(app, result) {
        const passed = result.aprobado;

        app.innerHTML = `
        ${renderBackHeader('Resultado')}
        <div class="page-content container-md text-center animate-slideUp" style="padding-top:40px">
            <div class="result-circle ${passed ? 'result-circle--pass' : 'result-circle--fail'}">
                ${passed ? '✅' : '❌'}
            </div>
            <h2 style="font-size:1.5rem;font-weight:800;margin-bottom:8px">
                ${passed ? '¡Aprobaste!' : 'No aprobaste'}
            </h2>
            <p class="text-muted">
                Respondiste correctamente ${result.puntaje} de ${result.total} preguntas.
            </p>

            ${!passed ? `
            <div class="info-box info-box--warning mt-4" style="text-align:left">
                <span>⚠️</span>
                <span>Solo tenías un intento. Contactá a la municipalidad para más información.</span>
            </div>` : `
            <div class="info-box info-box--success mt-4" style="text-align:left">
                <span>✅</span>
                <span>¡Excelente! Podés continuar con los formularios de salud.</span>
            </div>`}

            <button class="btn btn-primary btn-block btn-lg mt-4" onclick="Router.navigate('dashboard')">
                Volver al panel
            </button>
        </div>`;
    }
}
