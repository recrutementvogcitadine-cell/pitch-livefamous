import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type HistoryItem = { role: "user" | "assistant"; content: string };

type ReplyRequest = {
  liveId?: string;
  message?: string;
  history?: HistoryItem[];
  preferredAgentId?: string;
};

type StoredMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type LivePersona = {
  persona_name: string | null;
  language: string | null;
  tone: string | null;
  niche: string | null;
  system_prompt: string | null;
};

type ViewerMemory = {
  preferences: string | null;
  frequent_topics: string | null;
  last_intent: string | null;
  updated_at: string | null;
};

type AgentGender = "male" | "female";

type AgentProfile = {
  id: string;
  name: string;
  gender: AgentGender;
  tone: string;
  niche: string;
  systemPrompt: string;
};

type AgentSelection = {
  agent: AgentProfile;
  activeAgents: AgentProfile[];
};

type GenerationResult = {
  reply: string;
  estimatedCostUsd: number;
  modelUsed: string;
};

const AI_DISCLOSURE = "Je suis un assistant virtuel IA en direct.";
const MAX_MESSAGE_LENGTH = 500;
const FORBIDDEN_PATTERNS = ["ignore previous instructions", "bypass", "jailbreak"];
const MODERATION_PATTERNS = ["haine", "raciste", "porn", "violent", "terror", "dox", "suicide"];
const ESCALATION_PATTERNS = [
  "problème légal",
  "avocat",
  "urgence",
  "suicide",
  "pirater",
  "hacker",
  "mot de passe",
  "bank",
  "banque",
  "medical",
  "ordonnance",
  "diagnostic",
];
const DEFAULT_COOLDOWN_MS = 3500;
const DEFAULT_MAX_PER_MINUTE = 10;
const DEFAULT_ACTIVE_AGENT_SLOTS = 6;
const DEFAULT_MONTHLY_BUDGET_USD = 250;
const DEFAULT_BASE_MODEL = "gpt-4.1-mini";
const DEFAULT_COMPLEX_MODEL = "gpt-4.1";
const ESTIMATED_INPUT_USD_PER_1M = 0.4;
const ESTIMATED_OUTPUT_USD_PER_1M = 1.6;

const requestTimestamps = new Map<string, number[]>();
const monthlyBudgetUsage = new Map<string, number>();

