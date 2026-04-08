import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getPositionFromRoleId } from "@/lib/eb-mapping";

// GET unavailable slots for admin view
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const unavailableSlots = await prisma.availableEBInterviewTime.findMany({
      where: {
        ...(id && { eb: getPositionFromRoleId(id) }),
      },
      orderBy: [{ day: "asc" }, { timeStart: "asc" }],
    });

    const unavailableSlotsData = unavailableSlots.map((slot) => ({
      id: slot.id,
      date: slot.day,
      timeSlot: `${slot.timeStart}-${slot.timeEnd}`,
      startTime: slot.timeStart,
      endTime: slot.timeEnd,
    }));

    return NextResponse.json({ unavailableSlotsData });
  } catch (error) {
    console.error("Error fetching unavailable slots:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
