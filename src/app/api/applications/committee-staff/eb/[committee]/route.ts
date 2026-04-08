import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getCommitteeEBRoleFromCommitteeId } from "@/data/committeeRoles";

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

    const ebs = await prisma.eBProfile.findMany({
      select: {
        position: true,
      },
      where: {
        committees: {
          has: getCommitteeEBRoleFromCommitteeId(committee),
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