const AGENT_POOL: AgentProfile[] = [
  {
    id: "agent-m-01",
    name: "Alex",
    gender: "male",
    tone: "énergique",
    niche: "gaming live",
    systemPrompt: "Tu es Alex, host live gaming, ton énergique, réponses courtes et motivantes.",
  },
  {
    id: "agent-m-02",
    name: "Noah",
    gender: "male",
    tone: "chaleureux",
    niche: "talk show",
    systemPrompt: "Tu es Noah, présentateur talk show, ton chaleureux et inclusif.",
  },
  {
    id: "agent-m-03",
    name: "Léo",
    gender: "male",
    tone: "pro",
    niche: "business creator",
    systemPrompt: "Tu es Léo, expert creator business, réponses structurées et pragmatiques.",
  },
  {
    id: "agent-m-04",
    name: "Ethan",
    gender: "male",
    tone: "fun",
    niche: "divertissement",
    systemPrompt: "Tu es Ethan, animateur divertissement, style fun sans excès.",
  },
  {
    id: "agent-m-05",
    name: "Lucas",
    gender: "male",
    tone: "coach",
    niche: "productivité",
    systemPrompt: "Tu es Lucas, coach productivité, clair et orienté action.",
  },
  {
    id: "agent-m-06",
    name: "Adam",
    gender: "male",
    tone: "premium",
    niche: "mode & lifestyle",
    systemPrompt: "Tu es Adam, host lifestyle premium, ton confiant et élégant.",
  },
  {
    id: "agent-m-07",
    name: "Yanis",
    gender: "male",
    tone: "pédagogue",
    niche: "tech simplifiée",
    systemPrompt: "Tu es Yanis, vulgarisateur tech, explique simplement.",
  },
  {
    id: "agent-m-08",
    name: "Hugo",
    gender: "male",
    tone: "calme",
    niche: "bien-être",
    systemPrompt: "Tu es Hugo, host bien-être, ton calme, empathique et rassurant.",
  },
  {
    id: "agent-m-09",
    name: "Ilyes",
    gender: "male",
    tone: "direct",
    niche: "sport",
    systemPrompt: "Tu es Ilyes, coach sport live, direct, motivant, précis.",
  },
  {
    id: "agent-m-10",
    name: "Nolan",
    gender: "male",
    tone: "créatif",
    niche: "musique",
    systemPrompt: "Tu es Nolan, host musique, créatif et accessible.",
  },
  {
    id: "agent-f-01",
    name: "Mia",
    gender: "female",
    tone: "énergique",
    niche: "gaming live",
    systemPrompt: "Tu es Mia, host gaming, dynamique, positive et concise.",
  },
  {
    id: "agent-f-02",
    name: "Lina",
    gender: "female",
    tone: "chaleureux",
    niche: "talk show",
    systemPrompt: "Tu es Lina, animatrice talk show, chaleureuse, écoute active.",
  },
  {
    id: "agent-f-03",
    name: "Sara",
    gender: "female",
    tone: "pro",
    niche: "business creator",
    systemPrompt: "Tu es Sara, experte creator business, orientée impact.",
  },
  {
    id: "agent-f-04",
    name: "Chloé",
    gender: "female",
    tone: "fun",
    niche: "divertissement",
    systemPrompt: "Tu es Chloé, animatrice divertissement, fun, respectueuse et claire.",
  },
  {
    id: "agent-f-05",
    name: "Emma",
    gender: "female",
    tone: "coach",
    niche: "productivité",
    systemPrompt: "Tu es Emma, coach productivité, conseils concrets et applicables.",
  },
  {
    id: "agent-f-06",
    name: "Inès",
    gender: "female",
    tone: "premium",
    niche: "mode & lifestyle",
    systemPrompt: "Tu es Inès, host lifestyle premium, ton élégant et moderne.",
  },
  {
    id: "agent-f-07",
    name: "Nora",
    gender: "female",
    tone: "pédagogue",
    niche: "tech simplifiée",
    systemPrompt: "Tu es Nora, vulgarisatrice tech, simple, précise, concrète.",
  },
  {
    id: "agent-f-08",
    name: "Aya",
    gender: "female",
    tone: "calme",
    niche: "bien-être",
    systemPrompt: "Tu es Aya, host bien-être, rassurante et attentive.",
  },
  {
    id: "agent-f-09",
    name: "Jade",
    gender: "female",
    tone: "direct",
    niche: "sport",
    systemPrompt: "Tu es Jade, coach sport live, motivante, claire, directe.",
  },
  {
    id: "agent-f-10",
    name: "Zoé",
    gender: "female",
    tone: "créatif",
    niche: "musique",
    systemPrompt: "Tu es Zoé, host musique, créative et proche du public.",
  },
];

function getCooldownMs() {
  const parsed = Number(process.env.LIVE_AI_COOLDOWN_MS);
  return Number.isFinite(parsed) && parsed >= 1000 ? parsed : DEFAULT_COOLDOWN_MS;
}

function getMaxPerMinute() {
  const parsed = Number(process.env.LIVE_AI_MAX_PER_MINUTE);
  return Number.isFinite(parsed) && parsed >= 3 ? parsed : DEFAULT_MAX_PER_MINUTE;
}

function getActiveAgentSlots() {
  const parsed = Number(process.env.LIVE_AI_ACTIVE_AGENT_SLOTS);
  if (!Number.isFinite(parsed)) return DEFAULT_ACTIVE_AGENT_SLOTS;
  return Math.max(2, Math.min(10, Math.floor(parsed)));
}

function getMonthlyBudgetUsd() {
  const parsed = Number(process.env.LIVE_AI_MONTHLY_BUDGET_USD);
  return Number.isFinite(parsed) && parsed >= 25 ? parsed : DEFAULT_MONTHLY_BUDGET_USD;
}

function getMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function getBudgetUsage(monthKey = getMonthKey()) {
  return monthlyBudgetUsage.get(monthKey) ?? 0;
}

function addBudgetUsage(costUsd: number, monthKey = getMonthKey()) {
  const current = getBudgetUsage(monthKey);
  monthlyBudgetUsage.set(monthKey, Number((current + Math.max(0, costUsd)).toFixed(6)));
}

