# Project recovery: bounded first slice

Current phase: T01 backend CI dependency provisioning only, with local verification
and a work-unit commit. T02 fail-closed proctoring and T03 role-aware navigation
remain separate pending work units. This document does not certify that the
application works end to end.

## Recovery locator and execution boundary

| Field | Value |
|---|---|
| Relative locator | `odd/tasks/project-recovery.md` |
| Engram project / topic | `tramitesbar` / `odd/project-recovery/tasks` |
| Original branch / base | `fase-0-base` / `80f888d` |
| Working branch | `fix/project-recovery`, created locally from that HEAD |
| Initial status | Only preexisting untracked `.atl/`; preserve it unchanged |
| Route / trigger | Delegated T01 implementation; workflow and documentation span 2+ files |
| Current authorization | T01 workflow, handoff/task docs, local checks and local work-unit commit |
| Implementation authorization in this phase | Workflow provisioning/cache only; no application/test edits |
| Model | Default runtime model; no verified explicit override |
| Review lifecycle | RDD globally on per task input; owned by parent, not run here |
| TDD effective state | Unknown; no verified enabling toggle |
| Delivery strategy | `ask-on-risk`; approximately 400 authored changed lines advisory |
| Selected chain strategy | `stacked-to-main` (user selected staged integration) |

CodeGraph already failed because its index is missing (parent evidence). Use
targeted filesystem inspection for this phase; do not initialize an index.
No child delegation, remote commands, fetch, push, PR, merge, reset, rebase,
production access, existing-database migration, or ambient credential reuse.
Local T01 work-unit commit and a small tracking commit are explicitly authorized.
Do not run `iniciar.bat`, start services, or inspect `.env` secret contents.

## Scope and exclusions

Allowed future scope is the three fixes below, their regression tests, and the
necessary API/proctoring/navigation documentation and `docs/HANDOFF.md` update.
Each behavior change needs its tests and documentation in the same work unit.
The present phase changes only `.github/workflows/ci.yml`, `docs/HANDOFF.md` and
this document; no application or test changes are authorized.

Preserve `legacy/`, `.atl/`, secrets, existing databases, real service data,
uploads, runtime credentials, dependency locks, municipal policy, and the stack.
Do not invent municipal requirements, implement real LiveKit infrastructure,
record locally, or enable an unsupervised substitute for supervised exams.

## Pending implementation tasks

- [ ] **T01 — CI dependency provisioning.** Install the declared backend dev
  requirements in CI rather than runtime requirements alone. Keep production
  dependencies separate and preserve existing checks and security controls.
  - Original evidence: CI cached/installed `requirements.txt` but invoked Ruff,
    Mypy and Pytest; these tools are declared in `requirements-dev.txt`.
  - Acceptance: declared dev tools are provisioned from the dev manifest; cache
    inputs cover the relevant manifests; no skipped checks or scope expansion.
  - Checks: backend Ruff, Mypy, Pytest; inspect workflow dependency/cache paths.
    Remote CI execution and MySQL migration validation are outside this phase.
  - Rollback: only workflow provisioning/cache changes and their related docs.

- [ ] **T02 — Fail-closed proctoring availability.** Replace simulated success
  with explicit unavailability when supervision cannot be genuinely provided.
  Honor the feature flag and missing configuration without claiming a room is
  connected. Camera denial or missing browser support must never become success.
  - Evidence: `app/services/exams.py:519-573` imports undeclared `jwt` before
    its simulated-token fallback; the token endpoint lacks a feature-flag gate.
    `TheoryExam.tsx:64-105,314-329,365-369` requests tokens unconditionally,
    reports camera success on failure, and treats token presence as supervision.
  - Acceptance: disabled/unavailable supervision returns a structured error;
    no simulated tokens or false camera/room status; UI explains unavailability.
    Direct API exam start must not bypass supervision availability. Do not turn
    the flag off into permission for an unsupervised exam. No mutation or attempt
    consumption on rejected start. Preserve ownership, CSRF and step validation.
  - Checks: backend tests for flag off, missing config, ownership, wrong step,
    CSRF and direct start; frontend tests for unavailable/failed token, camera
    rejection/missing API, blocked start and honest room status. Test-only doubles
    are acceptable; no live remote connection or invented production readiness.
  - Safety decision: because real LiveKit admission/connection is not implemented
    in this slice, keep the supervised path unavailable rather than inventing
    admission evidence or enabling it solely because keys are configured.
  - Rollback: availability guards, token behavior, corresponding UI/types/tests
    and docs as one coherent security unit; no schema changes.

