# Live Notifications - Checklist test réel (mobile, 2 comptes)

## Pré-requis

- Build/deploy déjà fait sur l'URL publique HTTPS.
- Variables VAPID configurées sur la plateforme (Vercel):
  - `NEXT_PUBLIC_APP_URL`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
- Tables créées via `docs/LIVE_NOTIFICATIONS_SCHEMA.sql`.
- 2 comptes utilisateurs:
  - Compte A = créateur
  - Compte B = follower
- 2 appareils/navigateurs:
  - Mobile réel (compte B)
  - Desktop (compte A)

## Test E2E nominal

1. **Compte B (mobile)**
   - Se connecter.
   - Ouvrir `/watch`.
   - Cliquer **Activer notifications live**.
   - Accepter la permission navigateur.
   - Résultat attendu: message `Notifications live activées ✅`.

2. **Compte B (mobile)**
   - Sur un live du compte A, cliquer **Suivre**.
   - Résultat attendu: le bouton passe à **Ne plus suivre**.

3. **Compte A (desktop)**
   - Se connecter.
   - Ouvrir `/watch`.
   - Sur son propre live, cliquer **Notifier mes followers**.
   - Résultat attendu: `Notifications envoyées: X/Y` avec `X >= 1` et `Y >= 1`.

4. **Compte B (mobile)**
   - Notification reçue avec:
     - titre live,
     - texte `... est en direct`,
     - action **Voir le live**.
   - Cliquer la notification.
   - Résultat attendu: ouverture de `/lives/:id`.

## Vérifications SQL rapides

```sql
-- Followers enregistrés
select creator_user_id, follower_user_id, created_at
from public.live_creator_followers
order by created_at desc
limit 20;

-- Subscriptions push actives
select user_id, endpoint, created_at, updated_at
from public.live_push_subscriptions
order by updated_at desc
limit 20;
```

## Cas de contrôle (important)

- **Sans permission notif**: refus permission => message d'erreur côté UI.
- **Non connecté**: appel subscribe/follow/send => `401 unauthorized`.
- **Créateur sans followers**: `Notifier mes followers` => `sent: 0`.
- **Endpoint stale** (désinscription navigateur): suppression auto côté backend (404/410).

## Critères PASS

- Permission push accordée et subscription stockée.
- Follow/unfollow fonctionne.
- Envoi depuis créateur retourne succès.
- Notification reçue sur mobile avec CTA **Voir le live**.
- Ouverture correcte du live au clic notification.
