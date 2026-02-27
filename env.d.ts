declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_SUPABASE_URL?: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    SUPABASE_SERVICE_ROLE?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    NEXT_PUBLIC_AGORA_APP_ID?: string;
    AGORA_APP_ID?: string;
    AGORA_APP_CERT?: string;
    AGORA_TOKEN_SECRET?: string;
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_COMPLEX_MODEL?: string;
    LIVE_AI_COOLDOWN_MS?: string;
    LIVE_AI_MAX_PER_MINUTE?: string;
    LIVE_AI_ACTIVE_AGENT_SLOTS?: string;
    LIVE_AI_MONTHLY_BUDGET_USD?: string;
    LIVE_AI_MODERATOR_EMAILS?: string;
  }
}
