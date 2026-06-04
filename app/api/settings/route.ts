import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ensureUserExists } from "@/services/user/userService";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "default-user-id";

    await ensureUserExists(userId);

    let settings: any = null;
    try {
      settings = await (prisma as any).userSettings.findUnique({
        where: { userId },
      });
    } catch (err: any) {
      if (err.message.includes("riskPerTradePct")) {
        console.warn("[API-Settings] Prisma desync detected, falling back to Raw SQL.");
        const rawResults: any[] = await prisma.$queryRawUnsafe(
          `SELECT * FROM "UserSettings" WHERE "userId" = $1 LIMIT 1`,
          userId
        );
        settings = rawResults.length > 0 ? rawResults[0] : null;
      } else {
        throw err;
      }
    }

    if (settings && settings.riskPerTradePct === undefined) {
      settings.riskPerTradePct = 2.0;
    }

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

    let updatedSettings: any = null;
    try {
      updatedSettings = await prisma.userSettings.update({
        where: { userId },
        data: updateData,
      });
    } catch (err: any) {
      console.warn("[API-Settings] Prisma update failed, attempting raw SQL fallback:", err.message);
      
      const setClauses: string[] = [];
      const values: any[] = [];
      let i = 1;

      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          setClauses.push(`"${key}" = $${i}`);
          values.push(value);
          i++;
        }
      }

      if (setClauses.length > 0) {
        setClauses.push(`"updatedAt" = NOW()`);
        values.push(userId);
        const query = `UPDATE "UserSettings" SET ${setClauses.join(', ')} WHERE "userId" = $${i} RETURNING *`;
        
        const rawResults: any[] = await prisma.$queryRawUnsafe(query, ...values);
        
        if (rawResults && rawResults.length > 0) {
          updatedSettings = rawResults[0];
          console.log("[API-Settings] Raw SQL fallback succeeded.");
        } else {
          throw new Error("Raw SQL fallback resulted in 0 updated rows.");
        }
      } else {
         throw new Error("No valid fields provided for update.");
      }
    }

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error("[API-Settings] Error updating settings:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
