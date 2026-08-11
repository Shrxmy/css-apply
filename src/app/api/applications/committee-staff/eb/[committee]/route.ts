import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

// GET all applications with filtering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ committee: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { committee } = await params;
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!activeCycle) {
      return NextResponse.json({ success: true, ebs: [] });
    }

    const ebs = await prisma.eBProfile.findMany({
      select: {
        position: true,
      },
      where: {
        recruitmentCycleId: activeCycle.id,
        isActive: true,
        committees: {
          has: committee,
        },
      },
    });

    return NextResponse.json({
      success: true,
      ebs,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
