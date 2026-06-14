packer {
  required_plugins {
    docker = {
      source  = "github.com/hashicorp/docker"
      version = ">= 1.1.0"
    }
  }
}

variable "image_tag" {
  type    = string
  default = "1.0"
}

variable "backend_image" {
  type    = string
  default = "trombi/backend"
}

variable "frontend_image" {
  type    = string
  default = "trombi/frontend"
}

# ── Backend (Node.js 20 + Prisma) ──────────────────────────────────
source "docker" "backend" {
  image  = "node:20-slim"
  commit = true
}

build {
  name    = "trombi-backend"
  sources = ["source.docker.backend"]

  provisioner "file" {
    source      = "backend/"
    destination = "/app"
  }

  provisioner "shell" {
    inline = [
      "set -eux",
      "apt-get update -y && apt-get install -y openssl libvips ca-certificates && rm -rf /var/lib/apt/lists/*",
      "cd /app && npm ci --omit=dev",
      "cd /app && npx prisma generate",
      "mkdir -p /app/uploads /app/exports",
      "echo 'Backend build done.'"
    ]
  }

  post-processor "docker-tag" {
    repository = var.backend_image
    tags       = [var.image_tag]
  }
}

# ── Frontend (Vite build → nginx) ──────────────────────────────────
source "docker" "frontend" {
  image  = "nginx:alpine"
  commit = true
}

build {
  name    = "trombi-frontend"
  sources = ["source.docker.frontend"]

  provisioner "shell" {
    inline = [
      "set -eux",
      "apk add --no-cache nodejs npm",
      "npm install -g pnpm@9",
      "mkdir -p /build"
    ]
  }

  provisioner "file" {
    source      = "frontend/"
    destination = "/build"
  }

  provisioner "file" {
    source      = "frontend/nginx.conf"
    destination = "/etc/nginx/conf.d/default.conf"
  }

  provisioner "shell" {
    inline = [
      "set -eux",
      "cd /build && pnpm install --frozen-lockfile && pnpm build",
      "rm -rf /usr/share/nginx/html/*",
      "cp -r /build/dist/. /usr/share/nginx/html/",
      "rm -rf /build /root/.npm /root/.pnpm-store",
      "apk del nodejs npm || true",
      "echo 'Frontend build done.'"
    ]
  }

  post-processor "docker-tag" {
    repository = var.frontend_image
    tags       = [var.image_tag]
  }
}
