# ATELIER PRA/PCA — Trombinoscope sur Kubernetes

Mini-atelier de **PRA/PCA** (Plan de Reprise / Continuité d'Activité) appliqué au projet **Trombinoscope** (Node.js + Postgres + React).

L'application est déployée dans un cluster **Kubernetes K3d** tournant à l'intérieur d'un **GitHub Codespace**. Les images sont construites avec **Packer**, le déploiement orchestré avec **Ansible**.

L'objectif est d'expérimenter concrètement la différence entre :
- **PCA** (continuité) : Kubernetes recrée automatiquement les pods détruits → service jamais interrompu, données préservées (volume persistant)
- **PRA** (reprise) : restauration manuelle des données depuis un backup après perte totale du volume

---

## 📐 Architecture

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

### Composants

| Composant | Rôle | Image Docker | Port |
|---|---|---|---|
| **frontend** | UI React (Vite build servi par Nginx). Proxifie `/api/*` vers le backend. | `trombi/frontend:1.0` | 80 |
| **backend** | API Node.js (Express + Prisma). Exécute `prisma db push` au démarrage pour synchroniser le schéma BDD. | `trombi/backend:1.0` | 3000 |
| **postgres** | Base de données PostgreSQL 16. Données stockées sur le PVC `trombi-data`. | `postgres:16` | 5432 |
| **postgres-backup** | CronJob qui lance `pg_dump` toutes les minutes vers le PVC `trombi-backup`. | `postgres:16` | — |
| **postgres-restore** | Job manuel qui restaure depuis le dernier dump (`pg_restore`). | `postgres:16` | — |

### Volumes persistants

| PVC | Taille | Contenu |
|---|---|---|
| `trombi-data` | 1Gi | Fichiers de la base PostgreSQL (`/var/lib/postgresql/data/pgdata`) |
| `trombi-backup` | 1Gi | Fichiers de backup `trombi-YYYYMMDD-HHMMSS.dump` |

---

## 🗂️ Structure du repo

```
.
├── .devcontainer/
│   ├── devcontainer.json         # Config Codespace (Docker-in-Docker + kubectl)
│   └── post-create.sh            # Installe k3d, Packer, Ansible automatiquement
│
├── backend/                      # Code source du backend Trombinoscope
│   ├── src/                      # Routes, controllers, services, middlewares
│   ├── prisma/                   # Schéma Prisma + seed + migrations
│   ├── tests/                    # Tests Jest
│   ├── Dockerfile                # Build manuel (non utilisé — Packer s'en charge)
│   └── package.json
│
├── frontend/                     # Code source du frontend Trombinoscope
│   ├── src/                      # Pages React, composants, context
│   ├── nginx.conf                # Reverse-proxy /api → backend:3000
│   ├── Dockerfile                # Build manuel (non utilisé — Packer s'en charge)
│   └── package.json
│
├── packer.pkr.hcl                # Définit le build des 2 images Docker
│
├── k8s/                          # Manifestes Kubernetes (appliqués dans l'ordre alphabétique)
│   ├── 00-namespace.yaml         # Crée le namespace "trombi"
│   ├── 05-secret.yaml            # Secret avec DATABASE_URL, JWT_SECRET, POSTGRES_*
│   ├── 10-pvc-data.yaml          # PVC pour les données PostgreSQL
│   ├── 11-pvc-backup.yaml        # PVC pour les backups
│   ├── 20-deployment-postgres.yaml  # Deployment PostgreSQL + probes
│   ├── 21-deployment-backend.yaml   # Deployment backend Node.js
│   ├── 22-deployment-frontend.yaml  # Deployment frontend Nginx
│   ├── 30-services.yaml          # 3 Services ClusterIP (postgres, backend, frontend)
│   └── 40-cronjob-backup.yaml    # CronJob pg_dump chaque minute
│
├── pra/
│   └── 50-job-restore.yaml       # Job manuel de restore (utilisé dans le scénario PRA)
│
├── ansible/
│   └── playbook.yml              # Orchestration : cluster + import images + apply manifests
│
├── SCENARIO_1.md                 # Walkthrough détaillé du scénario PCA
└── README.md                     # Ce fichier
```

---

## 🚀 Comment ça marche : le déroulé complet

### Étape 1 — Ouvrir un Codespace

Sur le repo GitHub, clique sur **Code → Codespaces → Create codespace on main**.

Un environnement Linux Ubuntu démarre dans VS Code (dans ton navigateur). Le script `.devcontainer/post-create.sh` installe automatiquement :
- **k3d** (lance Kubernetes dans Docker)
- **Packer** v1.11.2 (build des images Docker)
- **Ansible** + collection `kubernetes.core`

⏱️ Durée : ~3 min après création du Codespace.

### Étape 2 — Créer le cluster Kubernetes

```bash
k3d cluster create trombi --servers 1 --agents 2
```

Ça lance 4 conteneurs Docker :
- `k3d-trombi-server-0` : nœud master Kubernetes (le "control plane")
- `k3d-trombi-agent-0` et `k3d-trombi-agent-1` : 2 nœuds workers
- `k3d-trombi-serverlb` : load balancer interne

Vérification :
```bash
kubectl get nodes
```
→ 3 nœuds en statut `Ready`.

### Étape 3 — Construire les images avec Packer

```bash
packer init .
packer build -var "image_tag=1.0" .
```

Packer lit le fichier `packer.pkr.hcl` qui définit **2 builds en parallèle** :

**Build #1 (backend)** :
1. Pull `node:20-slim`
2. Copie `backend/` dans `/app`
3. Installe `openssl`, `libvips` (pour la lib `sharp` de manipulation d'images)
4. `npm ci` + `npx prisma generate`
5. Tag final : `trombi/backend:1.0`

**Build #2 (frontend)** :
1. Pull `nginx:alpine`
2. Installe temporairement Node + pnpm
3. Copie `frontend/` dans `/build`
4. Copie `nginx.conf` dans `/etc/nginx/conf.d/default.conf`
5. `pnpm install` + `pnpm build`
6. Copie le résultat dans `/usr/share/nginx/html`
7. Désinstalle Node + pnpm (image plus légère)
8. Tag final : `trombi/frontend:1.0`

⏱️ Durée : ~2 min pour les 2 images en parallèle.

```bash
docker images | grep trombi
# trombi/backend    1.0   ~1 GB
# trombi/frontend   1.0   ~417 MB
```

### Étape 4 — Importer les images dans K3d

K3d a son propre registre interne (séparé de Docker). Il faut copier les images dedans :

```bash
k3d image import trombi/backend:1.0 -c trombi
k3d image import trombi/frontend:1.0 -c trombi
```

Ces commandes packagent l'image en tarball et la chargent dans chaque nœud du cluster.

### Étape 5 — Déployer avec Ansible

```bash
ansible-playbook ansible/playbook.yml
```

Ce playbook fait, dans l'ordre :
1. Vérifie que k3d et le cluster existent
2. Importe les 2 images dans le cluster (redondant mais idempotent)
3. `kubectl apply -f k8s/` → applique tous les manifestes :
   - Crée le namespace `trombi`
   - Crée le Secret (mots de passe, JWT_SECRET, DATABASE_URL)
   - Crée les 2 PVC
   - Lance les 3 Deployments (postgres, backend, frontend)
   - Crée les 3 Services (ClusterIP interne)
   - Active le CronJob de backup
4. Attend que chaque Deployment soit `Ready` (status check toutes les 5s)
5. Affiche la liste finale des services

### Étape 6 — Seeder la base ⚠️ OBLIGATOIRE

```bash
kubectl -n trombi exec -it deploy/backend -- node prisma/seed.js
```

⚠️ **À refaire à chaque fois que la BDD est vide** :
- Au premier déploiement (BDD vide)
- Après suppression du PVC `trombi-data` sans restore
- Si tu fais `kubectl delete namespace trombi` et redéploies

(Pas besoin de re-seed après le scénario PRA si tu as bien restauré — le restore remet les données.)

Crée :
- 3 utilisateurs : `admin@trombi.fr / Admin123!` (admin) + 2 teachers (`dupont@trombi.fr` et `martin@trombi.fr` / `Teacher123!`)
- 3 classes : BTS SIO SLAM, BTS SIO SISR, Bachelor DevOps
- 15 élèves dont 12 avec photos seed

### Étape 7 — Accéder à l'app

```bash
kubectl -n trombi port-forward svc/frontend 8080:80 > /tmp/web.log 2>&1 &
```

Dans Codespace, onglet **PORTS** (en bas, à côté de Terminal) :
1. Port 8080 apparaît automatiquement
2. Clic droit → **Port Visibility → Public**
3. Clic sur 🌐 → ouvre l'URL `https://<id>-8080.app.github.dev/`

Connecte-toi : `admin@trombi.fr` / `Admin123!`

---

## 💡 Comprendre les concepts clés

### Pourquoi Kubernetes ?

Imagine que ton backend crash en pleine nuit. Avec Docker simple :
- Le conteneur est mort
- Tu dois te lever et faire `docker restart`

Avec Kubernetes :
- Le pod est détruit
- Le **Deployment** veille → il en relance un automatiquement
- Le service continue à fonctionner pour les utilisateurs

C'est le principe du **PCA** : continuité automatique.

### Pourquoi des PVC (PersistentVolumeClaim) ?

Si Postgres stockait ses données **dans le conteneur**, à chaque redémarrage tout serait perdu. Le PVC est un volume **externe** au pod : le pod meurt, mais les données restent.

C'est ce qui permet au scénario PCA de fonctionner : on tue le pod backend → la BDD survit.

### Pourquoi des backups (CronJob) ?

Le PVC peut quand même être perdu (corruption disque, suppression accidentelle, attaque ransomware…). Sans backup → données perdues définitivement.

Le **CronJob** `postgres-backup` exécute `pg_dump` toutes les minutes vers un **second PVC** (`trombi-backup`). C'est le principe du **PRA** : si la base est perdue, on restaure depuis le dernier dump.

### Pourquoi Packer ?

Au lieu de `docker build` à la main, Packer permet de :
- Versionner la construction (image_tag=1.0)
- Builder en parallèle plusieurs images
- Définir le build dans un fichier HCL versionnable
- Faire la même chose pour AWS AMI, GCP, etc. (multi-cloud)

### Pourquoi Ansible ?

Pour déployer **sans erreurs humaines**. Au lieu de :
```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/05-secret.yaml
kubectl apply -f k8s/10-pvc-data.yaml
# ...etc
kubectl rollout status deployment/postgres
# ...etc
```

Tu fais juste :
```bash
ansible-playbook ansible/playbook.yml
```

Et tout est appliqué dans l'ordre, avec retry, avec attente que chaque service soit prêt.

---

## 🎬 Scénarios PRA/PCA

Pour les détails commentés étape par étape, voir les fichiers dédiés :
- **[SCENARIO_1.md](SCENARIO_1.md)** — PCA, crash du pod backend (~5 min)
- **[SCENARIO_2.md](SCENARIO_2.md)** — PRA, perte du volume + restore (~15 min)

Ci-dessous, **toutes les commandes** à exécuter pour les 2 scénarios.

---

### 🎬 Scénario 1 — PCA : Crash du pod backend

**Objectif** : montrer que Kubernetes recrée automatiquement un pod détruit, sans intervention et sans perte de données.

```bash
# 1. État initial : note le nom du pod backend
kubectl -n trombi get pods -l app=backend
# → backend-XXXXXXXXXX-YYYYY   1/1   Running   0   12m

# 2. Détruis le pod
kubectl -n trombi delete pod -l app=backend

# 3. Observe Kubernetes recréer un pod automatiquement
kubectl -n trombi get pods -l app=backend -w
# (Ctrl+C pour sortir une fois le nouveau pod en Running 1/1)

# 4. Recharge l'app dans ton navigateur : tout est intact
```

**Résultat attendu** :
- Nouveau pod avec un nom différent
- `RESTARTS = 0` (c'est un nouveau pod, pas un restart)
- App fonctionnelle, données intactes

**Mesures pour le rapport** :
- **RTO** ≈ 10-30 secondes
- **RPO** = 0 (aucune perte, la BDD est sur un PVC séparé)

---

### 🎬 Scénario 2 — PRA : Perte du volume + restore

**Objectif** : simuler une perte totale de la base, puis restaurer depuis le dernier backup.

#### Étape A — Préparer : ajouter des données + vérifier les backups

```bash
# 1. Connecte-toi à l'app et crée 2-3 élèves via l'UI
# (ou via API si tu préfères)

# 2. Vérifie que le CronJob a déjà tourné au moins une fois
kubectl -n trombi get cronjob
# NAME              SCHEDULE      ...   LAST SCHEDULE   AGE
# postgres-backup   */1 * * * *   ...   30s             5m

kubectl -n trombi get jobs
# NAME                         STATUS      COMPLETIONS   AGE
# postgres-backup-XXXXXXXXXX   Complete    1/1           2m
```

⚠️ Si tu ne vois pas de job `Complete`, **attends 1-2 minutes** que le CronJob fasse son premier passage.

```bash
# 3. (Optionnel) Visualiser les fichiers de backup dans le PVC
kubectl -n trombi run debug-backup --rm -it --image=alpine \
  --overrides='{"spec":{"containers":[{"name":"debug","image":"alpine","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"backup","mountPath":"/backup"}]}],"volumes":[{"name":"backup","persistentVolumeClaim":{"claimName":"trombi-backup"}}]}}'

# Dans le pod alpine :
ls -lh /backup
# trombi-20260614-130100.dump
# trombi-20260614-130200.dump
# ...
exit
```

#### Étape B — Détruire la base (catastrophe simulée)

```bash
# 1. Supprime le Deployment postgres (libère le PVC)
kubectl -n trombi delete deployment postgres

# 2. Supprime le PVC contenant les données → toute la BDD est PERDUE
kubectl -n trombi delete pvc trombi-data
```

À ce stade :
- Plus de pod postgres
- Le backend essaie de se reconnecter et échoue (`CrashLoopBackOff`)
- L'app dans le navigateur renvoie des erreurs 500

#### Étape C — Recréer l'infrastructure vide

```bash
# 1. Recrée le PVC trombi-data (vide)
kubectl apply -f k8s/10-pvc-data.yaml

# 2. Redéploie postgres
kubectl apply -f k8s/20-deployment-postgres.yaml

# 3. Attends qu'il soit Ready
kubectl -n trombi rollout status deployment/postgres --timeout=180s
```

À ce stade, la BDD existe mais est **vide** (pas de tables, pas de données).

#### Étape D — Restaurer depuis le dernier backup

```bash
# Méthode 1 (recommandée) : via Ansible
ansible-playbook ansible/playbook.yml -e do_restore=true

# Méthode 2 : kubectl direct
kubectl apply -f pra/50-job-restore.yaml
kubectl -n trombi wait --for=condition=complete job/postgres-restore --timeout=180s
kubectl -n trombi logs job/postgres-restore
```

Le Job `postgres-restore` :
1. Liste les `.dump` dans `/backup` et prend le plus récent
2. Lance `pg_restore` pour réimporter le schéma + les données

#### Étape E — Redémarrer le backend (pour qu'il se reconnecte)

```bash
# Force le pod backend à redémarrer (il avait CrashLoopBackOff)
kubectl -n trombi delete pod -l app=backend

# Attends qu'il soit Ready
kubectl -n trombi rollout status deployment/backend
```

#### Étape F — Vérifier

Recharge l'app dans ton navigateur → les élèves créés à l'étape A sont **revenus** ✅

**Mesures pour le rapport** :
- **RTO** ≈ 1-2 min (redéploiement postgres + restore)
- **RPO** ≤ 1 min (intervalle entre 2 backups du CronJob)

---

### 🧹 Nettoyer entre 2 scénarios

Si tu veux **réinitialiser proprement** entre 2 tests :

```bash
# Re-déploie tout depuis zéro
ansible-playbook ansible/playbook.yml

# Ou pour TOUT supprimer et repartir vierge :
kubectl delete namespace trombi
ansible-playbook ansible/playbook.yml
# Puis re-seed :
kubectl -n trombi exec -it deploy/backend -- node prisma/seed.js
```

---

## 🆘 Troubleshooting

### `kubectl get nodes` → connection refused
Le cluster K3d n'est pas démarré. Lance `k3d cluster create trombi --servers 1 --agents 2`.

### Port 8080 already in use
Un précédent port-forward tourne encore :
```bash
pkill -f "port-forward"
kubectl -n trombi port-forward svc/frontend 8080:80 > /tmp/web.log 2>&1 &
```

### Build Packer échoue
Vérifie que Docker tourne dans le Codespace :
```bash
docker ps
```

### Pod backend en `CrashLoopBackOff`
Probablement Postgres pas encore prêt. Vérifie :
```bash
kubectl -n trombi get pods
kubectl -n trombi logs deploy/backend
```

---

## 📚 Concepts à connaître pour la soutenance

| Terme | Définition |
|---|---|
| **PCA** | Plan de Continuité d'Activité — le service reste disponible malgré une panne |
| **PRA** | Plan de Reprise d'Activité — comment retrouver l'état avant catastrophe |
| **RTO** | Recovery Time Objective — temps maximum pour redevenir opérationnel |
| **RPO** | Recovery Point Objective — perte de données maximale acceptable (en temps) |
| **Pod** | Plus petite unité Kubernetes — contient 1 ou plusieurs conteneurs |
| **Deployment** | Décrit l'état souhaité d'un ensemble de pods (replicas, image, etc.) |
| **Service** | Point d'entrée stable pour accéder aux pods (load balancing interne) |
| **PVC** | PersistentVolumeClaim — volume de stockage persistant, externe aux pods |
| **CronJob** | Job exécuté périodiquement selon un planning cron |
| **Namespace** | Isolation logique d'un groupe de ressources dans le cluster |
