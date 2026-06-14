# 📖 Explication détaillée du repo — Compte rendu

Ce document explique **concrètement** le contenu de ce repo et les choix techniques pris. À utiliser comme base pour ton compte rendu / dossier de soutenance.

---

## 1. Contexte général

### 1.1 Objectif de l'atelier

Mettre en place une infrastructure de **continuité et reprise d'activité** pour une application web réelle, en utilisant les outils standards du monde DevOps :

- **Kubernetes** (orchestrateur de conteneurs) — pour l'auto-healing
- **Packer** (HashiCorp) — pour construire des images Docker reproductibles
- **Ansible** — pour automatiser le déploiement
- **K3d** — pour faire tourner Kubernetes dans Docker (lightweight, idéal pour atelier)
- **GitHub Codespace** — environnement de dev cloud, portable, reproductible

### 1.2 Application choisie : Trombinoscope

Au lieu d'une app jouet, j'ai utilisé un **vrai projet** : Trombinoscope est une application de gestion d'élèves avec :
- Backend Node.js (Express + Prisma)
- Frontend React (Vite + Tailwind)
- Base PostgreSQL
- Upload de photos
- Génération de PDF

Cela permet de tester le PRA/PCA dans des conditions réalistes (stockage relationnel, état applicatif complexe).

---

## 2. Architecture technique

### 2.1 Vue d'ensemble

```
                     ┌────────────────────────┐
                     │   Cluster K3d          │
                     │   (1 server + 2 agents)│
                     │   namespace: trombi    │
                     └────────────────────────┘
        ┌────────────┐   ┌────────────┐   ┌─────────────┐
        │ frontend   │──▶│  backend   │──▶│  postgres   │
        │  (nginx)   │   │ (Node.js)  │   │   (PG 16)   │
        │   :80      │   │   :3000    │   │    :5432    │
        └────────────┘   └────────────┘   └──────┬──────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  trombi-data  │ (PVC 1Gi)
                                          └───────────────┘

                       ┌─────────────────────────────────┐
                       │  CronJob postgres-backup        │
                       │  pg_dump toutes les 1 minute    │──▶ trombi-backup (PVC 1Gi)
                       └─────────────────────────────────┘
```

### 2.2 Cluster Kubernetes

Le cluster K3d comprend **3 nœuds** :
- **1 server** (`k3d-trombi-server-0`) — control plane (API Kubernetes, scheduler, etcd)
- **2 agents** (`k3d-trombi-agent-0/1`) — workers où tournent les pods applicatifs

Pourquoi 3 nœuds ? Pour simuler un mini-cluster réaliste et permettre des tests de répartition de charge.

### 2.3 Namespace

Tout est isolé dans le namespace `trombi` pour éviter les conflits avec d'autres apps potentielles.

---

## 3. Décortiquage des fichiers du repo

### 3.1 Le code applicatif

| Dossier | Contenu | Origine |
|---|---|---|
| `backend/` | API Trombinoscope (Node.js + Express + Prisma) | Copié depuis le repo principal Trombinoscope |
| `frontend/` | UI Trombinoscope (React + Vite) | Copié depuis le repo principal Trombinoscope |

**Pourquoi le code est dans ce repo et pas en submodule ?**
Pour avoir un **repo autonome** : `git clone` + ouvrir Codespace = tout marche, sans devoir cloner un 2e repo.

### 3.2 Build des images : `packer.pkr.hcl`

```hcl
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
      "apt-get update && apt-get install -y openssl libvips ca-certificates",
      "cd /app && npm ci --omit=dev",
      "cd /app && npx prisma generate"
    ]
  }

  post-processor "docker-tag" {
    repository = "trombi/backend"
    tags       = ["1.0"]
  }
}
```

**Ce que Packer fait** :
1. Pull l'image de base `node:20-slim`
2. Démarre un conteneur temporaire
3. Copie le code source dedans
4. Lance des commandes shell pour installer les dépendances
5. Commit le conteneur en une nouvelle image Docker
6. Tag cette image avec `trombi/backend:1.0`

Le même fichier définit aussi un 2e build pour le frontend (image nginx + build Vite).

**Pourquoi Packer plutôt que `docker build` ?**
- Builds **multi-stage en parallèle**
- Variables versionnées (`-var "image_tag=1.0"`)
- Fichier HCL versionnable dans Git
- Portable : on peut transformer le build en AMI AWS / image GCP / VMware avec le même fichier

