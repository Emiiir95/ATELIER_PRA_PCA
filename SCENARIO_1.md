# 🎬 Scénario 1 — PCA : Crash du pod backend

## 🎯 Objectif

Démontrer que **Kubernetes assure la continuité d'activité** : quand un pod est détruit (crash applicatif, OOM kill, suppression accidentelle), le Deployment en recrée automatiquement un nouveau **sans intervention humaine** et **sans perte de données**.

C'est le principe du **PCA** (Plan de Continuité d'Activité).

---

## 📋 Pré-requis

Avant de commencer, vérifie que l'infra est bien en place :

```bash
# Tu dois être dans le repo
cd /workspaces/ATELIER_PRA_PCA

# Le cluster K3d doit tourner
kubectl get nodes
# → 3 nodes en Ready

# Les 3 pods de l'app doivent être Running
kubectl -n trombi get pods
# → backend, frontend, postgres tous en Running
```

Si l'un de ces 3 prérequis manque, suis d'abord les étapes du [README.md](README.md).

---

## 🎭 Le scénario

### Situation initiale

Imagine que ton application est en production :
- Tes utilisateurs sont connectés (toi y compris, sur ton navigateur via le port-forward)
- Tu as créé quelques classes et élèves
- Tout fonctionne normalement

**Soudain**, un sysadmin maladroit (ou un crash applicatif) **tue le pod backend**.

→ **Question** : que se passe-t-il pour les utilisateurs et les données ?

---

## 📜 Déroulé pas à pas

### Étape 1 — Observer l'état initial

```bash
kubectl -n trombi get pods -l app=backend
```

**Exemple de sortie** :
```
NAME                       READY   STATUS    RESTARTS   AGE
backend-647b97b5b6-rvxgt   1/1     Running   0          12m
```

**Ce qu'on voit** :
- Le pod s'appelle `backend-647b97b5b6-rvxgt`
- `647b97b5b6` = hash du ReplicaSet (généré automatiquement)
- `rvxgt` = suffixe random unique du pod
- Il tourne depuis 12 min sans aucun redémarrage (`RESTARTS = 0`)
- Il est `Ready` (1/1 conteneur prêt)

**Pourquoi un nom random ?**
Le Deployment crée des pods **éphémères**. Le nom n'a pas vocation à être stable — c'est le **Service** (`backend`) qui fournit un point d'accès stable.

---

### Étape 2 — Détruire le pod (la "panne")

```bash
kubectl -n trombi delete pod -l app=backend
```

**Sortie** :
```
pod "backend-647b97b5b6-rvxgt" deleted from trombi namespace
```

**Ce qu'on a fait** :
- `-l app=backend` = sélectionne par label (tous les pods avec le label `app=backend`)
- `delete pod` = envoie un signal SIGTERM au conteneur, puis SIGKILL après 30s par défaut
- Le pod est marqué pour suppression

