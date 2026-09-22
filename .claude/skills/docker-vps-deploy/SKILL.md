---
name: docker-vps-deploy
description: >
  Use when deploying a Dockerized application to a VPS (Linux server) via SSH without
  a container registry, generating a GitHub Actions pipeline that uses docker save,
  gzip compression, and rsync to transfer images. Triggers: "deploy to VPS", "rsync
  docker image", "docker save and load", "VPS CI/CD", "SSH deploy pipeline",
  "deploy without registry", "transfer docker image via SSH".
license: MIT
---

# Docker VPS Deploy

## Overview

Build Docker image in CI, compress with gzip, transfer to VPS via rsync over SSH, load and run with Docker Compose. No container registry required — the image travels as a `.tar.gz` file.

## When to Use

- VPS with SSH access, Docker, and Docker Compose installed
- No container registry in the workflow (no Docker Hub, ECR, GHCR, etc.)
- Single-server or small-fleet deployment
- User asks to generate a GitHub Actions workflow for VPS deployment via rsync/SSH

## When NOT to Use

- Container registry already available → push/pull is simpler and faster
- Cloud-managed deployments (ECS, Cloud Run, Fly.io, Railway, Render)
- Multi-node orchestration (Kubernetes, Docker Swarm across nodes)
- Non-Docker deployments (bare-metal, systemd services)

## Prerequisites

On the VPS before first run:
- Docker and Docker Compose v2 (`docker compose`, not `docker-compose`) installed
- SSH key-based authentication configured for deploy user
- Deploy directory exists and is writable (e.g., `/opt/app`)
- `docker-compose.yml` present in the repository root

## Required Secrets

| Secret | Description | Example |
|--------|-------------|---------|
| `SSH_HOST` | VPS IP or hostname | `203.0.113.10` |
| `SSH_USER` | SSH login user | `deploy` |
| `SSH_KEY` | Private SSH key (Ed25519 PEM) | Contents of `~/.ssh/id_ed25519` |
| `SSH_PORT` | SSH port | `22` |

Add in: GitHub repo → Settings → Secrets and variables → Actions.

## Core Pipeline Pattern

```yaml
name: Deploy to VPS

on:
  push:
    branches: [main]
    paths-ignore:
      - "*.md"
      - "docs/**"

env:
  IMAGE_NAME: my-app
  DEPLOY_DIR: /opt/app

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build Docker image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          load: true
          tags: ${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Save and compress image
        run: docker save ${{ env.IMAGE_NAME }}:latest | gzip > image.tar.gz

      - name: Setup SSH agent
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.SSH_KEY }}

      - name: Add VPS to known hosts
        run: ssh-keyscan -p ${{ secrets.SSH_PORT }} -H ${{ secrets.SSH_HOST }} >> ~/.ssh/known_hosts

      - name: Transfer files to VPS
        run: |
          rsync -avz \
            -e "ssh -p ${{ secrets.SSH_PORT }} -o StrictHostKeyChecking=yes" \
            image.tar.gz docker-compose.yml \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ env.DEPLOY_DIR }}/

      - name: Deploy on VPS
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          port: ${{ secrets.SSH_PORT }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd ${{ env.DEPLOY_DIR }}
            gunzip -c image.tar.gz | docker load
            docker compose down
            docker compose up -d
            docker image prune -f
            rm -f image.tar.gz
```

## Key Optimizations

- **Layer caching (`type=gha`, `mode=max`):** GitHub Actions cache backend. Skips rebuild of unchanged layers. `mode=max` caches all intermediate layers, not just the final stage.
- **Gzip compression:** `docker save` outputs uncompressed tar. Gzip reduces image size 60–70% before transfer. For images >2 GB, consider `zstd` (`docker save ... | zstd`) for faster compression.
- **`webfactory/ssh-agent`:** Loads the deploy key into ssh-agent in memory — no key file written to disk. Integrates with the system SSH client, so rsync and other SSH commands work without `-i` flags.
- **`appleboy/ssh-action`:** Executes remote Docker commands over SSH with a clean YAML interface. Errors and stdout are surfaced natively in the Actions log without manual heredoc handling.
- **rsync `-avz`:** Archive mode + compression during transfer. Subsequent deploys only transfer changed bytes (`docker-compose.yml` updates are nearly instant).
- **`load: true`:** Required in `build-push-action` when NOT pushing to a registry. Makes the built image available locally for `docker save`.

## Security Considerations

- **Never use `StrictHostKeyChecking=no`.** Use `ssh-keyscan` to populate `known_hosts` before connecting. Disabling host key checking enables MITM attacks.
- **SSH key never written to disk.** `webfactory/ssh-agent` loads the key into ssh-agent in memory. `appleboy/ssh-action` handles its own key internally — no files, no CLI args.
- **Ed25519 keys preferred** over RSA — smaller, faster, same security.
- **Dedicated deploy user** on the VPS: non-root, member of `docker` group, write access to deploy dir only.
- **`permissions: contents: read`** — least-privilege GITHUB_TOKEN scoping.

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Using GHCR/Docker Hub instead of `docker save` | Doesn't match the no-registry requirement; adds registry credentials complexity | Use `docker save \| gzip > image.tar.gz` + rsync |
| `StrictHostKeyChecking=no` | Disables MITM protection | Use `ssh-keyscan` + `StrictHostKeyChecking=yes` |
| Missing `load: true` in build step | Image not available locally for `docker save` | Add `load: true` to `build-push-action` |
| Using `docker-compose` (v1 binary) | Deprecated; may not exist on VPS | Use `docker compose` (v2 plugin, no hyphen) |
| No `timeout-minutes` | Stuck deploy blocks runner for 6 hours | Set `timeout-minutes: 20` on the job |
| Not cleaning up `image.tar.gz` on VPS | Disk fills up over repeated deploys | `rm -f image.tar.gz` after `docker load` |
| Hardcoding SSH port 22 | Breaks when VPS uses non-standard port | Parameterize via `SSH_PORT` secret |

## Cross-Reference

For GitHub Actions syntax fundamentals — workflow YAML structure, triggers, job orchestration, caching patterns, action SHA pinning, and the 13 common anti-patterns — use the `github-actions` skill:

```bash
npx skills add oakoss/agent-skills/github-actions
```

This skill focuses exclusively on the Docker + VPS rsync-based deployment pattern and delegates all GitHub Actions syntax questions to that skill.
