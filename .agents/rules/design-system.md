# Design System — TramitesBAR

## Paleta de Colores

### Primarios — Azul Institucional Sobrio
| Token | Hex | Uso |
|-------|-----|-----|
| `--blue-900` | `#0F2444` | Texto hero, acentos máximos |
| `--blue-800` | `#1B3A6B` | Primary hover, headers |
| `--blue-700` | `#234B89` | Bordes activos |
| `--blue-600` | `#2D5FA0` | **Primary** — botones, links, acentos |
| `--blue-500` | `#3A73B5` | Hover suave |
| `--blue-400` | `#5B9BD5` | Acento celeste sutil |
| `--blue-300` | `#89B8E4` | Bordes decorativos |
| `--blue-200` | `#B3D4F1` | Fondos de badges info |
| `--blue-100` | `#D6E8F8` | Primary light |
| `--blue-50` | `#EDF3FA` | Primary soft, fondos tenues |

### Fondos y Superficies
| Token | Hex | Uso |
|-------|-----|-----|
| `--bg` | `#F5F7FA` | Fondo general de la app |
| `--bg-card` | `#FFFFFF` | Fondo de tarjetas |
| `--bg-elevated` | `#FAFBFD` | Fondos elevados (dropdowns, popovers) |

### Bordes
| Token | Hex | Uso |
|-------|-----|-----|
| `--border` | `#E2E8F0` | Borde default |
| `--border-hover` | `#CBD5E1` | Borde hover |

### Texto
| Token | Hex | Uso |
|-------|-----|-----|
| `--text-primary` | `#2D3748` | Texto principal (gris carbón) |
| `--text-secondary` | `#4A5568` | Texto secundario |
| `--text-muted` | `#A0AEC0` | Texto apagado, placeholders |
| `--text-inverse` | `#FFFFFF` | Texto sobre fondo oscuro |

### Estados
| Token | Hex |
|-------|-----|
| `--success` | `#38A169` |
| `--warning` | `#D69E2E` |
| `--danger` | `#E53E3E` |
| `--info` | `#3182CE` |

## Principios de Diseño

1. **Minimalismo**: Espaciado generoso, aire visual, nada de saturación
2. **Sobriedad institucional**: Colores azules desaturados, tipografía limpia
3. **Glassmorphism sutil**: `blur(8px)`, `rgba(255,255,255,0.92)`, bordes finos `1px solid var(--border)`
4. **Modo claro por defecto**: Dark mode disponible con toggle, no agresivo
5. **Tipografía Inter**: Pesos 300 (light) a 800 (extra-bold), nunca 900
6. **Sombras suaves**: Sin tinte de color, `rgba(0,0,0,0.04)` para sm, `rgba(0,0,0,0.08)` para md
7. **Radios consistentes**: sm=8px, md=12px, lg=16px, xl=24px
8. **Transiciones**: `cubic-bezier(0.4, 0, 0.2, 1)`, nunca más de 300ms
9. **Sidebar colapsable**: Layout principal con sidebar izquierda (240px expandida, 64px colapsada)
10. **Inspiración**: ViDi Villa María (limpieza, secciones blancas redondeadas) + Avantix (estructura, cards)
