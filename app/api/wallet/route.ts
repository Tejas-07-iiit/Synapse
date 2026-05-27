import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUserExists } from "@/services/user/userService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user-id";

    await ensureUserExists(userId);

    const wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    return NextResponse.json({ success: true, wallet });
  } catch (error) {
    console.error("[API-Wallet] Error fetching wallet:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
