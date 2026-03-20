import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { recordSwipe } from "@/lib/tools/raj-tools";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const { roleId, direction, rajReason } = (await req.json()) as {
    roleId?: string;
    direction?: "yes" | "no";
    rajReason?: string;
  };

  if (!roleId || !direction) {
    return NextResponse.json({ error: "roleId and direction required" }, { status: 400 });
  }

  const result = await recordSwipe(userId, roleId, direction, rajReason);
  return NextResponse.json(result);
}