- [ ] **T03 — Role-aware navigation preserving allowlists.** Direct specialist
  staff to an existing permitted landing page and show only permitted links.
  - Evidence: `App.tsx:82-85,103-104,121-122` sends all staff to `/admin/cuentas`;
    its allowlist at lines 248-264 excludes health, appointments and payments
    specialists from accounts but permits them on `/admin/tramites`.
    `Navbar.tsx:63-80` shows both links to every staff member.
  - Acceptance: specialist login/home/unauthorized-route fallback resolves to
    `/admin/tramites` without redirect loops; accounts/admin/superadmin retain
    appropriate destinations; citizen/anonymous behavior remains correct.
    Do not broaden route or backend role allowlists to make navigation work.
  - Checks: role-matrix tests for every existing Role across home, login,
    forbidden route and navbar; verify denied resources remain denied.
  - Rollback: shared landing/link policy and its consumers/tests/docs only.

## Review workload forecast and delivery

Authored additions plus deletions, including tests/comments/docs, not net lines:

| Unit | Initial estimate |
|---|---:|
| T01 workflow provisioning and related documentation | 20-50 |
| T02 backend/frontend guards, regression tests and documentation | 250-430 |
| T03 role policy, consumers, regression tests and documentation | 150-240 |
| Shared recovery evidence and handoff | 220-280 |
| Rounded total | Approximately 650-1,000 |

Forecast exceeded 400 and was reported before source work. User selected
`stacked-to-main`; retain cohesive T01, T02, T03 work-unit boundaries, not file-type
splits. No size exception or PR is authorized. T02 may itself exceed the advisory
threshold; stop for the parent's size/risk decision rather
than removing tests/comments or compressing code. This is one honest sizing pass.
Later task completion requires exact focused/full results, runtime scenario or
explicit justified N/A, rollback boundary, and a work-unit commit when authorized.
Initial pre-baseline estimate was 600-950; evidence/runner documentation increased
the shared-documentation allowance. Only T01 CI source work is now authorized.

Selected local chain plan (no remote branches or PRs created):

```text
main (future integration target; no checkout or mutation)
  <- T01: CI provisioning + recovery/handoff docs [current slice]
  <- T02: fail-closed supervision + tests/docs [pending]
  <- T03: role-aware navigation + tests/docs [pending]
```

Current slice starts at `80f888d`; end is the T01 implementation commit recorded
below. Later slices depend on the preceding work-unit boundary and are intended
to integrate in that order. No tracker/feature-branch-chain strategy is mixed in.
Native review and any future publication/integration remain parent-owned.

## TDD configuration evidence and runners

- Task input explicitly says no verified TDD enabling toggle; do not infer one
  from the existence of tests. Ordinary baseline checks apply here, not a claimed
  red/green cycle. T01 is nonbehavioral provisioning: ordinary checks apply.
  Do not run `sdd-init` or change session configuration.
- Project probes: `.opencode/`, `opencode.json`, `opencode.jsonc` and `.gentle/`
  do not exist; tracked filename probe found no TDD/Gentle/OpenCode config.
- `AGENTS.md` has test requirements but no explicit TDD enable setting.
- Global `~/.config/opencode/opencode.jsonc` exists, but a targeted TDD/RDD grep
  exceeded the tool's JSON-record limit. Its effective toggle is unverified;
  do not dump the file or infer a state. No session config was provided.
- Backend runner: existing `.venv/Scripts/python.exe`, Python 3.14.6; project
  declares >=3.12 and CI uses 3.12. Cross-version parity is not established.
  Initially Ruff, Mypy, Pytest, pytest-cov and types-requests are absent.
- Frontend runners from `package.json`: `typecheck` = `tsc -b --pretty false`;
  `lint` = `eslint .`; `test` = `vitest run`; `build` = `tsc -b && vite build`.
  Parent verified Node 24.18.0 / npm 12.2.0; CI uses Node 20.

## Isolated baseline protocol