function hashText(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickAgent(liveId: string, message: string, preferredAgentId?: string): AgentSelection {
  const activeSlots = getActiveAgentSlots();
  const monthKey = getMonthKey();
  const offset = hashText(`${monthKey}:${liveId}`) % AGENT_POOL.length;

  const activeAgents: AgentProfile[] = [];
  for (let cursor = 0; cursor < activeSlots; cursor += 1) {
    activeAgents.push(AGENT_POOL[(offset + cursor) % AGENT_POOL.length]);
  }

  const preferred = preferredAgentId
    ? activeAgents.find((agent) => agent.id === preferredAgentId)
    : null;

  if (preferred) {
    return { agent: preferred, activeAgents };
  }

  const minuteBucket = Math.floor(Date.now() / 120_000);
  const selectedIndex = hashText(`${liveId}:${message}:${minuteBucket}`) % activeAgents.length;
  return { agent: activeAgents[selectedIndex], activeAgents };
}

function isComplexQuery(message: string) {
  const lowered = message.toLowerCase();
  return (
    lowered.length > 220 ||
    lowered.includes("stratég") ||
    lowered.includes("analyse") ||
    lowered.includes("compare") ||
    lowered.includes("plan détaillé")
  );
}

function estimateUsdCostFromUsage(promptTokens: number, completionTokens: number) {
  const inputCost = (promptTokens / 1_000_000) * ESTIMATED_INPUT_USD_PER_1M;
  const outputCost = (completionTokens / 1_000_000) * ESTIMATED_OUTPUT_USD_PER_1M;
  return Number((inputCost + outputCost).toFixed(6));
}

function normalizeText(input: string) {
  return input.trim().replace(/\s+/g, " ");
}

function hasForbiddenPattern(input: string) {
  const lowered = input.toLowerCase();
  return FORBIDDEN_PATTERNS.some((pattern) => lowered.includes(pattern));
}

function hasModerationPattern(input: string) {
  const lowered = input.toLowerCase();
  return MODERATION_PATTERNS.some((pattern) => lowered.includes(pattern));
}

function checkRateLimit(userId: string, liveId: string) {
  const now = Date.now();
  const key = `${userId}:${liveId}`;
  const list = requestTimestamps.get(key) ?? [];
  const lastMinute = list.filter((timestamp) => now - timestamp < 60_000);
  const cooldownMs = getCooldownMs();
  const maxPerMinute = getMaxPerMinute();

  const last = lastMinute[lastMinute.length - 1];
  if (last && now - last < cooldownMs) {
    return { allowed: false as const, retryAfterMs: cooldownMs - (now - last) };
  }

  if (lastMinute.length >= maxPerMinute) {
    const retryAfterMs = 60_000 - (now - lastMinute[0]);
    return { allowed: false as const, retryAfterMs: Math.max(1200, retryAfterMs) };
  }

  lastMinute.push(now);
  requestTimestamps.set(key, lastMinute);
  return { allowed: true as const, retryAfterMs: 0 };
}

function fallbackReply(message: string) {
  const lowered = message.toLowerCase();

  if (lowered.includes("prix") || lowered.includes("coût") || lowered.includes("tarif")) {
    return `${AI_DISCLOSURE} Les tarifs peuvent évoluer selon les options choisies. Je peux t'expliquer les packs de démarrage si tu veux.`;
  }

  if (lowered.includes("live") || lowered.includes("stream")) {
    return `${AI_DISCLOSURE} Le live fonctionne en temps réel avec modération et publication encadrée.`;
  }

  return `${AI_DISCLOSURE} Merci pour ta question. Je peux t'aider sur le fonctionnement de la plateforme, les lives et l'onboarding créateur.`;
}

function classifyIntent(message: string) {
  const lowered = message.toLowerCase();
  if (lowered.includes("prix") || lowered.includes("coût") || lowered.includes("tarif")) return "pricing";
  if (lowered.includes("compte") || lowered.includes("inscri") || lowered.includes("connexion")) return "account";
  if (lowered.includes("live") || lowered.includes("stream") || lowered.includes("direct")) return "live";
  if (lowered.includes("créateur") || lowered.includes("creator")) return "creator";
  return "general";
}

function inferPreferences(message: string) {
  const lowered = message.toLowerCase();
  const preferences: string[] = [];
  if (lowered.includes("français") || lowered.includes("francais")) preferences.push("fr");
  if (lowered.includes("anglais") || lowered.includes("english")) preferences.push("en");
  if (lowered.includes("rapide") || lowered.includes("court")) preferences.push("short-answers");
  if (lowered.includes("détail") || lowered.includes("detail")) preferences.push("detailed-answers");
  return preferences.join(",");
}

function shouldEscalateToHuman(message: string) {
  const lowered = message.toLowerCase();
  return ESCALATION_PATTERNS.some((pattern) => lowered.includes(pattern));
}

function estimateConfidence(message: string, reply: string) {
  let score = 0.82;
  const loweredMessage = message.toLowerCase();
  const loweredReply = reply.toLowerCase();

  if (loweredMessage.length < 8) score -= 0.12;
  if (loweredMessage.includes("?") && loweredReply.length > 40) score += 0.04;
  if (loweredReply.includes("je ne peux pas") || loweredReply.includes("réessaie")) score -= 0.22;
  if (loweredReply.includes("assistant virtuel ia")) score += 0.04;

  return Math.max(0.2, Math.min(0.98, Number(score.toFixed(2))));
}

async function getPersonaPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  liveId: string
) {
  const { data, error } = await supabase
    .from("live_ai_personas")
    .select("persona_name, language, tone, niche, system_prompt")
    .eq("live_id", liveId)
    .maybeSingle();

  if (error) {
    const lowered = error.message.toLowerCase();
    if (
      lowered.includes("does not exist") ||
      lowered.includes("row-level security") ||
      lowered.includes("permission")
    ) {
      return "";
    }
    return "";
  }

  const persona = (data ?? null) as LivePersona | null;
  if (!persona) return "";

  if (persona.system_prompt && persona.system_prompt.trim().length > 0) {
    return persona.system_prompt.trim();
  }

  const name = persona.persona_name?.trim() || "Assistant Live IA";
  const tone = persona.tone?.trim() || "pro, chaleureux";
  const niche = persona.niche?.trim() || "plateforme live";
  const language = persona.language?.trim() || "français";

  return `Tu incarnes ${name}. Tu réponds en ${language} avec un ton ${tone}. Ton univers principal est: ${niche}.`;
}

