# docker-vps-deploy

Deploy a Dockerized application to a VPS via SSH — no container registry needed. The image is saved with `docker save`, compressed with gzip, transferred via `rsync`, and loaded with `docker load` on the remote server.

## Install

```bash
# Path syntax
npx skills add itsgitz/agent-skills/docker-vps-deploy

# Flag syntax
npx skills add itsgitz/agent-skills --skill docker-vps-deploy
npx skills add itsgitz/agent-skills -s docker-vps-deploy
```

## Update

```bash
npx skills update docker-vps-deploy
```

## Triggers

Claude invokes this skill when you ask about:

- "deploy to VPS"
- "rsync docker image"
- "docker save and load"
- "VPS CI/CD"
- "SSH deploy pipeline"
- "deploy without registry"
- "transfer docker image via SSH"

## What It Generates

A complete `.github/workflows/deploy.yml` that:

1. Builds the Docker image with layer caching (`type=gha`)
2. Compresses it — `docker save | gzip > image.tar.gz`
3. Transfers `image.tar.gz` and `docker-compose.yml` via `rsync` over SSH
4. Runs `docker load`, `docker compose up -d`, and cleanup on the VPS

## Required GitHub Secrets

| Secret | Example |
|--------|---------|
| `SSH_HOST` | `203.0.113.10` |
| `SSH_USER` | `deploy` |
| `SSH_KEY` | Ed25519 private key PEM |
| `SSH_PORT` | `22` |

## Full Reference

See [SKILL.md](./SKILL.md) for the complete pipeline, security considerations, key optimizations, and common mistakes table.
