# Reglas de Arquitectura y Buenas Prácticas de Software

Para mantener la calidad, escalabilidad y orden profesional en este proyecto, se deben seguir estrictamente estas reglas:

## 1. Separación de Dominios y Bounded Contexts (DDD)
- **Dominio General Municipal (`Mi Baradero`)**: Maneja la identidad ciudadana única (DNI, Google OAuth), el Legajo Digital del Ciudadano, tasas tributarias generales (TSU, Patente), trámites administrativos y la Central 147.
- **Dominio Específico de Ambiente (`SUBI Ambiente`)**: Maneja trámites ambientales especializados (poda, extracción, punto de ramas, registro de podadores, recetas agronómicas e inspecciones de agrónomos).
- Las tablas y servicios de dominios específicos deben llevar su prefijo correspondiente (ej: `ambiente_*`) y relacionarse con la identidad central mediante claves foráneas explícitas (`id_usuario`).

## 2. Inversión de Dependencias y Arquitectura Limpia
- El núcleo de negocio (entidades, cálculos y validaciones) no debe depender de bibliotecas externas de UI ni de frameworks web.
- Las consultas y modificaciones a base de datos deben estar encapsuladas y tipadas.

## 3. Patrón CQRS (Command Query Responsibility Segregation)
- Las operaciones de modificación de datos (Commands) validan reglas de negocio y generan eventos/trazabilidad en auditoría.
- Las operaciones de lectura (Queries) devuelven DTOs optimizados y limpios para el frontend.

## 4. No Hardcodeo y Tolerancia a Fallos
- Todo dato presentado en el frontend debe provenir de la API o base de datos.
- El frontend debe incluir manejo de errores y estados de carga para garantizar que la interfaz nunca se rompa ante cortes de conexión.
