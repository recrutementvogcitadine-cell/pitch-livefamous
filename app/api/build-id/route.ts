import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      buildId:
        process.env.NEXT_PUBLIC_BUILD_ID ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        "local-dev",
      vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      now: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
      },
    }
  );
}
