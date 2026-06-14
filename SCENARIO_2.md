# 🎬 Scénario 2 — PRA : Perte du volume de données + Restore

## 🎯 Objectif

Simuler une **catastrophe** : perte totale du volume de la base de données (corruption disque, suppression accidentelle, ransomware…). Puis **restaurer** depuis le dernier backup automatique.

C'est le principe du **PRA** (Plan de Reprise d'Activité) : qu'est-ce qu'on fait quand le PCA n'a pas suffi ?

---

## 📋 Pré-requis

```bash
cd /workspaces/ATELIER_PRA_PCA

# Cluster + app déployés et fonctionnels
kubectl -n trombi get pods
# postgres, backend, frontend tous en Running

# Au moins 1 backup créé par le CronJob
kubectl -n trombi get jobs
# Tu dois voir au moins un postgres-backup-XXXX en Complete
```

⚠️ Si tu viens juste de déployer, **attends 1-2 minutes** que le CronJob fasse son premier passage avant de continuer.

---

## 🎭 Le scénario

### Situation initiale

Tu as une app en production avec des données importantes (utilisateurs, classes, photos).

**Soudain**, le volume de stockage Postgres est **corrompu** ou **supprimé** (erreur d'un admin, attaque malveillante, panne disque…).

→ **Question** : comment retrouver tes données ?

---

## 📜 Déroulé pas à pas

### Étape A — Préparer la situation

#### A.1 — Ajouter des données fraîches

Pour pouvoir vérifier la restauration, on a besoin de **données récentes**.

1. Ouvre l'app dans ton navigateur (https://...-8080.app.github.dev)
2. Connecte-toi (`admin@trombi.fr` / `Admin123!`)
3. Va sur la page **Élèves** et **crée 2-3 élèves** avec des noms reconnaissables (ex: "Test1 Backup", "Test2 Restore")

#### A.2 — Vérifier que le CronJob a tourné

Le CronJob `postgres-backup` doit avoir effectué au moins 1 backup **après** tes ajouts.

```bash
# Voir le planning du CronJob
kubectl -n trombi get cronjob
```

**Sortie attendue** :
```
NAME              SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
postgres-backup   */1 * * * *   False     0        30s             5m
```

- `SCHEDULE: */1 * * * *` = toutes les minutes
- `LAST SCHEDULE: 30s` = le dernier backup date d'il y a 30 secondes

```bash
# Voir les jobs exécutés
kubectl -n trombi get jobs
```

**Sortie attendue** :
```
NAME                         STATUS      COMPLETIONS   DURATION   AGE
postgres-backup-29234560     Complete    1/1           3s         4m
postgres-backup-29234561     Complete    1/1           3s         3m
postgres-backup-29234562     Complete    1/1           3s         2m
postgres-backup-29234563     Complete    1/1           3s         1m
```

Si tu vois plusieurs `Complete`, c'est bon. Sinon attends 1-2 min.

#### A.3 — (Optionnel) Voir les fichiers de backup

Pour confirmer visuellement que les `.dump` existent bien sur le PVC :

```bash
kubectl -n trombi run debug-backup --rm -it --image=alpine \
  --overrides='{"spec":{"containers":[{"name":"debug","image":"alpine","command":["sh"],"stdin":true,"tty":true,"volumeMounts":[{"name":"backup","mountPath":"/backup"}]}],"volumes":[{"name":"backup","persistentVolumeClaim":{"claimName":"trombi-backup"}}]}}'
```

Cette commande lance un mini-conteneur alpine qui monte le PVC `trombi-backup` sur `/backup`.

Dans le pod alpine :
```sh
ls -lh /backup
```

**Sortie attendue** :
```
total 80K
-rw-r--r--    1 root     root        18.5K Jun 14 13:01 trombi-20260614-130100.dump
-rw-r--r--    1 root     root        18.5K Jun 14 13:02 trombi-20260614-130200.dump
-rw-r--r--    1 root     root        18.6K Jun 14 13:03 trombi-20260614-130300.dump
...
```

Pour sortir :
```sh
exit
```

Le pod debug est supprimé automatiquement (`--rm`).

---

### Étape B — La catastrophe : détruire la BDD

#### B.1 — Supprimer le Deployment postgres

```bash
kubectl -n trombi delete deployment postgres
```

**Sortie** :
```
deployment.apps "postgres" deleted from trombi namespace
```

**Ce qui se passe** :
- Le pod postgres est terminé
- Le PVC `trombi-data` n'est plus utilisé (mais existe toujours)
- Le backend perd la connexion à la BDD → il va entrer en `CrashLoopBackOff`

```bash
# Vérification
kubectl -n trombi get pods
```

Tu devrais voir le pod backend en `Error` ou `CrashLoopBackOff` (il essaie de se reconnecter à postgres qui n'existe plus).

#### B.2 — Supprimer le PVC trombi-data

C'est ici qu'on simule la **vraie perte de données** :

```bash
kubectl -n trombi delete pvc trombi-data
```

**Sortie** :
```
persistentvolumeclaim "trombi-data" deleted from trombi namespace
```

⚠️ À ce moment précis :
- Le volume Postgres est **détruit**
- Toute la BDD (users, classes, élèves) est **perdue**
- Si tu te connectes à l'app → erreur 500 partout

**C'est la situation de panne grave qu'on veut savoir gérer.**

---

### Étape C — Reconstruire l'infrastructure

#### C.1 — Recréer le PVC vide

```bash
kubectl apply -f k8s/10-pvc-data.yaml
```

**Sortie** :
```
persistentvolumeclaim/trombi-data created
```

Le PVC existe à nouveau, mais il est **vide** (pas de fichiers Postgres dedans).

#### C.2 — Redéployer postgres

```bash
kubectl apply -f k8s/20-deployment-postgres.yaml
```

Postgres démarre, voit un PVC vide, et **initialise une nouvelle base** (avec juste les tables système Postgres, pas la BDD de l'app).

```bash
# Attendre que postgres soit ready
kubectl -n trombi rollout status deployment/postgres --timeout=180s
```

**Sortie attendue** :
```
deployment "postgres" successfully rolled out
```

À ce stade :
- ✅ Postgres tourne
- ❌ La base est **vide** (pas de tables `Class`, `Student`, etc.)
- ❌ Le backend continue à crasher (`prisma db push` peut réussir, mais pas de données)

---

### Étape D — Restaurer depuis le backup

#### D.1 — Comprendre le Job de restore

Le fichier `pra/50-job-restore.yaml` définit un Job Kubernetes qui :
1. Monte le PVC `trombi-backup` sur `/backup`
2. Cherche le `.dump` le plus récent : `ls -t /backup/*.dump | head -1`
3. Lance `pg_restore` pour réimporter le schéma + les données

#### D.2 — Lancer la restauration

**Méthode 1 — via Ansible** (plus propre) :

```bash
ansible-playbook ansible/playbook.yml -e do_restore=true
```

Cette commande active le bloc `when: do_restore | bool` du playbook qui :
1. Supprime le Job de restore précédent s'il existe
2. Applique `pra/50-job-restore.yaml`
3. Attend que le Job termine
4. Affiche les logs

**Méthode 2 — kubectl direct** :

```bash
# 1. Lancer le Job
kubectl apply -f pra/50-job-restore.yaml

# 2. Attendre qu'il termine
kubectl -n trombi wait --for=condition=complete job/postgres-restore --timeout=180s

# 3. Voir les logs (pour vérifier que tout s'est bien passé)
kubectl -n trombi logs job/postgres-restore
```

**Logs attendus** :
```
+ ls -t /backup/trombi-20260614-130100.dump /backup/trombi-20260614-130200.dump ...
+ head -1
+ LATEST=/backup/trombi-20260614-130545.dump
+ echo 'Restoring from /backup/trombi-20260614-130545.dump'
Restoring from /backup/trombi-20260614-130545.dump
+ PGPASSWORD=trombi_secret pg_restore -h postgres -U trombi -d trombinoscope --clean --if-exists --no-owner --no-acl /backup/trombi-20260614-130545.dump
+ echo 'Restore OK'
Restore OK
```

---

### Étape E — Redémarrer le backend

Le pod backend est encore en `CrashLoopBackOff` depuis la suppression de la BDD. On le force à redémarrer pour qu'il se reconnecte à Postgres restauré :

```bash
kubectl -n trombi delete pod -l app=backend
```

Kubernetes va recréer un nouveau pod backend (comme dans le scénario 1). Le `prisma db push` va voir que les tables existent déjà (grâce au restore), et le backend va démarrer normalement.

```bash
kubectl -n trombi rollout status deployment/backend
# deployment "backend" successfully rolled out
```

---

### Étape F — Vérifier la restauration

1. Recharge l'app dans ton navigateur
2. Reconnecte-toi (`admin@trombi.fr` / `Admin123!`)
3. Va sur la page **Élèves**

**Tu dois voir** :
- ✅ Les élèves seedés au départ (Alice, Baptiste, etc.)
- ✅ Les élèves que tu as ajoutés à l'étape A (Test1 Backup, Test2 Restore)
- ⚠️ **Sauf** ceux ajoutés dans la **dernière minute avant la suppression** (entre 2 backups)

C'est ça le **RPO** : les données plus récentes que le dernier backup sont perdues.

---

## 📊 Mesures à reporter

### RTO (Recovery Time Objective)

Le temps total pour revenir à un état fonctionnel :

| Phase | Durée typique |
|---|---|
| Détecter la panne (manuel) | variable |
| Supprimer + recréer PVC | ~2 s |
| Redéployer postgres + rollout | ~15-20 s |
| Lancer le Job de restore | ~5-10 s |
| Redémarrer le backend | ~15 s |
| **Total RTO mesuré** | **~1-2 minutes** |

Bien plus long que le PCA (~15s) car il y a une intervention manuelle.

### RPO (Recovery Point Objective)

La perte de données maximale possible :

- Le CronJob tourne **toutes les minutes**
- Donc dans le pire cas, on perd **1 minute de données** (entre le dernier backup et la catastrophe)
- **RPO mesuré : ≤ 1 minute**

Pour réduire ce RPO :
- Augmenter la fréquence des backups (mais coût stockage + perf)
- Utiliser une réplication en temps réel (WAL streaming Postgres)
- Combiner backups + réplication

---

## 🧠 Ce que prouve ce scénario

### ✅ Ce que le PRA garantit

1. **Récupération possible** après perte totale du volume données
2. **RPO maîtrisé** grâce au CronJob (≤ 1 min ici)
3. **Procédure documentée** = pas de panique au moment du sinistre

### ⚠️ Limites de ce PRA

1. **PRA local** : si tout le cluster K3d explose, le PVC backup disparaît aussi. En vrai PRA prod, il faut :
   - Backup distant (S3, Backblaze, Azure Blob…)
   - Backup géographiquement séparé (autre datacenter)
2. **Pas de test régulier** : un backup non testé = pas de backup ! En vrai prod, on doit faire des restore tests périodiques.
3. **Pas de chiffrement des backups** : les `.dump` sont en clair sur le PVC. En prod, il faudrait chiffrer.

---

## 🔬 Pour aller plus loin

### Comprendre le format `pg_dump -Fc`

Le CronJob fait `pg_dump -Fc` (format custom). C'est un format **binaire compressé** qui :
- Est plus rapide à restaurer que SQL plain
- Permet la restauration **partielle** (table par table)
- Est compatible avec `pg_restore --jobs=N` pour le restore parallèle

### Et si on veut un PRA réel (production) ?

```yaml
# 1. Backup vers S3 (au lieu d'un PVC local)
- name: backup
  image: postgres:16
  command:
    - sh
    - -c
    - pg_dump ... | aws s3 cp - s3://backup-prod/trombi-$(date +%s).dump

# 2. Réplication en temps réel
# → PostgreSQL en mode streaming replication
# → un secondary dans une autre région
```

### Tester d'autres types de pannes

```bash
# Panne du nœud entier (au lieu d'un seul pod)
docker stop k3d-trombi-agent-0

# Corruption silencieuse du PVC (plus subtil)
kubectl -n trombi exec -it deploy/postgres -- rm -rf /var/lib/postgresql/data/pgdata/base
# → simule une corruption partielle, postgres va crasher
```

---

## 📝 Capture pour le rapport

1. **CronJob et jobs OK** :
   ```bash
   kubectl -n trombi get cronjob,jobs
   ```

2. **Liste des backups** (capture du `ls -lh /backup`)

3. **Suppression du PVC** :
   ```bash
   kubectl -n trombi delete pvc trombi-data
   ```

4. **App cassée** : screenshot d'une erreur 500 dans le navigateur

5. **Logs du Job restore** :
   ```bash
   kubectl -n trombi logs job/postgres-restore
   ```

6. **App reconstruite** : screenshot des données récupérées

7. **Tableau RTO/RPO mesurés** pour ton rapport.

---

## ✅ Validation

Tu peux considérer ce scénario validé si :
- ✅ Tu as bien vu l'app s'effondrer après suppression du PVC
- ✅ Le Job `postgres-restore` est passé en `Complete`
- ✅ Tes données sont revenues après le restore (sauf celles trop récentes)
- ✅ Tu as mesuré RTO et RPO
- ✅ Tu sais expliquer pourquoi le RTO du PRA est >> RTO du PCA

🎉 **Bravo, tu as validé le scénario PRA !**

---

## 🔁 Comparaison PCA vs PRA

| Critère | PCA (Scénario 1) | PRA (Scénario 2) |
|---|---|---|
| **Panne simulée** | Crash du pod (calcul) | Perte du volume (données) |
| **Action requise** | Aucune (auto) | Manuelle (restore) |
| **RTO** | ~15 secondes | ~1-2 minutes |
| **RPO** | 0 | ≤ 1 minute |
| **Coût/Complexité** | Faible (built-in K8s) | Élevé (backup + restore) |
| **Usage** | Quotidien (crash routine) | Exceptionnel (catastrophe) |

Le PCA est **gratuit** (intégré à Kubernetes), le PRA demande du travail (CronJob, scripts de restore, tests réguliers).

C'est pour ça qu'on combine les deux dans une vraie infra prod.
