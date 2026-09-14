import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";
import { getManilaDateKey } from "@/lib/manila-date";

interface UnavailableSlotInput {
  day?: unknown;
  timeStart?: unknown;
  timeEnd?: unknown;
}

function parseTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [operator, activeCycle] = await Promise.all([
      prisma.user.findUnique({
        where: { email: session.user.email },
        select: {
          role: true,
          ebProfile: {
            select: {
              position: true,
              isActive: true,
              recruitmentCycleId: true,
            },
          },
        },
      }),
      prisma.recruitmentCycle.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        select: { id: true, interviewStart: true, interviewEnd: true },
      }),
    ]);

    if (
      !operator ||
      (operator.role !== "admin" && operator.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      !activeCycle?.interviewStart ||
      !activeCycle.interviewEnd ||
      !operator.ebProfile?.isActive ||
      operator.ebProfile.recruitmentCycleId !== activeCycle.id
    ) {
      return NextResponse.json(
        { error: "No active-cycle EB profile or interview period was found" },
        { status: 409 },
      );
    }

    const body: unknown = await request.json();
    const rawSlots = Array.isArray(body)
      ? body
      : typeof body === "object" && body !== null && "slots" in body
        ? (body as { slots: unknown }).slots
        : null;
    if (!Array.isArray(rawSlots) || rawSlots.length > 500) {
      return NextResponse.json(
        { error: "Provide no more than 500 unavailable time blocks" },
        { status: 400 },
      );
    }

    const interviewStart = getManilaDateKey(activeCycle.interviewStart);
    const interviewEnd = getManilaDateKey(activeCycle.interviewEnd);
    const position = getPositionTitle(operator.ebProfile.position);
    const normalizedSlots = rawSlots.map((rawSlot, index) => {
      const slot = rawSlot as UnavailableSlotInput;
      if (
        typeof slot.day !== "string" ||
        typeof slot.timeStart !== "string" ||
        typeof slot.timeEnd !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(slot.day)
      ) {
        throw new Error(`INVALID_SLOT_${index}`);
      }

      const start = parseTime(slot.timeStart);
      const end = parseTime(slot.timeEnd);
      if (
        slot.day < interviewStart ||
        slot.day > interviewEnd ||
        start === null ||
        end === null ||
        start < 7 * 60 ||
        end > 21 * 60 ||
        start >= end ||
        start % 30 !== 0 ||
        end % 30 !== 0
      ) {
        throw new Error(`INVALID_SLOT_${index}`);
      }

      return {
        id: `${slot.day}-${slot.timeStart}-${slot.timeEnd}-${position}`,
        eb: position,
        day: slot.day,
        timeStart: slot.timeStart,
        timeEnd: slot.timeEnd,
        maxSlots: 0,
        currentSlots: 0,
      };
    });

    const uniqueSlots = Array.from(
      new Map(normalizedSlots.map((slot) => [slot.id, slot])).values(),
    );

    await prisma.$transaction(async (tx) => {
      await tx.availableEBInterviewTime.deleteMany({
        where: {
          OR: [position, getRoleId(position)].map((value) => ({
            eb: { equals: value, mode: "insensitive" as const },
          })),
          maxSlots: 0,
          day: { gte: interviewStart, lte: interviewEnd },
        },
      });
      if (uniqueSlots.length > 0) {
        await tx.availableEBInterviewTime.createMany({ data: uniqueSlots });
      }
    });

    return NextResponse.json({
      success: true,
      unavailableSlotsData: uniqueSlots,
      message:
        uniqueSlots.length > 0
          ? "Unavailable times saved successfully"
          : "You are marked available for the full interview period",
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("INVALID_SLOT_")) {
      return NextResponse.json(
        { error: "One or more unavailable time blocks are invalid" },
        { status: 400 },
      );
    }

    console.error(
      "Unavailable time update error",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "Unable to save unavailable times" },
      { status: 500 },
    );
  }
}
