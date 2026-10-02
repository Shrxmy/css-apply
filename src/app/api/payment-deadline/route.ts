import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentPolicy } from "@/lib/payment-deadline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, schoolYear: true },
    });
    if (!cycle) {
      return NextResponse.json(
        { cycle: null, deadline: null, closed: false, deadlinePassed: false },
        { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      );
    }

    const policy = await getPaymentPolicy(cycle.id);
    const deadlinePassed = Boolean(
      policy.deadline && Date.now() >= new Date(policy.deadline).getTime(),
    );
    return NextResponse.json(
      { cycle, ...policy, deadlinePassed },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    console.error(
      "Get applicant payment deadline failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
