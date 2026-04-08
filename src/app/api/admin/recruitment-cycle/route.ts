import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET recruitment cycles (all + active)
export async function GET() {
  try {
    const [cycles, activeCycle] = await Promise.all([
      prisma.recruitmentCycle.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.recruitmentCycle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ cycles, activeCycle });
  } catch (error) {
    console.error("Error fetching recruitment cycle:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Create or update recruitment cycle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "super_admin" && userRole !== "super-admin") {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      id,
      schoolYear,
      applicationStart,
      interviewStart,
      interviewEnd,
      isActive,
    } = body;

    if (!schoolYear || !applicationStart || !interviewStart || !interviewEnd) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: schoolYear, applicationStart, interviewStart, interviewEnd",
        },
        { status: 400 },
      );
    }

    // If this cycle is being set active, deactivate all others
    if (isActive) {
      await prisma.recruitmentCycle.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    let cycle;
    if (id) {
      cycle = await prisma.recruitmentCycle.update({
        where: { id },
        data: {
          schoolYear,
          applicationStart: new Date(applicationStart),
          interviewStart: new Date(interviewStart),
          interviewEnd: new Date(interviewEnd),
          isActive: isActive ?? false,
        },
      });
    } else {
      cycle = await prisma.recruitmentCycle.create({
        data: {
          schoolYear,
          applicationStart: new Date(applicationStart),
          interviewStart: new Date(interviewStart),
          interviewEnd: new Date(interviewEnd),
          isActive: isActive ?? false,
        },
      });
    }

    return NextResponse.json({ success: true, cycle });
  } catch (error) {
    console.error("Error managing recruitment cycle:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Delete a recruitment cycle
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "super_admin" && userRole !== "super-admin") {
      return NextResponse.json(
        { error: "Forbidden - Super admin access required" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing cycle id" }, { status: 400 });
    }

    await prisma.recruitmentCycle.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recruitment cycle:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
