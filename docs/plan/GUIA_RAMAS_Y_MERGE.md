# Guía de ramas, distribución del plan y merge

Fecha: 2026-11-02
Repositorio: `C:\Users\Usuario\desktop\pasantia\licencias\tramitesBAR`
Remoto: `https://github.com/Valu1911/TramitesBAR`

---

## 1. Estado actual

Ramas locales y remotas:

- `main`
- `prototipo-0.0.1` (rama actual)

Situación:

- `main` está atrasada.
- `prototipo-0.0.1` tiene 20 commits más que `main`.
- El merge-base es `fc655c3`.
- `main` es ancestro de `prototipo-0.0.1`, así que un merge a `main` puede ser fast-forward. Igual conviene hacerlo con PR y revisión.
- Hay un archivo generado modificado: `sistema_licencias/backend/__pycache__/app.cpython-313.pyc`. No se debe versionar. Hay que agregar `__pycache__/` y `*.pyc` al `.gitignore` y sacarlo del índice.

No hay más ramas. Si en el futuro aparecen, esta guía se actualiza.

---

## 2. Objetivo

Que todas las ramas tengan el mismo panorama antes de tocar código:

- `docs/plan/PLAN_MAESTRO.md`
- `docs/plan/DECISIONES.md`
- `docs/plan/GUIA_RAMAS_Y_MERGE.md`
- `AGENTS.md`
- `CONTRIBUTING.md`
- Un enlace en `README.md`

Así cualquier persona o agente que abra una rama sabe qué se está construyendo, qué está prohibido y cómo mergear sin romper todo.

---

## 3. Archivos que se copian a cada rama

Desde esta carpeta de plan:

| Archivo de plan | Destino en el repo |
|---|---|
| `PLAN_FINAL.md` | `docs/plan/PLAN_MAESTRO.md` |
| `DECISIONES.md` | `docs/plan/DECISIONES.md` |
| `GUIA_RAMAS_Y_MERGE.md` | `docs/plan/GUIA_RAMAS_Y_MERGE.md` |
| `AGENTS.md` | `AGENTS.md` |
| `HANDOFF_PLANTILLA.md` | `docs/HANDOFF.md` (plantilla inicial) |

Además se crea:

- `CONTRIBUTING.md` con las reglas de trabajo.
- `README.md` con un enlace visible al plan.

---

## 4. Distribución paso a paso

Importante: estos comandos los ejecuta el agente de implementación, no el modo Plan. Antes de correrlos, confirmar que no hay cambios sin commitear que se quieran conservar.

### 4.1 Preparar los archivos

Desde PowerShell, en la carpeta del repo:

```powershell
New-Item -ItemType Directory -Force docs\plan | Out-Null

Copy-Item "C:\Users\Usuario\.opencode\plan\PLAN_FINAL.md" "docs\plan\PLAN_MAESTRO.md"
Copy-Item "C:\Users\Usuario\.opencode\plan\DECISIONES.md" "docs\plan\DECISIONES.md"
Copy-Item "C:\Users\Usuario\.opencode\plan\GUIA_RAMAS_Y_MERGE.md" "docs\plan\GUIA_RAMAS_Y_MERGE.md"
Copy-Item "C:\Users\Usuario\.opencode\plan\AGENTS.md" "AGENTS.md"
Copy-Item "C:\Users\Usuario\.opencode\plan\HANDOFF_PLANTILLA.md" "docs\HANDOFF.md"
```

### 4.2 Commit en `main`

```powershell
git checkout main
git pull origin main
git checkout -b docs/plan-maestro

# Copiar los archivos acá también, si no se copiaron antes.

git add docs/plan AGENTS.md CONTRIBUTING.md README.md docs/HANDOFF.md .gitignore
git commit -m "docs: plan maestro, decisiones y reglas para agentes"
git push -u origin docs/plan-maestro
```

Se abre un PR a `main`. Cuando CI y revisión pasan, se mergea.

### 4.3 Llevar los archivos a `prototipo-0.0.1`

```powershell
git checkout prototipo-0.0.1
git pull origin prototipo-0.0.1
git checkout main -- docs/plan AGENTS.md CONTRIBUTING.md README.md docs/HANDOFF.md .gitignore
git add docs/plan AGENTS.md CONTRIBUTING.md README.md docs/HANDOFF.md .gitignore
git commit -m "docs: plan maestro, decisiones y reglas para agentes"
git push origin prototipo-0.0.1
```

Si `main` todavía no tiene los archivos, primero se mergea el PR de `main` y después se ejecuta este paso.

### 4.4 Verificar en cada rama

