import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUserExists } from "@/services/user/userService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user-id";

    await ensureUserExists(userId);

    const settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("[API-Settings] Error fetching settings:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, resetWallet, ...updateData } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    }

    await ensureUserExists(userId);

    if (resetWallet) {
      // Delete active positions and trades to fully reset the environment
      await prisma.position.deleteMany({ where: { userId } });
      await prisma.trade.deleteMany({ where: { userId, executionType: "PAPER" } });

      await prisma.wallet.update({
        where: { userId },
        data: {
          balance: 10000.0,
          totalDeposited: 10000.0,
          totalWithdrawn: 0.0,
          realizedPnl: 0.0,
        }
      });
      return NextResponse.json({ success: true });
    }

    const updatedSettings = await prisma.userSettings.update({
      where: { userId },
      data: updateData,
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error("[API-Settings] Error updating settings:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
