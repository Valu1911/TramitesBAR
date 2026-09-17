
## Gitignore Hygiene

Antes de cualquier commit, push, o migración a un repositorio remoto:

1. **Verificar que exista un `.gitignore`** adecuado. Si no existe, crear uno con al mínimo:
   - `node_modules/`
   - `__pycache__/`
   - `*.pyc`
   - `.env`
   - `*.log`
   - `uploads/`
   - `.agents/`
   - `graphify-out/`

2. **Nunca commitear** `node_modules/`, `__pycache__/`, archivos `.env`, ni logs.

3. **Si se detectan estos archivos ya trackeados**, alertar al usuario y sugerir `git rm -r --cached <path>` antes del push.