### 3.3 Configuration Kubernetes (`k8s/`)

Les fichiers sont préfixés par un numéro pour garantir l'**ordre d'application** alphabétique :

#### `00-namespace.yaml`
Crée l'isolation logique `trombi`.

#### `05-secret.yaml`
Centralise tous les secrets (mots de passe, JWT, DATABASE_URL).
```yaml
stringData:
  POSTGRES_USER: trombi
  POSTGRES_PASSWORD: trombi_secret
  POSTGRES_DB: trombinoscope
  DATABASE_URL: postgresql://trombi:trombi_secret@postgres:5432/trombinoscope
  JWT_SECRET: change_me_in_production
```
Les deployments y font référence via `envFrom: secretRef`.

#### `10-pvc-data.yaml` et `11-pvc-backup.yaml`
Deux PersistentVolumeClaim de 1Gi chacun :
- `trombi-data` : volume primaire de Postgres
- `trombi-backup` : volume où le CronJob écrit les dumps

C'est **la clé du PRA/PCA** : les données vivent en dehors des pods.

#### `20-deployment-postgres.yaml`
Postgres 16 avec :
- `envFrom` du Secret (variables d'environnement)
- `PGDATA: /var/lib/postgresql/data/pgdata` — sous-dossier obligatoire car Postgres refuse d'utiliser un mountpoint racine
- `readinessProbe` : `pg_isready` toutes les 5s
- `strategy: Recreate` — pour éviter qu'un nouveau pod essaie d'utiliser le PVC en parallèle de l'ancien (le PVC est en `ReadWriteOnce`)

#### `21-deployment-backend.yaml`
Backend Node.js avec :
- L'image `trombi/backend:1.0` construite par Packer
- Variables d'env mélangeant le Secret + des valeurs en clair (NODE_ENV, PORT)
- Une commande spéciale au démarrage :
  ```yaml
  command: ["/bin/sh", "-lc"]
  args:
    - npx prisma db push --accept-data-loss && node src/server.js
  ```
  → synchronise le schéma Prisma avec la BDD avant de démarrer le serveur
- `readinessProbe: /health` — vérifie que l'API répond

#### `22-deployment-frontend.yaml`
Nginx servant le bundle Vite. Configuration plus simple (pas de DB, juste des fichiers statiques + proxy `/api`).

#### `30-services.yaml`
3 Services ClusterIP qui exposent les pods sur le réseau interne du cluster :
- `postgres:5432` — accessible par le backend
- `backend:3000` — accessible par le frontend (proxy nginx)
- `frontend:80` — accessible via port-forward

Les Services sont des **points d'entrée stables** : leur IP ne change pas, alors que les pods peuvent être recréés.

#### `40-cronjob-backup.yaml`
Le cœur du PRA : un CronJob qui s'exécute toutes les minutes.

```yaml
schedule: "*/1 * * * *"  # toutes les minutes
```

À chaque exécution :
1. Lance un pod éphémère `postgres:16`
2. Connecté au PVC `trombi-backup` sur `/backup`
3. Exécute :
   ```sh
   TS=$(date +%Y%m%d-%H%M%S)
   PGPASSWORD=... pg_dump -h postgres -U trombi -d trombinoscope -Fc -f /backup/trombi-$TS.dump
   ```
4. Le fichier `trombi-YYYYMMDD-HHMMSS.dump` reste dans le PVC

**`-Fc`** = format custom binaire compressé (plus rapide à restore que SQL plain).

### 3.4 Job de restore (`pra/50-job-restore.yaml`)

Job manuel utilisé pour le scénario PRA :
```sh
LATEST=$(ls -t /backup/*.dump | head -1)
PGPASSWORD=... pg_restore -h postgres -U trombi -d trombinoscope --clean --if-exists --no-owner --no-acl $LATEST
```

Options importantes :
- `--clean` : supprime les objets existants avant restore
- `--if-exists` : pas d'erreur si les objets n'existent pas (cas du restore sur DB neuve)
- `--no-owner --no-acl` : ignore les permissions originelles (utile si user/role différent)

### 3.5 Orchestration : `ansible/playbook.yml`

Le playbook fait, dans l'ordre :

1. **Vérifications** : k3d installé, cluster existe, kubectl fonctionne
2. **Import images** : pousse `trombi/backend:1.0` et `trombi/frontend:1.0` dans le cluster
3. **Apply manifestes** : `kubectl apply -f k8s/`
4. **Attente rollouts** : `kubectl rollout status` pour chaque Deployment (postgres, backend, frontend)
5. **Affichage** : liste des services pour vérifier
6. **(Optionnel) Restore** si `-e do_restore=true` :
   - Supprime le Job précédent
   - Applique `pra/50-job-restore.yaml`
   - Attend `condition=complete`
   - Affiche les logs

**Pourquoi Ansible et pas un bash script ?**
- Idempotent (relancer le playbook = pas d'erreur si déjà appliqué)
- Sortie lisible avec `PLAY RECAP`
- Possibilité d'ajouter des hosts distants (déploiement multi-cluster)

### 3.6 Configuration Codespace (`.devcontainer/`)

#### `devcontainer.json`

Décrit comment GitHub Codespace doit créer l'environnement de dev :

```json
{
  "image": "mcr.microsoft.com/devcontainers/base:ubuntu-22.04",
  "features": {
    "docker-in-docker": { "version": "latest" },
    "kubectl-helm-minikube": {},
    "python:1": { "version": "3.12" }
  },
  "postCreateCommand": "bash .devcontainer/post-create.sh"
}
```

Cela donne automatiquement :
- Ubuntu 22.04 de base
- Docker (et permet aux conteneurs de tourner dans le Codespace)
- kubectl + helm + minikube
- Python 3.12

#### `post-create.sh`

Script lancé une seule fois après la création du Codespace, qui installe :
- **k3d** : `curl ... | bash`
- **Packer 1.11.2** : binaire HashiCorp
- **Ansible** + **collection kubernetes.core**

Pour qu'un correcteur n'ait absolument rien à installer manuellement.

---

## 4. Cycle de vie complet

### 4.1 Construction (Build)

```
[Code source]              [Packer]                  [Images Docker]
backend/    ─────────▶  packer build  ─────────▶  trombi/backend:1.0
frontend/   ─────────▶  packer build  ─────────▶  trombi/frontend:1.0
```

### 4.2 Déploiement (Deploy)

```
[Images Docker]      [k3d import]       [Kubernetes manifests]      [Ansible]
trombi/backend  ─▶  cluster registry ─▶  21-deployment-backend ─▶ apply + wait
trombi/frontend ─▶  cluster registry ─▶  22-deployment-frontend ─▶ apply + wait
[postgres:16]   ─▶                ─▶  20-deployment-postgres   ─▶ apply + wait
```

### 4.3 Run (en production)

```
[CronJob toutes les 60s]
    │
    ▼
pg_dump ──▶ trombi-YYYYMMDD-HHMMSS.dump ──▶ PVC trombi-backup
```

### 4.4 Disaster Recovery

```
[Catastrophe : perte trombi-data]
    │
    ▼
1. Recréer PVC vide
2. Redéployer postgres
3. Job pg_restore depuis trombi-backup
4. Redémarrer backend
```

---

## 5. Choix techniques justifiés

### 5.1 Pourquoi `replicas: 1` partout ?

Pour rester **simple et pédagogique**. Dans une vraie prod, on aurait :
- `backend: replicas: 3` (load balancing)
- `frontend: replicas: 2`
- `postgres: replicas: 1` + un Read Replica
- Un **HorizontalPodAutoscaler** pour ajuster automatiquement

Mais ça compliquerait inutilement l'atelier.

### 5.2 Pourquoi pas de Helm ?

Helm est l'outil de "templating Kubernetes" standard. Mais ici :
- Notre infra est petite (8 manifestes)
- Pas besoin de paramétrer plusieurs environnements (dev/staging/prod)
- Le YAML brut est plus pédagogique pour comprendre Kubernetes

### 5.3 Pourquoi pas de Ingress ?

On utilise un simple `kubectl port-forward` pour exposer l'app. Dans une vraie prod, on aurait :
- Un Ingress Controller (nginx-ingress, Traefik)
- Cert-manager pour les certificats HTTPS automatiques
- Un domaine pointant vers l'IP du load balancer

Trop d'overhead pour un atelier, donc port-forward fait le job.

### 5.4 Pourquoi `STORAGE=local` pour les uploads photos ?

Les photos d'élèves sont stockées dans `/app/uploads` du pod backend. C'est **non persistant** (pas de PVC sur ce volume). On aurait pu :
- Monter un 3e PVC pour les uploads
- Utiliser MinIO ou S3

Mais ça sort du scope de l'atelier PRA/PCA centré sur la BDD.

### 5.5 Pourquoi Postgres et pas SQLite (comme l'atelier de base) ?

- SQLite = 1 fichier → trivial à backup (`cp`)
- Postgres = vraie BDD → besoin de `pg_dump` / `pg_restore`

Postgres représente bien plus le cas réel rencontré en entreprise.

---

## 6. Limites et améliorations possibles

### 6.1 Limites actuelles

| Limite | Impact | Solution prod |
|---|---|---|
| PVC backup local au cluster | Si tout le cluster meurt → backup perdu | Backup vers S3/Azure Blob |
| Pas de chiffrement des dumps | Lecture en clair des données sensibles | Chiffrer avec `gpg` ou `age` |
| Aucun test de restore automatisé | Backup peut être corrompu sans qu'on le sache | Job hebdo qui restore + vérifie un échantillon |
| `replicas: 1` partout | Une panne de pod = downtime | `replicas: 3` + PodDisruptionBudget |
| Pas de monitoring | On ne sait pas si un backup échoue | Prometheus + AlertManager |
| Secrets en clair dans Git | Mauvaise pratique sécurité | Sealed Secrets / External Secrets Operator |

### 6.2 Pour aller plus loin

- **Velero** : outil pro de backup Kubernetes (snapshots PV, restore cross-cluster)
- **Postgres WAL streaming** : réplication temps réel pour RPO ~0
- **GitOps (ArgoCD/Flux)** : Git = source of truth, application auto sur push
- **Service Mesh (Istio/Linkerd)** : mTLS, observabilité, traffic management

---

## 7. Compétences mises en œuvre

| Compétence | Où dans le projet |
|---|---|
| Conteneurisation | Packer + Docker images |
| Orchestration | Kubernetes manifestes (k8s/) |
| IaC (Infrastructure as Code) | HCL Packer + YAML K8s + YAML Ansible |
| Automatisation | Playbook Ansible |
| Sauvegarde planifiée | CronJob `pg_dump` |
| Stockage persistant | PVC PostgreSQL |
| Réseau cluster | Services ClusterIP + DNS interne |
| Gestion secrets | Kubernetes Secret |
| Dev environment reproductible | devcontainer.json + post-create.sh |
| CI/CD prête | Repo Git versionné + Codespace |
| Concepts PRA/PCA | Scénarios documentés (RTO/RPO mesurés) |

---

## 8. Conclusion

Ce projet montre **concrètement** comment construire une infrastructure résiliente avec les outils modernes du DevOps. Les scénarios PCA et PRA démontrent que :

- **Le PCA est "gratuit"** quand on conçoit son archi correctement (Deployments + PVC)
- **Le PRA demande du travail** mais est indispensable pour les vrais incidents
- **L'automatisation** (Packer + Ansible) rend la procédure reproductible et testable
- **Un Codespace** rend tout cela portable et démontrable en 1 clic

---

## 📚 Annexes

### Glossaire

| Terme | Définition |
|---|---|
| **PCA** | Plan de Continuité d'Activité — le service reste disponible malgré une panne |
| **PRA** | Plan de Reprise d'Activité — comment retrouver l'état avant catastrophe |
| **RTO** | Recovery Time Objective — temps maximum pour redevenir opérationnel |
| **RPO** | Recovery Point Objective — perte de données maximale acceptable (en temps) |
| **Pod** | Plus petite unité Kubernetes — contient 1+ conteneurs |
| **Deployment** | Décrit l'état souhaité d'un ensemble de pods (replicas, image) |
| **Service** | Point d'entrée stable pour accéder aux pods |
| **PVC** | PersistentVolumeClaim — volume de stockage persistant |
| **CronJob** | Job exécuté périodiquement selon un planning cron |
| **Namespace** | Isolation logique d'un groupe de ressources |
| **K3d** | K3s exécuté dans Docker (lightweight Kubernetes) |
| **Packer** | Outil HashiCorp pour builder des images de manière reproductible |
| **Ansible** | Outil d'automatisation par playbooks YAML |

### Liens utiles

- [Documentation Kubernetes](https://kubernetes.io/docs/)
- [K3d](https://k3d.io)
- [Packer Docker builder](https://developer.hashicorp.com/packer/integrations/hashicorp/docker)
- [Ansible kubernetes.core](https://docs.ansible.com/ansible/latest/collections/kubernetes/core/)
- [Postgres backup strategies](https://www.postgresql.org/docs/current/backup.html)