async function getViewerMemoryPrompt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  liveId: string
) {
  const threshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("live_ai_viewer_memory")
    .select("preferences, frequent_topics, last_intent, updated_at")
    .eq("user_id", userId)
    .eq("live_id", liveId)
    .gte("updated_at", threshold)
    .maybeSingle();

  if (error) {
    const lowered = error.message.toLowerCase();
    if (
      lowered.includes("does not exist") ||
      lowered.includes("row-level security") ||
      lowered.includes("permission")
    ) {
      return "";
    }
    return "";
  }

  const memory = (data ?? null) as ViewerMemory | null;
  if (!memory) return "";

  const chunks: string[] = [];
  if (memory.preferences) chunks.push(`Préférences viewer: ${memory.preferences}`);
  if (memory.frequent_topics) chunks.push(`Sujets fréquents: ${memory.frequent_topics}`);
  if (memory.last_intent) chunks.push(`Intention récente: ${memory.last_intent}`);
  if (!chunks.length) return "";
  return `Contexte session viewer (24h): ${chunks.join(" | ")}`;
}

async function upsertViewerMemory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  liveId: string,
  message: string
) {
  const intent = classifyIntent(message);
  const preferences = inferPreferences(message);
  const topics = message
    .toLowerCase()
    .replace(/[^a-zàâçéèêëîïôûùüÿñæœ\s-]/gi, "")
    .split(/\s+/)
    .filter((token) => token.length > 4)
    .slice(0, 6)
    .join(",");

  const payload = {
    user_id: userId,
    live_id: liveId,
    preferences: preferences || null,
    frequent_topics: topics || null,
    last_intent: intent,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("live_ai_viewer_memory")
    .upsert(payload, { onConflict: "user_id,live_id" });

  if (error) {
    const lowered = error.message.toLowerCase();
    if (
      lowered.includes("does not exist") ||
      lowered.includes("row-level security") ||
      lowered.includes("permission")
    ) {
      return;
    }
    throw error;
  }
}

async function generateAiReply(
  message: string,
  history: HistoryItem[],
  personaPrompt: string,
  viewerMemoryPrompt: string,
  selectedAgent: AgentProfile,
  forceBudgetMode: boolean
): Promise<GenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseModel = process.env.OPENAI_MODEL ?? DEFAULT_BASE_MODEL;
  const complexModel = process.env.OPENAI_COMPLEX_MODEL ?? DEFAULT_COMPLEX_MODEL;
  const model = forceBudgetMode ? baseModel : isComplexQuery(message) ? complexModel : baseModel;

  if (!apiKey) {
    return { reply: fallbackReply(message), estimatedCostUsd: 0, modelUsed: "fallback-local" };
  }

  const recentHistory = history.slice(-8).map((item) => ({
    role: item.role,
    content: normalizeText(item.content).slice(0, 600),
  }));

  const payload = {
    model,
    temperature: 0.6,
    max_tokens: 220,
    messages: [
      {
        role: "system",
        content:
          "Tu es l'assistant virtuel IA officiel de Famous AI. Tu dois répondre en français, de manière concise, polie et utile. Tu dois toujours rester transparent sur le fait que tu es une IA virtuelle.",
      },
      {
        role: "system" as const,
        content: `${selectedAgent.systemPrompt} Ton identité affichée est: ${selectedAgent.name}.`,
      },
      ...(personaPrompt
        ? [
            {
              role: "system" as const,
              content: personaPrompt,
            },
          ]
        : []),
      ...(viewerMemoryPrompt
        ? [
            {
              role: "system" as const,
              content: viewerMemoryPrompt,
            },
          ]
        : []),
      ...recentHistory,
      { role: "user", content: message },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return { reply: fallbackReply(message), estimatedCostUsd: 0, modelUsed: "fallback-local" };
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const content = body.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    return { reply: fallbackReply(message), estimatedCostUsd: 0, modelUsed: "fallback-local" };
  }

  const normalized = normalizeText(content);
  const reply =
    normalized.includes("assistant virtuel IA") || normalized.includes("je suis une ia")
      ? normalized
      : `${AI_DISCLOSURE} ${normalized}`;

  const estimatedCostUsd = estimateUsdCostFromUsage(
    body.usage?.prompt_tokens ?? 0,
    body.usage?.completion_tokens ?? 0
  );

  return {
    reply,
    estimatedCostUsd,
    modelUsed: model,
  };
}

async function saveMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: { live_id: string; user_id: string; role: "user" | "assistant"; content: string }
) {
  const { error } = await supabase.from("live_ai_messages").insert(row);
  if (
    error &&
    !error.message.toLowerCase().includes("does not exist") &&
    !error.message.toLowerCase().includes("row-level security") &&
    !error.message.toLowerCase().includes("permission")
  ) {
    throw error;
  }
}

