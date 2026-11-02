---
name: human-ux-ui-design
description: >-
  Diseño de interfaces (UX/UI) de nivel profesional, humanizado y sin apariencia de plantilla genérica de IA. Enfocado en simplicidad, alta conversión, microinteracciones fluidas, accesibilidad y diseño visual premium.
---

# Human-Centered UX/UI Design & Anti-AI Aesthetics Framework

Este skill proporciona principios, directrices de diseño y patrones de experiencia de usuario para construir interfaces de nivel profesional y de grado de autor. Elimina la apariencia de "plantilla genérica de IA" y prioriza la comodidad, claridad y rapidez para el usuario real.

---

## 1. Detección y Eliminación de "AI Template Smells"

Las plantillas genéricas de IA suelen cometer errores repetitivos de diseño. Este protocolo los erradica:

| Síntoma de "Plantilla IA" | Corrección de Diseño Humanizado |
| :--- | :--- |
| **Abuso de degradados morados/cian genéricos** | Paletas de color intencionales, basadas en la identidad institucional y psicología del color (azules cívicos profundos, verdes esmeralda sustentables). |
| **Glows y sombras neón excesivas** | Sombras multicapa suaves con dispersión natural (`box-shadow: 0 4px 20px -2px rgba(0, 15, 30, 0.08)`). |
| **Tarjetas idénticas sin jerarquía** | Jerarquía visual clara con contraste de pesos tipográficos, tamaños relativos y elementos destacados (*Hero Actions*). |
| **Animaciones lentas o innecesarias** | Microinteracciones ultrarrápidas (150ms - 250ms) con curvas `cubic-bezier(0.16, 1, 0.3, 1)` que aportan dinamismo sin demorar al usuario. |
| **Textos genéricos y robóticos** | Copywriting humano, empático, claro y conciso en tono directo y cercano ("Pagá tu boleta en 1 clic", "Tus documentos están al día"). |

---

## 2. Los 5 Mandamientos del UX Humanizado

```
      ┌───────────────────────────────────────────────┐
      │   1. LEY DE HICK: Reducir opciones complejas  │
      │      (Máximo 3 acciones primarias por vista)  │
      └───────────────────────┬───────────────────────┘
                              │
      ┌───────────────────────▼───────────────────────┐
      │   2. REGLA DE LOS 3 CLICS: Eficiencia total   │
      │      Cualquier trámite se inicia en < 3 pasos │
      └───────────────────────┬───────────────────────┘
                              │
      ┌───────────────────────▼───────────────────────┐
      │   3. FEEDBACK INSTANTÁNEO & OPTIMISTIC UI     │
      │      El usuario nunca espera sin respuesta    │
      └───────────────────────┬───────────────────────┘
                              │
      ┌───────────────────────▼───────────────────────┐
      │   4. DIVULGACIÓN PROGRESIVA (Simplicidad)     │
      │      Mostrar lo esencial, desplegar detalles  │
      └───────────────────────┬───────────────────────┘
                              │
      ┌───────────────────────▼───────────────────────┐
      │   5. ACCESIBILIDAD UNIVERSAL (WCAG 2.1 AA)    │
      │      Contraste alto, navegación por teclado   │
      └───────────────────────────────────────────────┘
```

---

## 3. Sistema de Tokens y Jerarquía Visual

### A. Tipografía y Escala Modular
Usar familias tipográficas modernas con excelente renderizado de fuentes (`Inter`, `Plus Jakarta Sans`, `Outfit`):

```css
:root {
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --font-size-xs: 0.75rem;    /* 12px - Badges, metadatos */
  --font-size-sm: 0.875rem;   /* 14px - Textos secundarios, inputs */
  --font-size-md: 1rem;       /* 16px - Texto base de lectura */
  --font-size-lg: 1.125rem;   /* 18px - Subtítulos destacados */
  --font-size-xl: 1.375rem;   /* 22px - Títulos de sección */
  --font-size-2xl: 1.75rem;   /* 28px - Encabezados principales */
}
```

### B. Manejo del Espacio en Blanco (Whitespace)
El espacio en blanco no es espacio vacío; es una herramienta de descanso cognitivo.
- **Espaciado interior (Padding de tarjetas):** Mínimo `24px` a `32px`.
- **Separación entre secciones:** Mínimo `32px` a `48px`.

---

## 4. Patrones de Microinteracciones y Estados

### A. Estados Vacíos Empáticos (Empty States)
Nunca dejar un contenedor vacío sin instrucciones claras:

```html
<div class="empty-state">
  <div class="empty-state-icon">📄</div>
  <h3 class="empty-state-title">No tenés trámites pendientes</h3>
  <p class="empty-state-desc">Todos tus expedientes municipales se encuentran al día. Podés iniciar una nueva solicitud cuando lo necesites.</p>
  <button class="btn btn-primary">Iniciar Nuevo Trámite</button>
</div>
```

### B. Skeleton Loaders vs Spinners
Para cargas de datos, usar *Skeletons* pulsantes en lugar de spinners genéricos. Los skeletons reducen la percepción de tiempo de espera en un 38%:

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface-hover) 25%, var(--border-default) 50%, var(--surface-hover) 75%);
  background-size: 200% 100%;
  animation: skeletonPulse 1.5s ease-in-out infinite;
  border-radius: var(--radius-sm);
}

@keyframes skeletonPulse {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 5. Checklist de Calidad UX/UI para Entregables

Antes de dar por finalizada cualquier pantalla o componente:

1. [ ] **¿Se entiende en 3 segundos?** ¿Un usuario de cualquier edad sabe qué hacer inmediatamente?
2. [ ] **¿Tiene feedback visual?** ¿Los botones muestran estado de hover, foco y estado de carga (`loading`)?
3. [ ] **¿El contraste es óptimo?** ¿Los textos en modo claro y modo oscuro cumplen con ratio >= 4.5:1?
4. [ ] **¿Es responsivo en móviles?** ¿Los botones tienen área táctil de al menos `44px x 44px`?
5. [ ] **¿La información está organizada por relevancia?** ¿Lo más importante está visible sin necesidad de scroll excesivo?
