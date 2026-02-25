Déploiement rapide — Famous AI

But: préparer l'hébergement avec les secrets requis et déployer (Vercel recommandé).

Étapes :

1) Ajouter secrets d'environnement dans l'interface d'hébergement (Vercel / autre):
   - `AGORA_APP_ID` (si vous utilisez token server).
   - `AGORA_APP_CERT` (si vous déployez le endpoint serveur qui génère les tokens).
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client)
   - `SUPABASE_SERVICE_ROLE` (uniquement si vous exécutez des scripts côté serveur; ne pas exposer côté client)

2) Vérifier `package.json` contient le script de build (ex: `vercel-build` ou `build`). Exemple :

   ```bash
   npm run build
   ```

3) Déployer (Vercel CLI exemple) :

   ```bash
   npm i -g vercel
   vercel login
   vercel --prod
   ```

4) Après déploiement :
   - Vérifier `https://<votre-url>/api/health` retourne `{ "ok": true }`.
   - Vérifier la page d'accueil `/` contient les liens vers `/agora-test` et `/supabase-test`.
   - Pour la démo Agora qui utilise un token serveur, vérifiez que `AGORA_APP_CERT` est défini dans vos secrets.

Notes techniques :
- La page `/agora-test` fournit des contrôles pour codec, résolution et layout. L'endpoint serveur (si présent) doit fournir un token court-vie pour joindre Agora en production.
- Pour l'e2e Playwright headful avec caméra, configurez les périphériques/fake-media dans CI (arguments Chrome) et ajoutez les secrets `AGORA_APP_ID`/`AGORA_APP_CERT` au pipeline.

Si vous voulez, je peux préparer la PR et automatiser l'ajout des instructions dans la CI (Playwright) ou préparer les commandes Vercel prêtes à exécuter.