Read all backend tests and fixtures before execution. `tests/conftest.py`
creates in-memory SQLite, test-only random keys and temporary file storage, but
does NOT clear inherited Redis, storage backend, Ollama or LiveKit configuration.
`Settings` normally reads two `.env` paths; fixture overrides alone are insufficient.

Use a process-only runner that disables dotenv loading before application import,
clears all Settings environment fields, disables third-party pytest autoload,
sets Redis empty, local storage, console email, Ollama empty and LiveKit empty,
and sets proctoring disabled. Let conftest create only temporary SQLite/files.
Do not start a worker, use MySQL, apply migrations, seed any existing database,
or contact services. Frontend unit tests mock `api` and authentication; no dev
server is needed. Confirm cache/output parent directories before running tools.

Backend working directory: `sistema_licencias/backend`:

```powershell
.\.venv\Scripts\python.exe -m pip --isolated install --disable-pip-version-check --retries 0 --timeout 20 -r requirements-dev.txt
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m mypy app tests
# Run the equivalent of the following inside the isolated process runner:
.\.venv\Scripts\python.exe -m pytest tests -q
```

Frontend working directory: `sistema_licencias/frontend`:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Dev setup is authorized only in the existing backend venv with declared dev
requirements; report downloads/disk/cache effects first. Do not replace Python,
install system packages, edit manifests/locks, or repeatedly retry network failure.
Baseline timeout: bounded per command; record failures rather than patching them.

## Baseline evidence

Executed locally on 2026-11-05, all commands bounded to 180 seconds. Frontend
Node 24.18.0 / npm 12.2.0 independently reconfirmed. Exact check results:

| Working directory | Command | Result |
|---|---|---|
| Backend | `.\.venv\Scripts\python.exe -m ruff check .` | Exit 0; all checks passed |
| Backend | `.\.venv\Scripts\python.exe -m mypy app tests` | Exit 0; 71 source files |
| Backend | Isolated equivalent of `python -m pytest tests -q` below | Exit 1; 29 passed, 2 failed |
| Backend | Summary rerun: same isolation, `-o addopts= tests -q --tb=short --show-capture=no` | Exit 1; 29 passed, 2 failed, 1 warning in 9.71 s |
| Backend | `.\.venv\Scripts\python.exe -m pip check` | Exit 0; no broken requirements |
| Frontend | `npm run typecheck` | Exit 0 |
| Frontend | `npm run lint` | Exit 0 |
| Frontend | `npm test` | Exit 0; 1 test file, 5 tests passed in 3.24 s |
| Frontend | `npm run build` | Exit 0; 253 modules transformed; Vite build 432 ms |

Both failed tests reach `app/services/exams.py:526` and raise
`ModuleNotFoundError: No module named 'jwt'` through `procedures.py:360`:

- `tests/test_exams.py::test_exam_proctoring_token_and_step_validation` (line 180).
- `tests/test_procedures.py::test_full_procedure_lifecycle_from_start_to_license_issued` (line 194).

The warning is `StarletteDeprecationWarning` about the installed TestClient/httpx
combination. Do not install undeclared packages or suppress warnings to hide it.
T01/T03 and camera/room findings are source-confirmed, not remote CI/browser
reproductions. Passing direct-start tests with proctoring disabled corroborates
the missing supervision gate; these tests are not proof of safe exam admission.

Exact successful-launch isolation wrapper, from backend (PowerShell 5.1):

```powershell
$env:TMP = 'C:/Users/pc8-1/AppData/Local/Temp/opencode'; $env:TEMP = $env:TMP; $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD = '1'
.\.venv\Scripts\python.exe -c "import os, runpy, sys; from app.core.config import Settings; Settings.model_config['env_file'] = None; [os.environ.pop(name.upper(), None) for name in Settings.model_fields]; os.environ.update(APP_ENV='test', DATABASE_URL='sqlite://', REDIS_URL='', STORAGE_BACKEND='local', EMAIL_TRANSPORT='console', OLLAMA_URL='', LIVEKIT_URL='', LIVEKIT_API_KEY='', LIVEKIT_API_SECRET='', FEATURES_PROCTORING='false', FEATURES_MINORS='false', FEATURES_DNI_OCR='false', SENTRY_DSN=''); sys.argv = ['pytest', 'tests', '-q']; runpy.run_module('pytest', run_name='__main__')"
```

