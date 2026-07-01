import { NextResponse } from "next/server";
import { listProjectGroups } from "@/lib/sessions";

// Always read fresh from disk — sessions change as the user works.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const groups = await listProjectGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read sessions" },
      { status: 500 },
    );
  }
}
