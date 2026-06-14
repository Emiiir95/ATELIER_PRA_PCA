# ATELIER PRA/PCA — Trombinoscope

Mini-PRA/PCA appliqué au projet **Trombinoscope** (Node.js + Postgres + React) déployé sur **Kubernetes K3d** dans un **GitHub Codespace**.

L'application Trombinoscope (gestion d'élèves, classes, photos, génération PDF) est déployée dans un cluster Kubernetes local. La base PostgreSQL est stockée sur un volume persistant `trombi-data`. Toutes les minutes, un CronJob réalise un `pg_dump` vers un second volume `trombi-backup`. L'**image applicative est construite avec Packer**, le **déploiement orchestré avec Ansible**.

Cet atelier illustre la différence entre :
- **PCA** (continuité) : Kubernetes recrée automatiquement un pod détruit, aucune perte de données
- **PRA** (reprise) : restauration de la base depuis le dernier backup après perte du volume

---

## Architecture

```
                     ┌─────────────────┐
                     │  Cluster K3d    │
                     │   namespace:    │
                     │     trombi      │
                     └─────────────────┘
       ┌───────────┐   ┌───────────┐   ┌────────────┐
       │ frontend  │──▶│  backend  │──▶│ postgres   │
       │ (nginx)   │   │ (Node.js) │   │  (Pg 16)   │
       │  :80      │   │  :3000    │   │   :5432    │
       └───────────┘   └───────────┘   └─────┬──────┘
                                              │
                                       ┌──────▼──────┐
                                       │ trombi-data │  (PVC 1Gi)
                                       └─────────────┘

                       ┌────────────────────────┐
                       │ CronJob (1min)         │
                       │   pg_dump → /backup    │──▶ trombi-backup (PVC 1Gi)
                       └────────────────────────┘
```

---

## Séquence 1 — Codespace

1. **Fork** ce repo
2. Sur ton fork : **Code → Codespaces → Create codespace on main**
3. Attends que le `postCreateCommand` finisse (~3 min : k3d, packer, ansible sont installés automatiquement)

---

## Séquence 2 — Créer le cluster

```bash
# Crée le cluster K3d (1 master + 2 workers)
k3d cluster create trombi --servers 1 --agents 2

# Vérifie
kubectl get nodes
```

---

## Séquence 3 — Builder les images avec Packer

```bash
packer init .
packer build -var "image_tag=1.0" .

# Vérifie
docker images | grep trombi
# trombi/backend   1.0   ...
# trombi/frontend  1.0   ...
```

Packer construit **2 images** :
- `trombi/backend:1.0` — Node 20 + Prisma + dépendances backend
- `trombi/frontend:1.0` — Vite build → Nginx alpine servant les statics

---

## Séquence 4 — Déployer avec Ansible

```bash
# Import les images dans le cluster k3d
k3d image import trombi/backend:1.0 -c trombi
k3d image import trombi/frontend:1.0 -c trombi

# Déploie tout (postgres + backend + frontend + CronJob backup)
ansible-playbook ansible/playbook.yml
```

Le playbook :
1. Vérifie que le cluster K3d existe (le crée sinon)
2. Importe les images Docker
3. Applique tous les manifestes `k8s/`
4. Attend que chaque déploiement soit `Ready`
5. Affiche les services

---

## Séquence 5 — Accéder à l'application

```bash
# Forward le port 80 du frontend vers ton Codespace
kubectl -n trombi port-forward svc/frontend 8080:80 >/tmp/web.log 2>&1 &
```

Dans Codespace, onglet **PORTS** → rends **public** le port 8080. Ouvre l'URL.

**Connexion** :
- Email : `admin@trombi.fr`
- Mot de passe : `Admin123!`

(Le seed se fait au premier démarrage backend, voir notes ci-dessous)

### Seed initial de la base

Une fois le backend Ready, exécute le seed pour créer les comptes admin/teacher et les classes/élèves :

```bash
kubectl -n trombi exec -it deploy/backend -- node prisma/seed.js
```

---

## Séquence 6 — Visualiser les backups

Le CronJob `postgres-backup` tourne **toutes les minutes** :

