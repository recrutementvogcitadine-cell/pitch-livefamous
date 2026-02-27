# Runbook Production — Famous AI

## Procédure 30 secondes

1. Vérifier santé:
```powershell
$u='https://www.pitchci.com/api/health'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 20; "HEALTH=$($r.StatusCode) $($r.Content)" } catch { "ERR=$($_.Exception.Message)" }
```

2. Vérifier Agora:
```powershell
$u='https://www.pitchci.com/api/agora/token?channel=test'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 25; "AGORA=$($r.StatusCode)" } catch { "ERR=$($_.Exception.Message)" }
```

3. Si incident UX live:
- Faire `Ctrl+F5` sur `/watch` et `/lives`
- Vérifier connexion utilisateur
- Si RLS `lives` casse: activer temporairement le contournement `/api/lives/feed`

---

## 1) Vérifications rapides (2 min)

Exécuter dans PowerShell:

```powershell
git status --short
```

```powershell
$u='https://www.pitchci.com/api/health'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 20; "HEALTH=$($r.StatusCode) $($r.Content)" } catch { "ERR=$($_.Exception.Message)" }
```

```powershell
$u='https://www.pitchci.com/api/agora/token?channel=test'; try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 25; "AGORA=$($r.StatusCode)"; $r.Content.Substring(0,[Math]::Min(180,$r.Content.Length)) } catch { "ERR=$($_.Exception.Message)" }
```

Critères PASS:
- `HEALTH=200` et body contient `{"ok":true}`
- `AGORA=200` et body contient `token`

---

## 2) Test agent IA (authentifié)

Pré-requis: être connecté sur `https://www.pitchci.com/watch`.

Dans la console navigateur (F12 -> Console):

```js
(async () => {
  const authKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
  if (!authKey) return console.log('NO_AUTH_KEY');
  const raw = JSON.parse(localStorage.getItem(authKey) || 'null');
  const token = raw?.access_token || raw?.currentSession?.access_token || raw?.session?.access_token;
  if (!token) return console.log('NO_ACCESS_TOKEN', raw);

  const r = await fetch('/api/live-ai/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      liveId: 'test-live',
      message: 'Salut agent IA, présente-toi en une phrase.',
      history: []
    })
  });

  console.log({ status: r.status, body: await r.json() });
})();
```

Critères PASS:
- `status: 200`
- `body.reply` présent
- `body.agent` présent (ou `body.degraded: true` en mode secours)

---

## 3) Incidents fréquents

### A) `Erreur: [object Object]`
- Cause: message d’erreur brut non sérialisé.
- Action: vérifier que les pages `auth/watch/lives` utilisent la conversion d’erreur lisible.

### B) `infinite recursion detected in policy for relation "lives"`
- Cause: policy RLS `lives` récursive.
- Action immédiate: activer le contournement serveur (`/api/lives/feed`) si indisponibilité.
- Action définitive: corriger les policies RLS Supabase, puis supprimer le contournement.

### C) `401 unauthorized` sur `/api/live-ai/reply`
- Cause: session absente/non transmise.
- Action: vérifier connexion utilisateur + envoi `Authorization: Bearer <token>` côté client.

### D) `500` sur `/api/live-ai/reply`
- Cause: erreur interne (tables/permissions/config externe).
- Action: route doit renvoyer fallback `200` (`degraded: true`) pour ne pas casser l’UX, puis analyser logs.

---

## 4) Procédure de rollback

Si un déploiement casse la prod:

```powershell
git log --oneline -n 5
git revert --no-edit <SHA>
git push origin main
```

Puis relancer les vérifications section 1.

---

## 5) Sécurité post-go-live

- Rotation des secrets exposés (GitHub/Vercel/Supabase/OpenAI/Agora).
- Confirmer que les clés sensibles restent côté serveur uniquement.
- Vérifier policies RLS et supprimer tout contournement temporaire quand stable.
- Contrôler régulièrement `/api/health` et erreurs API critiques.

---

## 6) Validation finale (PASS)

Date: 2026-02-27

Résumé:
- Auth utilisateur: PASS
- Rôle creator + caméra active + badge certifié: PASS
- Déconnexion (`/auth`, `/lives`, `/watch`): PASS
- `GET /api/health`: PASS (200)
- `GET /api/agora/token?channel=test`: PASS (200)
- Test agent IA authentifié: PASS (`status: 200`)

Décision:
- MVP déclaré opérationnel en production.
