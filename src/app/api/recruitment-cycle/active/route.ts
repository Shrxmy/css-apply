import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        schoolYear: true,
        applicationStart: true,
        interviewStart: true,
        interviewEnd: true,
      },
    });

    return NextResponse.json({ activeCycle });
  } catch (error) {
    console.error(
      "Failed to load the active recruitment cycle",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Unable to load the active recruitment cycle" },
      { status: 500 },
    );
  }
}