**Pourquoi pas `delete deployment` ?**
Si on supprimait le Deployment, Kubernetes ne recréerait **rien** (puisque c'est lui le contrôleur). On veut au contraire **garder** le Deployment et juste casser le pod, pour voir Kubernetes le ressusciter.

---

### Étape 3 — Regarder Kubernetes réagir en direct

```bash
kubectl -n trombi get pods -l app=backend -w
```

L'option `-w` (`--watch`) garde la commande active et affiche les changements en temps réel.

**Ce que tu vas observer** (chronologie typique) :

```
NAME                       READY   STATUS              RESTARTS   AGE
backend-647b97b5b6-rvxgt   1/1     Terminating         0          12m   ← l'ancien meurt
backend-647b97b5b6-gm2sl   0/1     Pending             0          0s    ← nouveau créé
backend-647b97b5b6-gm2sl   0/1     ContainerCreating   0          1s    ← image en cours de chargement
backend-647b97b5b6-gm2sl   0/1     Running             0          5s    ← démarré mais pas prêt
backend-647b97b5b6-gm2sl   1/1     Running             0          15s   ← prêt à servir
```

**Ce qui se passe en coulisse** :

1. **`Terminating`** — Kubernetes signale au pod de s'arrêter proprement
2. Le **Deployment** détecte qu'il manque un pod (replicas = 1 mais 0 running)
3. Il demande au **ReplicaSet** d'en créer un nouveau
4. Le **scheduler** choisit un nœud disponible (un des `k3d-trombi-agent-0/1`)
5. Le **kubelet** du nœud télécharge l'image (ici déjà présente car importée par k3d), puis lance le conteneur
6. Le **readinessProbe** (`HTTP GET /health` toutes les 5s) vérifie que le backend répond
7. Une fois le probe OK, le pod passe en `1/1 Ready`

**Quitte la commande watch** avec `Ctrl+C`.

---

### Étape 4 — Vérifier que les données sont intactes

Recharge l'app dans ton navigateur (Cmd+R / F5). Si tu étais connecté :
- ✅ Tu es toujours connecté (le JWT côté navigateur est toujours valide)
- ✅ Les classes et élèves que tu avais créés sont toujours là

**Pourquoi les données survivent ?**
La base de données PostgreSQL est dans un **autre pod** (`postgres-*`), non touché par notre opération. Ses données sont stockées sur le **PVC `trombi-data`**, qui existe **indépendamment** des pods.

C'est ça l'idée centrale du PCA :
> **Séparer le calcul (stateless) du stockage (stateful)** → on peut détruire/redéployer le calcul sans toucher au stockage.

---

## 📊 Mesures à reporter

### RTO (Recovery Time Objective)

C'est le **temps maximum d'indisponibilité** acceptable.

| Phase | Durée typique |
|---|---|
| Terminating de l'ancien pod | 1-2 s |
| Création du nouveau pod | ~1 s |
| ContainerCreating (image déjà locale) | 2-4 s |
| Démarrage Node.js + `prisma db push` | 5-10 s |
| Premier `/health` OK | ~2 s |
| **Total RTO mesuré** | **~10-30 s** |

**Pendant ces ~15 secondes**, les requêtes API du frontend renvoient une erreur de connexion. Mais **dès que le nouveau pod est Ready**, le Service `backend` route automatiquement vers lui — l'utilisateur ne voit même pas la panne (sauf clic au mauvais moment).

### RPO (Recovery Point Objective)

C'est la **perte de données maximale** acceptable (en temps).

**Dans ce scénario, RPO = 0** car :
- La BDD est sur le PVC `trombi-data`
- Le pod détruit était le backend (stateless), pas Postgres
- Aucune donnée n'était dans le pod backend (juste du code)

→ **0 seconde de données perdues.**

---

## 🧠 Ce que prouve ce scénario

### ✅ Ce que Kubernetes garantit (PCA réussi)

1. **Auto-healing** : un pod détruit est recréé automatiquement
2. **Pas de perte de données** car la BDD est isolée sur un PVC
3. **Pas d'intervention humaine** : aucun admin à réveiller la nuit

### ❌ Ce que ce scénario ne prouve PAS

1. **Pas de tolérance à la panne d'un nœud** : si le nœud entier tombait, il faudrait plusieurs replicas + un PodDisruptionBudget. Ici on a `replicas: 1`.
2. **Pas de tolérance à la perte du PVC** : si on détruit `trombi-data`, on perd tout → c'est le sujet du **scénario 2 (PRA)**.
3. **Pas de tolérance au crash du nœud master** : il faudrait un cluster multi-master (HA control plane).

---

## 🔬 Pour aller plus loin

### Que se passe-t-il pendant la panne ?

Pendant que le pod backend est down, voici ce que voit le frontend :

```javascript
// Le frontend appelle /api/students
fetch('/api/students')
  → nginx proxy_pass → backend:3000
  → Service backend : pas de pod ready
  → ERR_CONNECTION_REFUSED
```

Le frontend reçoit une erreur **502 Bad Gateway** ou un timeout. Une UI bien faite peut afficher "Réessayer dans quelques secondes…" et **retry automatiquement** — l'utilisateur ne perçoit qu'un délai.

### Comment réduire le RTO ?

1. **Pré-charger l'image** (déjà fait via `k3d image import`)
2. **Multi-replicas** : `replicas: 2` ou `3` → si un crash, il en reste qui répondent (RTO = 0)
3. **Readiness probe plus rapide** : `initialDelaySeconds: 2` au lieu de 10
4. **Démarrage plus rapide** : éviter `npx prisma db push` au boot (le faire en init container)

### Comment tester d'autres pannes ?

```bash
# Tuer Postgres (la BDD recommence avec ses données intactes grâce au PVC)
kubectl -n trombi delete pod -l app=postgres

# Tuer le frontend (nginx redémarre instantanément)
kubectl -n trombi delete pod -l app=frontend

# Tuer TOUS les pods d'un coup (massacre simulé)
kubectl -n trombi delete pods --all
```

Dans tous ces cas, Kubernetes recrée les pods et l'app revient à la normale.

---

## 📝 Capture pour le rapport

Pour ton dossier ou ta soutenance, capture ces moments :

1. **Pod initial** :
   ```bash
   kubectl -n trombi get pods -l app=backend
   ```

2. **Pendant la suppression** :
   ```bash
   kubectl -n trombi delete pod -l app=backend
   ```

3. **Recréation observée** :
   ```bash
   kubectl -n trombi get pods -l app=backend -w
   # Laisse tourner ~30 secondes pour voir la transition
   ```

4. **Pod final + age** :
   ```bash
   kubectl -n trombi get pods -l app=backend
   ```
   (montre que le nom du pod a changé mais le Deployment est intact)

5. **App fonctionne** : screenshot du navigateur connecté avec les données intactes.

---

## ✅ Validation

Tu peux considérer ce scénario validé si :
- ✅ Tu as observé la destruction et la recréation automatique du pod
- ✅ Le nouveau pod est `1/1 Ready` en moins de 30s
- ✅ Tu peux te reconnecter à l'app sans recréer ton compte
- ✅ Tes données sont toujours là après le redémarrage

🎉 **Bravo, tu as validé le scénario PCA !**

➡️ **Prochaine étape** : le scénario 2 (PRA) — beaucoup plus impressionnant car on simule une vraie catastrophe (perte de la base) et on restaure depuis backup.
