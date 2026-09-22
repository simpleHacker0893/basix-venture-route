# FastAPI Clean Architecture — Skill / Rule pragmático

Convenciones para estructurar proyectos **FastAPI** separando lógica de negocio, persistencia y servicios externos. Pragmático, sin Clean Architecture purista. Listo para **Cursor, Claude Code, Codex, OpenCode, Continue, Aider, Cline / Roo Code, Windsurf** y cualquier asistente que acepte system prompt.

Cubre: routers/`Depends`/`lifespan`, casos de uso, repositorios (SQLAlchemy o PyMongo async), schemas Pydantic, Celery 5.4, auth Clerk JWT RS256 + API keys SHA-256, testing con `dependency_overrides`, mapeo de excepciones de dominio a HTTP.

## Instalación rápida (recomendado)

[![skills.sh](https://skills.sh/b/fulit103/fastapi-clean)](https://skills.sh/fulit103/fastapi-clean)

Instalá la skill con el CLI de [skills.sh](https://skills.sh) ([documentación](https://skills.sh/docs); repo del CLI: [vercel-labs/skills](https://github.com/vercel-labs/skills)):

```bash
# Instalar en el agente que detecte el CLI
npx skills add fulit103/fastapi-clean

# Varios agentes a la vez (Claude Code, Cursor, Codex, etc.)
npx skills add fulit103/fastapi-clean -a claude-code -a cursor -a codex

# Global (disponible en todos tus proyectos)
npx skills add fulit103/fastapi-clean -g
```

Desde un clon local del repo:

```bash
cd /ruta/a/fastapi-clean/
npx skills add . --list
npx skills add . -a cursor
```

## Contenido del paquete

```
fastapi-clean/
├── SKILL.md                                  # Skill (skills.sh, Agent Skills spec)
├── cursor-rule/
│   └── fastapi-clean-architecture.mdc        # Regla Cursor (.mdc con globs)
├── README.md                                 # Este archivo
├── LICENSE                                   # MIT
├── references/
│   ├── multi_subagent_workflow.md            # Modo multi-subagent + contrato compartido
│   ├── celery_5_4.md                         # Tasks Celery 5.4 idempotentes y resilientes
│   ├── pymongo_async.md                      # AsyncMongoClient + repos por Protocol
│   ├── clerk_jwt.md                          # Verificación JWT RS256 + AuthenticatedPrincipal
│   ├── api_keys_sha256.md                    # secrets.token_urlsafe + SHA-256/HMAC + compare_digest
│   ├── testing.md                            # dependency_overrides + fakes de Protocol
│   └── error_handling.md                     # Excepciones de dominio → HTTP handlers
└── assets/
    ├── domain_entity_template.py             # dataclass(frozen=True) + invariantes
    ├── port_template.py                      # Protocol del repositorio
    ├── use_case_template.py                  # Use case con __init__(repo) + execute(command)
    ├── pydantic_schemas_template.py          # Create / Update / Response + to_command()
    ├── sqlalchemy_repository_template.py     # Repo async + mappers _to_domain/_to_orm
    ├── mongo_repository_template.py          # Repo async + mappers _to_domain/_to_document
    ├── router_template.py                    # APIRouter delgado con response_model
    ├── deps_template.py                      # Providers: db, repo, use case
    ├── lifespan_template.py                  # AsyncMongoClient + ping + close
    ├── celery_task_template.py               # Task con autoretry + asyncio.run
    └── settings_template.py                  # BaseSettings + @lru_cache get_settings()
```

---

## Cómo usarlo en cada herramienta

### Cursor

Cursor lee reglas desde `.cursor/rules/*.mdc` (recomendado) o un `.cursorrules` en la raíz.

**Opción A — Como regla `.mdc` (recomendado):**

1. En tu proyecto FastAPI, crea la carpeta `.cursor/rules/` si no existe.
2. Copia `cursor-rule/fastapi-clean-architecture.mdc` a `.cursor/rules/fastapi-clean-architecture.mdc`.
3. (Opcional) copia también las referencias para poder linkearlas:
   ```
   .cursor/rules/
   ├── fastapi-clean-architecture.mdc
   └── fastapi-clean-refs/
       ├── multi_subagent_workflow.md
       ├── celery_5_4.md
       ├── pymongo_async.md
       ├── clerk_jwt.md
       ├── api_keys_sha256.md
       ├── testing.md
       └── error_handling.md
   ```
4. Reinicia Cursor (o recarga la ventana). La regla se activará automáticamente cuando trabajes en archivos que matcheen los `globs` (`app/**`, `api/**`, `modules/**`, `use_cases/**`, `repositories/**`, `routers/**`, `worker*.py`, `celery*.py`).

**Opción B — Como `.cursorrules` en la raíz:**

1. Copia el contenido de `SKILL.md` (o `cursor-rule/fastapi-clean-architecture.mdc`) a `.cursorrules` en la raíz del proyecto.
2. Eliminá el frontmatter YAML (las líneas entre `---` al inicio).
3. Cursor lo aplicará a todo el proyecto.

**Tip**: cuando le pidas a Cursor crear un módulo nuevo, mencionalo explícitamente: *"Crea el módulo `users` con `User` entidad, `CreateUser` y `GetUserByClerkId` use cases, repositorio Mongo, siguiendo las convenciones de fastapi-clean-architecture"*. La regla se carga sola, pero ser explícito ayuda al modelo a darle peso.

---

### Claude Code

Claude Code lee instrucciones desde:

- `CLAUDE.md` en la raíz del proyecto (instrucciones globales del repo).
- `~/.claude/skills/<name>/SKILL.md` o `.claude/skills/<name>/SKILL.md` (skill estructurada).

**Opción A — Skill instalada (recomendado, vía skills.sh):**

```bash
npx skills add fulit103/fastapi-clean -a claude-code
```

Esto deja la skill en `.claude/skills/fastapi-clean-architecture/SKILL.md` y Claude Code la descubre automáticamente al disparar los triggers ("caso de uso", "router FastAPI", "clean architecture", etc.).

**Opción B — Como `CLAUDE.md` del proyecto:**

1. Copia el contenido de `SKILL.md` a `CLAUDE.md` en la raíz del repo.
2. Eliminá el frontmatter YAML.
3. (Opcional) copia las referencias a `docs/architecture/` y mencionalas en `CLAUDE.md`:
   > Para detalles, consulta `docs/architecture/celery_5_4.md`, `docs/architecture/pymongo_async.md`, etc.

Claude Code descubre `CLAUDE.md` automáticamente al iniciar sesión.

---

### Codex (OpenAI Codex CLI)

Codex CLI lee desde `~/.codex/instructions.md` o un context file pasado por flag.

```bash
npx skills add fulit103/fastapi-clean -a codex
```

O manualmente:

1. Copiá el contenido de `SKILL.md` a `~/.codex/instructions.md` (sin el frontmatter YAML).
2. Codex usará esas instrucciones como system prompt en futuras sesiones.

Alternativa: pasalo como contexto en cada llamada con el flag de contexto que use tu versión de Codex CLI.

---

### OpenCode

OpenCode soporta context files configurables en su settings. Verificá la versión actual:

```bash
opencode --help
```

Patrones típicos:

- `.opencode/rules/*.md` en la raíz del proyecto.
- Configuración global en `~/.opencode/config.yaml` apuntando a archivos de rules.

Pasos:

1. Crea `.opencode/rules/fastapi-clean-architecture.md` con el contenido de `SKILL.md` (sin frontmatter).
2. (Opcional) copia las referencias a `.opencode/rules/fastapi-clean-refs/`.

Si tu versión de OpenCode usa otro path, ajustá. Si no hay path estándar, copialos a `CONVENTIONS.md` o similar en la raíz y OpenCode los recogerá como contexto del proyecto.

---

### Continue (extensión VSCode / JetBrains)

Continue usa "rules" en `~/.continue/config.yaml` o archivos del workspace.

1. Crea `~/.continue/rules/fastapi-clean-architecture.md` con el contenido de `SKILL.md` (sin frontmatter YAML).
2. Editá `~/.continue/config.yaml` y agregá la regla a la lista de rules activas:
   ```yaml
   rules:
     - path: ~/.continue/rules/fastapi-clean-architecture.md
   ```

---

### Aider

Aider lee de un archivo `CONVENTIONS.md` o de archivos que le pases con `--read`.

```bash
aider --read fastapi-clean/SKILL.md \
      --read fastapi-clean/references/pymongo_async.md \
      --read fastapi-clean/references/multi_subagent_workflow.md \
      app/modules/users/
```

O agregá el contenido de `SKILL.md` a `CONVENTIONS.md` en la raíz del repo y aider lo cargará automáticamente.

---

### Cline / Roo Code (extensión VSCode)

Cline lee `.clinerules` en la raíz del proyecto.

1. Copia `SKILL.md` a `.clinerules` en la raíz.
2. Eliminá el frontmatter YAML.

---

### Windsurf

Windsurf lee desde `.windsurfrules` en la raíz del proyecto.

1. Copia `SKILL.md` a `.windsurfrules` en la raíz.
2. Eliminá el frontmatter YAML.

---

### Genérico — cualquier asistente que acepte system prompt o context files

Si tu herramienta acepta cargar archivos como contexto del modelo:

1. Carga `SKILL.md` como instrucciones del sistema o "rules".
2. Carga las referencias en `references/` **solo cuando el modelo las necesite** (típicamente, las plantillas y el ejemplo end-to-end son útiles cuando vas a generar código nuevo).

---

## Estrategia recomendada cuando trabajás con varios asistentes

Para no mantener el archivo en N copias, una opción cómoda:

1. Mantené los archivos `.md` en una carpeta `docs/architecture/` del repo (versionada en git).
2. En cada herramienta, creá solo un **archivo de entrada que apunte** a esos docs:
   - **Cursor**: `.cursor/rules/fastapi-clean-architecture.mdc` con un párrafo corto que diga "ver `docs/architecture/SKILL.md`" + las reglas clave inline.
   - **Claude Code**: `CLAUDE.md` con *"Sigo las convenciones en `docs/architecture/SKILL.md`"*.
   - **Aider**: agregá `docs/architecture/SKILL.md` a `CONVENTIONS.md` o pasalo con `--read`.

Así el contenido vive en un solo lugar versionado y cada herramienta lo descubre a su manera.

---

## Personalización

Sentite libre de editar los archivos para adaptarlos a tu equipo:

- **Cambiar la estructura** de carpetas si tu codebase usa otra convención (`app/<feature>/` plano en lugar de `modules/<feature>/{domain,application,infrastructure}`).
- **Cambiar persistencia**: si usás SQL exclusivamente, podés borrar `references/pymongo_async.md` y el template Mongo; si usás Mongo, borrar el template SQL.
- **Cambiar auth**: si no usás Clerk, reemplazá `references/clerk_jwt.md` por tu provider (Auth0, Cognito, custom).
- **Cambiar idioma**: todo está en español (Rioplatense). Los términos técnicos quedan en inglés cuando son universales (Protocol, Repository, etc.).
- **Quitar secciones** que no apliquen (Celery si no usás colas, API keys si solo tenés Clerk).

El skill no es prescriptivo: es un punto de partida pragmático.

---

## Cuándo NO usar este skill

- CRUD plano sin reglas de negocio: un router con SQLModel + `response_model` es más simple.
- Scripts ad-hoc o jobs únicos.
- Proofs of concept donde la velocidad importa más que la testabilidad.
- Equipos chicos en sprint inicial: aplicá el patrón cuando el dolor aparezca, no antes.

La regla de oro: **el patrón paga cuando aparece un servicio externo, una segunda forma de disparar la misma lógica, o tests que duelen mantener**. Antes de eso, suele ser overkill.

---

## Licencia

MIT — ver [LICENSE](./LICENSE).

## Autor

[fulit103](https://github.com/fulit103)
