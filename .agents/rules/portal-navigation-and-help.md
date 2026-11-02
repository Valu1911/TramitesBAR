# Portal Navigation, Information Architecture & Help Routing

1. **Keep Landing Pages Focused**: Do not bloat the public authentication landing page with extensive legal disclosures, multi-step tutorials, or long FAQ blocks. Keep the landing page clean, fast, and oriented toward authentication and primary procedure lookups.
2. **Dedicated FAQ & Help Page**: Auxiliary informational content (registration steps, authentication levels, accessibility standards, legal terms, privacy policies, contact centers) must live in a dedicated Help & FAQ page (`preguntas-frecuentes.html`).
3. **Deep-linking from Footer**: Footer links must never be empty dummy anchors (`#`). They must point directly to explicit hash targets (e.g., `preguntas-frecuentes.html#terminos`, `preguntas-frecuentes.html#como-registrarse`), and the destination page must automatically expand the corresponding item, apply a focus/highlight animation, and smoothly scroll to it.
4. **Header Accessibility**: Provide a concise, prominent secondary navigation button ("AYUDA") adjacent to the primary "INGRESAR" action in the topbar, fully responsive across all device breakpoints.
5. **Design System Consistency**: Auxiliary pages must strictly maintain the official CiDi visual language (color tokens, Inter typography, pill buttons, badges, subtle wave or gradient headers, and accessible touch targets).
