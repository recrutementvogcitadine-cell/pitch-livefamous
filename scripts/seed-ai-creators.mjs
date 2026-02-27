import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    return;
  }

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

function parseArgs() {
  const args = process.argv.slice(2);
  let configPath = 'scripts/ai-creators.example.json';
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config' && args[index + 1]) {
      configPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { configPath, dryRun };
}

const PERSONALITY_PRESETS = {
  energique: {
    tone: 'énergique et bienveillant',
    niche: 'animation live et engagement audience',
    language: 'français',
    systemPrompt: 'Tu animes un live dynamique, convivial et orienté conversion. Réponses courtes, punchy et utiles.',
  },
  coach: {
    tone: 'pro, pédagogique et rassurant',
    niche: 'coaching créateur et structuration de contenu',
    language: 'français',
    systemPrompt: 'Tu coaches les créateurs en direct avec des étapes claires, orientées résultat.',
  },
  vendeur: {
    tone: 'commercial, confiant et transparent',
    niche: 'vente live et objection handling',
    language: 'français',
    systemPrompt: 'Tu aides à vendre en live avec des arguments précis, éthiques et concrets.',
  },
};

function normalizeWhatsapp(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^\d+]/g, '').trim();
}

function requireConfigEntry(entry, index) {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Entrée #${index + 1} invalide dans la config.`);
  }
  if (!entry.email || typeof entry.email !== 'string') {
    throw new Error(`Entrée #${index + 1}: email manquant.`);
  }
  if (!entry.password || typeof entry.password !== 'string') {
    throw new Error(`Entrée #${index + 1}: password manquant.`);
  }
}

async function findUserByEmail(adminClient, email) {
  let page = 1;
  const perPage = 200;

  while (true) {
    const res = await adminClient.auth.admin.listUsers({ page, perPage });
    if (res.error) {
      throw new Error(`listUsers failed: ${res.error.message}`);
    }

    const users = res.data?.users ?? [];
    const matched = users.find((item) => (item.email ?? '').toLowerCase() === email.toLowerCase());
    if (matched) return matched;

    if (users.length < perPage) return null;
    page += 1;
  }
}

function resolvePersona(entry) {
  const presetKey = typeof entry.personalityPreset === 'string' ? entry.personalityPreset.trim().toLowerCase() : '';
  const preset = PERSONALITY_PRESETS[presetKey] ?? {};

  return {
    persona_name: entry.personaName ?? entry.displayName ?? null,
    tone: entry.tone ?? preset.tone ?? 'pro, chaleureux',
    niche: entry.niche ?? preset.niche ?? 'plateforme live',
    language: entry.language ?? preset.language ?? 'français',
    system_prompt: entry.systemPrompt ?? preset.systemPrompt ?? null,
  };
}

async function main() {
  loadEnvLocal();
  const { configPath, dryRun } = parseArgs();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    console.error('Variables manquantes. Ajoute NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE dans .env.local');
    process.exit(1);
  }

  const absoluteConfigPath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absoluteConfigPath)) {
    console.error(`Config introuvable: ${absoluteConfigPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absoluteConfigPath, 'utf8');
  const parsed = JSON.parse(raw);
  const creators = Array.isArray(parsed) ? parsed : parsed.creators;

  if (!Array.isArray(creators) || creators.length === 0) {
    console.error('La config doit contenir un tableau de créateurs.');
    process.exit(1);
  }

  creators.forEach((entry, index) => requireConfigEntry(entry, index));

  const adminClient = createClient(supabaseUrl, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const summary = [];

  for (const entry of creators) {
    const email = entry.email.trim().toLowerCase();
    const password = String(entry.password);
    const whatsapp = normalizeWhatsapp(entry.whatsapp ?? entry.creatorWhatsapp ?? '');

    console.log(`\n=== Créateur IA: ${email} ===`);

    if (dryRun) {
      summary.push({ email, userId: '(dry-run)', liveId: '(dry-run)' });
      console.log('DRY RUN: aucune écriture effectuée.');
      continue;
    }

    let user = await findUserByEmail(adminClient, email);

    if (!user) {
      const createRes = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          account_type: 'creator',
          creator_verified: true,
          seller_active: true,
          creator_whatsapp: whatsapp || null,
          display_name: entry.displayName ?? null,
        },
      });

      if (createRes.error) {
        throw new Error(`Création user ${email} échouée: ${createRes.error.message}`);
      }

      user = createRes.data.user;
      console.log(`User créé: ${user.id}`);
    } else {
      console.log(`User existant: ${user.id}`);
    }

    const currentMeta = (user.user_metadata ?? {});
    const nextMeta = {
      ...currentMeta,
      account_type: 'creator',
      creator_verified: true,
      seller_active: true,
      creator_whatsapp: whatsapp || currentMeta.creator_whatsapp || null,
      display_name: entry.displayName ?? currentMeta.display_name ?? null,
    };

    const updateRes = await adminClient.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta,
    });
    if (updateRes.error) {
      throw new Error(`Mise à jour metadata ${email} échouée: ${updateRes.error.message}`);
    }

    let liveId = null;
    if (entry.liveId && typeof entry.liveId === 'string' && entry.liveId.trim()) {
      liveId = entry.liveId.trim();
      console.log(`Live réutilisé: ${liveId}`);
    } else if (entry.createLive !== false) {
      const liveTitle = entry.liveTitle || `Live IA - ${entry.displayName || email}`;
      const liveInsert = await adminClient
        .from('lives')
        .insert([{ title: liveTitle, status: 'live', creator_id: user.id }])
        .select('id')
        .single();

      if (liveInsert.error) {
        throw new Error(`Création live ${email} échouée: ${liveInsert.error.message}`);
      }

      liveId = liveInsert.data.id;
      console.log(`Live créé: ${liveId}`);
    }

    if (liveId) {
      const persona = resolvePersona(entry);
      const personaUpsert = await adminClient.from('live_ai_personas').upsert(
        {
          live_id: liveId,
          ...persona,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'live_id' }
      );

      if (personaUpsert.error) {
        console.warn(`Persona non appliquée pour ${email}: ${personaUpsert.error.message}`);
      } else {
        console.log(`Persona appliquée: ${persona.persona_name ?? 'sans nom'}`);
      }
    }

    summary.push({ email, userId: user.id, liveId: liveId ?? '(sans live)' });
  }

  console.log('\n=== Résumé ===');
  for (const row of summary) {
    console.log(`${row.email} | user=${row.userId} | live=${row.liveId}`);
  }
}

main().catch((error) => {
  console.error('Erreur script seed-ai-creators:', error);
  process.exit(1);
});