```powershell
git checkout main
Get-ChildItem docs\plan
Get-Content AGENTS.md -TotalCount 20

git checkout prototipo-0.0.1
Get-ChildItem docs\plan
Get-Content AGENTS.md -TotalCount 20
```

Tiene que estar el mismo contenido. Si falta algo, no se sigue.

---

## 5. Estrategia de merge a `main`

### 5.1 Regla general

- `main` es producción. No se pushea directo.
- `develop` es integración. Si no existe, se crea cuando haya más de una persona trabajando.
- Las ramas de trabajo salen de `develop` o de `main` y vuelven por PR.
- Un PR no se mergea si CI está en rojo.
- Un PR no se mergea si toca seguridad sin revisión.
- Un PR no se mergea si no actualiza `docs/HANDOFF.md`.

### 5.2 Orden recomendado

1. Congelar cambios en todas las ramas.
2. Crear un tag de respaldo: `git tag pre-merge-20261102`.
3. Mergear el PR de documentación a `main`.
4. Llevar la documentación a `prototipo-0.0.1`.
5. Crear una rama `fase-0-base` desde `prototipo-0.0.1`.
6. Limpiar merge markers, `db.py`, `schema.sql`, `__pycache__` y datos demo.
7. Pasar CI y pruebas.
8. PR de `fase-0-base` a `main`.
9. Revisar y mergear.
10. Etiquetar release: `git tag v0.1.0`.
11. Recién después empezar Fase 1.

### 5.3 Si hay más ramas en el futuro

Para cada rama:

1. Identificar dueño y objetivo.
2. Ver qué commits tiene adelante de `develop`.
3. Ver qué archivos toca.
4. Mergear una por una, de la más vieja a la más nueva.
5. Después de cada merge, correr tests.
6. Si hay conflictos, los resuelve el dueño de la rama, no un tercero.
7. Si una rama está abandonada, se archiva con tag y se borra.

Nunca hacer `git merge --allow-unrelated-histories` sin entender por qué. Nunca hacer `git push --force` a `main` o `develop`. Nunca borrar una rama sin tag.

---

## 6. Prevención de conflictos

- Un dueño por módulo. Nadie toca el módulo de otro sin avisar.
- No se editan migraciones viejas. Se crea una nueva.
- No se cambia el stack sin ADR.
- No se cambian nombres de tablas o columnas sin migración y sin actualizar `docs/MODELO_DATOS.md`.
- No se commitean `__pycache__`, `.env`, `node_modules`, `dist`, `uploads` ni archivos generados.
- Los archivos de bloqueo (`package-lock.json`, `poetry.lock` o `requirements.txt`) se actualizan en un PR aparte si son grandes.
- Los cambios de formato masivos van en un PR separado de los cambios funcionales.
- Cada PR explica qué cambia, por qué, cómo se prueba y qué riesgo tiene.
- Si dos ramas tocan el mismo archivo crítico, se coordina antes de mergear.
- `docs/plan/` es de solo lectura para las ramas de trabajo. Se cambia por PR y con aprobación.

---

## 7. Plantilla de PR

```markdown
## Qué cambia

## Por qué

## Cómo se prueba

## Riesgos

## Checklist

- [ ] Tests pasan
- [ ] Lint pasa
- [ ] No hay secretos
- [ ] No hay datos demo
- [ ] Actualicé docs/HANDOFF.md
- [ ] Actualicé migraciones si tocó la base
- [ ] Revisé seguridad si tocó auth, pagos, archivos o proctoring
```

---

## 8. Reglas para agentes en otras ramas

- Leer `AGENTS.md` antes de tocar nada.
- Leer `docs/plan/PLAN_MAESTRO.md`.
- No cambiar el stack.
- No agregar modos demo.
- No hardcodear credenciales.
- No borrar ramas.
- No hacer force push.
- No mergear a `main`.
- No tocar `docs/plan/` sin aprobación.
- Si algo no está claro, preguntar. No inventar.

---

## 9. Checklist de verificación

- [ ] `main` tiene `docs/plan/PLAN_MAESTRO.md`.
- [ ] `prototipo-0.0.1` tiene el mismo archivo.
- [ ] `AGENTS.md` está en la raíz de ambas ramas.
- [ ] `README.md` enlaza al plan.
- [ ] `CONTRIBUTING.md` existe.
- [ ] `.gitignore` excluye `__pycache__`, `*.pyc`, `.env`, `uploads`, `node_modules`, `dist`.
- [ ] No hay secretos en git.
- [ ] CI pasa en ambas ramas.
- [ ] El tag `pre-merge-20261102` existe.
- [ ] El handoff está actualizado.
