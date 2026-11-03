Analizar y testear las funcionalidades de todos los paneles de administración y el flujo completo del trámite de principio a fin, verificando que los pasos funcionen de forma correcta y estén bien organizados sin superponerse, asegurando que nadie con multas pueda completar el alta de usuario, y entregar un informe de diagnóstico y recomendaciones de eficiencia sin modificar el código fuente.

Working directory: c:\Users\PC\Desktop\marconecangrejodejaderobarenmiclub\TramitesBAR
Integrity mode: development

## Requirements

### R1. Análisis y prueba integral de paneles admin y flujo del trámite
Analizar y testear paso a paso y de principio a fin todas las funcionalidades de los paneles de administración y cada una de las etapas requeridas para completar el trámite, verificando que funcionen correctamente, que estén bien organizados entre sí en el orden correspondiente y que no existan superposiciones ni bloqueos de flujo, asegurando que el usuario pueda avanzar paso por paso sin inconvenientes y que cada administrador pueda realizar su tarea respectiva.

### R2. Verificación estricta del control de multas en el alta de usuario
Verificar paso por paso, sin saltear nada, la funcionalidad de comprobación de multas (conforme a las directivas del panel admin cuentas), validando de forma rigurosa la regla de negocio fundamental: si una persona tiene multas pendientes no se le debe permitir terminar de crear el usuario.

### R3. Informe de diagnóstico, evaluación y recomendaciones de eficiencia
Elaborar y entregar un informe detallado que documente el resultado de las pruebas de cada panel y etapa, detallando si todo está en orden o qué elementos presentan fallas, inconsistencias o desorganización, e incluir recomendaciones concretas para optimizar la eficiencia y orden del proceso (alcance de solo informe, sin introducir modificaciones en el código fuente).

## Acceptance Criteria

### Cobertura de paneles y flujo del trámite
- [ ] Se ejecutan pruebas de integración/E2E y validación de endpoints y flujos en el entorno local sobre cada uno de los paneles de administración y etapas del trámite de principio a fin, sin omitir ninguna etapa.
- [ ] Se verifica que el orden secuencial de los pasos sea consistente y que no existan superposiciones ni interferencias entre las distintas tareas administrativas ni en el camino del usuario.
- [ ] Se comprueba explícitamente mediante pruebas que un usuario con multas registradas no puede completar la creación/registro de su cuenta, mientras que un usuario sin multas puede continuar normalmente.

### Entrega del informe
- [ ] El informe final detalla el estado funcional (aprobado / con fallas / con inconsistencias) de cada panel de administración y de cada paso del trámite.
- [ ] El informe documenta de forma explícita los puntos críticos, cuellos de botella o desajustes detectados.
- [ ] Se incluye una sección de recomendaciones de mejora y optimización de eficiencia para el flujo general y las tareas de los administradores.
- [ ] No se modifican los archivos de código fuente existentes del proyecto durante la ejecución de esta auditoría.