```bash
# Liste les backups dans le PVC trombi-backup
kubectl -n trombi run debug-backup \
  --rm -it --image=alpine \
  --overrides='{"spec":{"containers":[{"name":"debug","image":"alpine","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"backup","mountPath":"/backup"}]}],"volumes":[{"name":"backup","persistentVolumeClaim":{"claimName":"trombi-backup"}}]}}'

# Une fois dans le pod :
ls -lh /backup
exit
```

Tu verras les fichiers `trombi-YYYYMMDD-HHMMSS.dump`.

---

## 💥 Scénario 1 : PCA — Crash du pod backend

Objectif : démontrer que **Kubernetes recrée automatiquement** un pod détruit, **sans perte de données**.

```bash
# Avant : on note l'ID du pod
kubectl -n trombi get pods -l app=backend

# On supprime le pod
kubectl -n trombi delete pod -l app=backend

# Kubernetes en recrée un automatiquement
kubectl -n trombi get pods -l app=backend -w
# (Ctrl+C pour sortir)
```

**Observation** : un nouveau pod apparaît en quelques secondes. Connecte-toi à l'app → toutes les données sont là (la BDD est dans le PVC, hors du pod).

**Mesure** :
- **RTO** (Recovery Time Objective) : ~10-30 s (temps de redémarrage du pod)
- **RPO** (Recovery Point Objective) : 0 (aucune perte de données)

---

## 💥 Scénario 2 : PRA — Perte du volume de données

Objectif : simuler une perte de la base (suppression du PVC), puis **restaurer depuis le dernier backup**.

### Étape A : ajouter de la donnée

Crée quelques élèves via l'UI (ou un appel API). Vérifie qu'au moins 1 minute s'est écoulée depuis ton dernier ajout pour avoir un backup à jour.

### Étape B : détruire le volume de données

```bash
# Supprime le déploiement postgres (libère le PVC)
kubectl -n trombi delete deployment postgres

# Supprime le PVC contenant les données
kubectl -n trombi delete pvc trombi-data
```

⚠️ À ce stade, la BDD est **vide**.

### Étape C : recréer le PVC + redéployer

```bash
kubectl apply -f k8s/10-pvc-data.yaml
kubectl apply -f k8s/20-deployment-postgres.yaml

# Attends que Postgres soit prêt
kubectl -n trombi rollout status deployment/postgres
```

### Étape D : restaurer depuis le backup

```bash
# Joue le Job de restauration (pg_restore depuis le dernier .dump)
ansible-playbook ansible/playbook.yml -e do_restore=true
```

Ou manuellement :

```bash
kubectl apply -f pra/50-job-restore.yaml
kubectl -n trombi wait --for=condition=complete job/postgres-restore --timeout=180s
kubectl -n trombi logs job/postgres-restore
```

### Étape E : vérifier

Reconnecte-toi à l'application → toutes les données du dernier backup sont restaurées.

**Mesure** :
- **RTO** : ~1-2 min (redéploiement + restore)
- **RPO** : ≤ 1 min (intervalle entre 2 backups CronJob)

---

## Structure du repo

```
.
├── .devcontainer/        # Configuration Codespace (devcontainer.json + post-create.sh)
├── ansible/
│   └── playbook.yml      # Orchestration du déploiement K8s
├── backend/              # Code source Trombinoscope backend (Node.js + Prisma)
├── frontend/             # Code source Trombinoscope frontend (React + Vite)
├── k8s/                  # Manifestes Kubernetes
│   ├── 00-namespace.yaml
│   ├── 05-secret.yaml
│   ├── 10-pvc-data.yaml
│   ├── 11-pvc-backup.yaml
│   ├── 20-deployment-postgres.yaml
│   ├── 21-deployment-backend.yaml
│   ├── 22-deployment-frontend.yaml
│   ├── 30-services.yaml
│   └── 40-cronjob-backup.yaml
├── pra/
│   └── 50-job-restore.yaml   # Job de restore postgres
├── packer.pkr.hcl        # Build des 2 images Docker (backend + frontend)
└── README.md
```

---

## Notes & limites

- Le cluster K3d tourne dans le Codespace : **éphémère**, tout disparaît quand le Codespace s'éteint.
- Pour un vrai PRA prod, il faudrait **réplication géographique** (backup vers un stockage hors-cluster, type S3).
- Le `JWT_SECRET` dans `k8s/05-secret.yaml` est dev — à changer en prod.
- L'option `STORAGE=local` du backend stocke les photos dans `/app/uploads` (éphémère). Pour persister, brancher MinIO ou S3.