An initial wrapper attempt used unsuitable PowerShell/native double-quote
escaping and exited 1 with SyntaxError before pytest/application execution.
It is a harness-launch failure, not a third failing test. The corrected command
above and summary rerun both reproduce the same two application failures.

Dev installation succeeded: 13 packages added to the existing venv, including
Pytest 8.4.2, pytest-cov 6.3.0, Ruff 0.17.4, Mypy 1.20.2 and types-requests
2.33.0.20261030. Runtime requirements were already satisfied and unchanged.
Ruff downloaded 10.3 MB and coverage 230 kB; other wheels came from cache.
No system install, lock edit, runtime replacement or undeclared JWT installation.
Test data lives only in fixture-created in-memory SQLite and temporary storage
under the approved temporary parent. Build/cache files are ignored outputs.

Preparation snapshot: tracked diff was empty; untracked paths were only `.atl/`
registry files and this document. No commit. Previous `docs/HANDOFF.md` green
results are historical, not current proof. Real MySQL/Redis/MinIO/LiveKit,
migrations, services, remote CI, browser E2E and production remain unverified.

## T01 implementation evidence

Workflow now installs `requirements-dev.txt` via the selected Python interpreter;
that manifest includes `requirements.txt`. Pip cache inputs explicitly include
both files. No checks, permissions, actions, triggers, migrations or runtime
dependency declarations were changed. Existing version ranges remain unpinned;
this provisioning fix does not promise identical future dependency resolution.

Local acceptance satisfied on 2026-11-05; closure commit pending. A PyYAML
`safe_load` assertion check on `git show :.github/workflows/ci.yml` passed (exit 0):
both cache manifests, dev installation through Python, backend working directory,
unchanged Ruff/Mypy/Pytest commands and read-only contents permission. Manual
manifest inspection confirms `requirements-dev.txt` includes `requirements.txt`.
The installed declared dev tools execute; no dependency installation was needed
again in T01. The setup-python v5 documentation confirms multiline cache inputs.

| T01 repeated check | Observed result |
|---|---|
| Backend `.\.venv\Scripts\python.exe -m ruff check .` | Exit 0; all checks passed |
| Backend `.\.venv\Scripts\python.exe -m mypy app tests` | Exit 0; 71 source files |
| Backend `.\.venv\Scripts\python.exe -m pip check` | Exit 0; no broken requirements |
| Same isolated pytest wrapper above, `tests -q` | Exit 1; exactly the same 2 JWT failures |
| Same wrapper, summary arguments `-o addopts= tests -q --tb=short --show-capture=no` | Exit 1; 29 passed, 2 failed, 1 warning in 9.56 s |
| Frontend `npm run typecheck`, `npm run lint` | Both exit 0 |
| Frontend `npm test` | Exit 0; 5 tests, 1 file; 2.59 s |
| Frontend `npm run build` | Exit 0; 253 modules; Vite build 433 ms |

All checks ran foreground with 180-second bounds; no new failures observed.
The two failures and warning are the exact source baseline recorded above, not
environmental excuses. No tests were hidden, skipped, modified or weakened.
Runtime harness: N/A for application behavior (provisioning only). Remote Actions
execution/cache restore and MySQL migration verification remain unavailable under
local-only authorization; this is not a green CI claim. Runtime versions and
cross-version limitations are unchanged from the baseline.

Rollback: restore only workflow install/cache lines and corresponding T01 docs;
application/test bytes remain unchanged. `docs/HANDOFF.md` now reports the actual
red backend baseline and labels older all-green claims as historical.
Implementation commit: pending. T02/T03 remain pending; RDD review parent-owned.

## Preparation skills and next step

`skill_resolution: paths-injected` (read before work):

- `.agents/skills/code-security/SKILL.md`
- `C:/Users/pc8-1/.config/agents/skills/work-unit-commits/SKILL.md`
- `C:/Users/pc8-1/.config/agents/skills/chained-pr/SKILL.md`
- `C:/Users/pc8-1/.config/agents/skills/cognitive-doc-design/SKILL.md`

Finish T01 checks, update the handoff and evidence, commit only its three files,
record the implementation commit in a small tracking commit if needed, mirror
this full document and relative locator to Engram, and read it back. Return known
failures and slice counts to parent; T02/T03 require later authorization. RDD
review remains the parent's responsibility; no remote operations are authorized.
