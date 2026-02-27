import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUTTON_LABELS = {
  goLiveLabel: "Passer en live caméra",
  goLiveCreatorLabel: "Passer en live (créateur)",
  becomeCreatorLabel: "Devenir créateur",
};

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET() {
  try {
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json(DEFAULT_BUTTON_LABELS, { status: 200 });
    }

    const { data, error } = await adminClient
      .from("app_button_labels")
      .select("go_live_label,go_live_creator_label,become_creator_label")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(DEFAULT_BUTTON_LABELS, { status: 200 });
    }

    return NextResponse.json(
      {
        goLiveLabel:
          typeof data?.go_live_label === "string" && data.go_live_label.trim()
            ? data.go_live_label
            : DEFAULT_BUTTON_LABELS.goLiveLabel,
        goLiveCreatorLabel:
          typeof data?.go_live_creator_label === "string" && data.go_live_creator_label.trim()
            ? data.go_live_creator_label
            : DEFAULT_BUTTON_LABELS.goLiveCreatorLabel,
        becomeCreatorLabel:
          typeof data?.become_creator_label === "string" && data.become_creator_label.trim()
            ? data.become_creator_label
            : DEFAULT_BUTTON_LABELS.becomeCreatorLabel,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(DEFAULT_BUTTON_LABELS, { status: 200 });
  }
}
