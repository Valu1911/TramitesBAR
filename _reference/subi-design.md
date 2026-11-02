## SUBI Design System — Decisiones de Diseño

Este proyecto sigue mockups de referencia específicos para ambos modos (light/dark).

### Modo Claro (Light)
- Fondo general: blanco puro / slate muy suave (`#f8fafc` o `#ffffff` según mockup)
- Cards/paneles: blanco (`#ffffff`) con bordes sutiles (`#e2e8f0` / `#e5e7eb`) y sombras suaves
- Sidebar: fondo blanco (`#ffffff`), ítem activo con fondo azul claro (`#e0f2fe` / `#dbeafe`) y texto/ícono azul (`#0284c7`)
- Acentos: azul sky / municipal (`#0284c7` / `#0ea5e9`)
- Tipografía: Inter, pesos limpios, jerarquía clara

### Modo Oscuro (Dark)
- Mantener la estética dark slate profunda (`#0b0f17`, `#111827`, `#1e293b`)
- Cards en `#131b2e` o `#1e293b` con bordes sutiles `#1e293b` / `#334155`
- Acentos brillantes y contrastes legibles

### Layout (App Shell)
- **Desktop**: Sidebar SIEMPRE visible y fijo a la izquierda (~240px-260px), topbar superior con buscador y perfil, contenido principal centrado/amplio
- **Mobile**: Sidebar oculto (drawer vía hamburger), bottom navigation bar fijo con 5 ítems (Inicio, Trámites, 147, Legajo, Más)
- En mobile, el home dashboard muestra una **card compacta de legajo/trámite activo** ("Mi legajo digital" - ej: Poda de Árbol Urbano #2026-089 con botón "Ver estado de solicitud") arriba de los trámites en curso

### Banner "Una Sola Vez"
- Gradiente azul vibrante con texto blanco, chip/tag "MENOS FILAS, MÁS TIEMPO PARA VOS", botón blanco/estilizado "Conocé más"
- Incluye la **ilustración/mockup de notebook/laptop moderna** mostrando el checkmark verde de validación en pantalla, alineada a la derecha del banner
- No usar SVG básico plano sin profundidad

### Novedades
- Placeholders de imágenes elegantes y limpios con layout de tarjeta horizontal con thumbnail a la izquierda y fecha/título a la derecha

### Consistencia en todo el portal
- TODAS las páginas del portal (Inicio, Trámites, Tasas, Legajo, Atención 147, etc.) deben respetar la misma coherencia visual
- Estilos aplicados mediante clases CSS bien estructuradas, evitando inline styles en JavaScript