async function saveEscalation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: { live_id: string; user_id: string; question: string; reason: string }
) {
  const { error } = await supabase.from("live_ai_escalations").insert(row);
  if (
    error &&
    !error.message.toLowerCase().includes("does not exist") &&
    !error.message.toLowerCase().includes("row-level security") &&
    !error.message.toLowerCase().includes("permission")
  ) {
    throw error;
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const liveId = (url.searchParams.get("liveId") ?? "").trim();

    if (!liveId) {
      return NextResponse.json({ error: "liveId required" }, { status: 400 });
    }

    const agentSelection = pickAgent(liveId, "", undefined);

    const { data, error } = await supabase
      .from("live_ai_messages")
      .select("id, role, content, created_at")
      .eq("live_id", liveId)
      .order("created_at", { ascending: true })
      .limit(80);

    if (error) {
      const lowered = error.message.toLowerCase();
      if (
        lowered.includes("does not exist") ||
        lowered.includes("row-level security") ||
        lowered.includes("permission")
      ) {
        return NextResponse.json({ liveId, messages: [] }, { status: 200 });
      }
      return NextResponse.json({ error: "history fetch failed" }, { status: 500 });
    }

    const messages = ((data ?? []) as StoredMessage[]).map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
      createdAt: item.created_at,
    }));

    return NextResponse.json(
      {
        liveId,
        messages,
        activeAgents: agentSelection.activeAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          gender: agent.gender,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "live ai history failed",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as ReplyRequest;
    const liveId = payload.liveId?.trim();
    const rawMessage = payload.message ?? "";
    const message = normalizeText(rawMessage);

    if (!liveId) {
      return NextResponse.json({ error: "liveId required" }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "message too long" }, { status: 400 });
    }

    const rateLimit = checkRateLimit(user.id, liveId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          reply: `${AI_DISCLOSURE} Beaucoup de messages reçus. Réessaie dans quelques secondes.`,
          retryAfterMs: rateLimit.retryAfterMs,
        },
        { status: 429 }
      );
    }

    if (hasForbiddenPattern(message)) {
      return NextResponse.json(
        {
          reply: `${AI_DISCLOSURE} Je ne peux pas traiter cette requête. Reformule ta question simplement.`,
        },
        { status: 200 }
      );
    }

    if (hasModerationPattern(message)) {
      return NextResponse.json(
        {
          reply: `${AI_DISCLOSURE} Je ne peux pas répondre à ce type de message. Pose une question sur le live ou la plateforme.`,
          confidence: 0.28,
          escalated: false,
        },
        { status: 200 }
      );
    }

    if (shouldEscalateToHuman(message)) {
      const escalationReply = `${AI_DISCLOSURE} Ta question nécessite une vérification humaine. Je la transmets à un modérateur.`;

      await saveMessage(supabase, {
        live_id: liveId,
        user_id: user.id,
        role: "user",
        content: message,
      });

      await saveMessage(supabase, {
        live_id: liveId,
        user_id: user.id,
        role: "assistant",
        content: escalationReply,
      });

      await saveEscalation(supabase, {
        live_id: liveId,
        user_id: user.id,
        question: message,
        reason: "requires_human_review",
      });

      return NextResponse.json(
        {
          liveId,
          reply: escalationReply,
          disclosure: AI_DISCLOSURE,
          confidence: 0.35,
          escalated: true,
        },
        { status: 200 }
      );
    }

    const history = Array.isArray(payload.history)
      ? payload.history.filter((item) => item?.role === "user" || item?.role === "assistant")
      : [];

    const agentSelection = pickAgent(liveId, message, payload.preferredAgentId);
    const currentMonth = getMonthKey();
    const budgetLimitUsd = getMonthlyBudgetUsd();
    const alreadySpentUsd = getBudgetUsage(currentMonth);
    const budgetRatio = budgetLimitUsd > 0 ? alreadySpentUsd / budgetLimitUsd : 0;

    if (alreadySpentUsd >= budgetLimitUsd) {
      const budgetReply = `${AI_DISCLOSURE} Le quota IA mensuel est atteint. Je passe en mode réponse courte jusqu'au prochain cycle.`;

      await saveMessage(supabase, {
        live_id: liveId,
        user_id: user.id,
        role: "user",
        content: message,
      });

      await saveMessage(supabase, {
        live_id: liveId,
        user_id: user.id,
        role: "assistant",
        content: budgetReply,
      });

      return NextResponse.json(
        {
          liveId,
          reply: budgetReply,
          disclosure: AI_DISCLOSURE,
          confidence: 0.62,
          escalated: false,
          agent: {
            id: agentSelection.agent.id,
            name: agentSelection.agent.name,
            gender: agentSelection.agent.gender,
          },
          budget: {
            month: currentMonth,
            spentUsd: alreadySpentUsd,
            limitUsd: budgetLimitUsd,
            ratio: Number(budgetRatio.toFixed(3)),
            hardLimited: true,
          },
        },
        { status: 200 }
      );
    }

    const personaPrompt = await getPersonaPrompt(supabase, liveId);
    const viewerMemoryPrompt = await getViewerMemoryPrompt(supabase, user.id, liveId);
    const generation = await generateAiReply(
      message,
      history,
      personaPrompt,
      viewerMemoryPrompt,
      agentSelection.agent,
      budgetRatio >= 0.9
    );
    const reply = generation.reply;
    addBudgetUsage(generation.estimatedCostUsd, currentMonth);
    const spentAfterReply = getBudgetUsage(currentMonth);
    const ratioAfterReply = budgetLimitUsd > 0 ? spentAfterReply / budgetLimitUsd : 0;

    await upsertViewerMemory(supabase, user.id, liveId, message);

    await saveMessage(supabase, {
      live_id: liveId,
      user_id: user.id,
      role: "user",
      content: message,
    });

    await saveMessage(supabase, {
      live_id: liveId,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });

    const confidence = estimateConfidence(message, reply);

    return NextResponse.json(
      {
        liveId,
        reply,
        disclosure: AI_DISCLOSURE,
        confidence,
        escalated: false,
        agent: {
          id: agentSelection.agent.id,
          name: agentSelection.agent.name,
          gender: agentSelection.agent.gender,
        },
        activeAgents: agentSelection.activeAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          gender: agent.gender,
        })),
        budget: {
          month: currentMonth,
          spentUsd: spentAfterReply,
          limitUsd: budgetLimitUsd,
          ratio: Number(ratioAfterReply.toFixed(3)),
          softLimited: ratioAfterReply >= 0.9,
        },
        modelUsed: generation.modelUsed,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "live ai reply failed",
        detail: String(error),
      },
      { status: 500 }
    );
  }
}
