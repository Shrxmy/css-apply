import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const toDateOnlyTimestamp = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
};

const getTodayDateOnlyTimestamp = () => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};

const isPrismaUniqueError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

// GET recruitment cycles (all + active)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    const hasAdminAccess =
      userRole === "admin" ||
      userRole === "super_admin" ||
      userRole === "super-admin";

    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const cycles = hasAdminAccess
      ? await prisma.recruitmentCycle.findMany({
          orderBy: { createdAt: "desc" },
        })
      : [];

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

    const applicationStartTime = toDateOnlyTimestamp(applicationStart);
    const interviewStartTime = toDateOnlyTimestamp(interviewStart);
    const interviewEndTime = toDateOnlyTimestamp(interviewEnd);
    const todayTime = getTodayDateOnlyTimestamp();

    if (
      applicationStartTime < todayTime ||
      interviewStartTime < todayTime ||
      interviewEndTime < todayTime
    ) {
      return NextResponse.json(
        { error: "Recruitment cycle dates cannot be set in the past" },
        { status: 400 },
      );
    }

    if (interviewStartTime < applicationStartTime) {
      return NextResponse.json(
        { error: "Interview start cannot be before application start" },
        { status: 400 },
      );
    }

    if (interviewEndTime < interviewStartTime) {
      return NextResponse.json(
        { error: "Interview last day cannot be before interview start" },
        { status: 400 },
      );
    }

    const cycle = await prisma.$transaction(async (tx) => {
      // Serialize activation changes so concurrent requests cannot leave two
      // recruitment cycles active.
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext('active-recruitment-cycle'))
      `);

      if (isActive) {
        await tx.recruitmentCycle.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }

      const cycleData = {
        applicationStart: new Date(applicationStart),
        interviewStart: new Date(interviewStart),
        interviewEnd: new Date(interviewEnd),
        isActive: isActive ?? false,
      };

      if (id) {
        return tx.recruitmentCycle.update({
          where: { id },
          data: { schoolYear, ...cycleData },
        });
      }

      return tx.recruitmentCycle.upsert({
        where: { schoolYear },
        update: cycleData,
        create: { schoolYear, ...cycleData },
      });
    });

    return NextResponse.json({ success: true, cycle });
  } catch (error) {
    console.error("Error managing recruitment cycle:", error);

    if (isPrismaUniqueError(error)) {
      return NextResponse.json(
        { error: "A recruitment cycle for this school year already exists" },
        { status: 409 },
      );
    }

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
