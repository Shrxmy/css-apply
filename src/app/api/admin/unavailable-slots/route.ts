// app/api/admin/unavailable-slots/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// POST to mark unavailable times (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const unavailableSlots: {
      id: string;
      eb: string;
      day: string;
      timeStart: string;
      timeEnd: string;
    }[] = await request.json();

    const unavailableSlotsData = unavailableSlots.map((slot) => ({
      id: `${slot.id}-${slot.eb}`,
      eb: slot.eb,
      day: slot.day,
      timeStart: slot.timeStart,
      timeEnd: slot.timeEnd,
      maxSlots: 0,
      currentSlots: 0,
    }));

    // Get current unavailable slots for this EB from database
    const currentDbSlots = await prisma.availableEBInterviewTime.findMany({
      where: {
        eb: unavailableSlots[0]?.eb, // Get EB from first slot
        maxSlots: 0, // Only unavailable slots
      },
    });

    // Get IDs of slots being passed in (with EB suffix to match DB format)
    const incomingSlotIds = unavailableSlots.map(
      (slot) => `${slot.id}-${slot.eb}`,
    );

    // Find slots that exist in DB but not in incoming data (these should be deleted)
    const slotsToDelete = currentDbSlots.filter(
      (dbSlot: typeof currentDbSlots[number]) => !incomingSlotIds.includes(dbSlot.id),
    );

    // Delete removed slots
    if (slotsToDelete.length > 0) {
      await prisma.availableEBInterviewTime.deleteMany({
        where: {
          id: {
            in: slotsToDelete.map((slot: typeof slotsToDelete[number]) => slot.id),
          },
        },
      });
    }

    // Calculate remaining DB slot IDs after deletion (exclude deleted ones)
    const remainingDbSlotIds = currentDbSlots
      .filter(
        (slot: typeof currentDbSlots[number]) =>
          !slotsToDelete.some((deletedSlot: typeof slotsToDelete[number]) => deletedSlot.id === slot.id),
      )
      .map((slot: typeof currentDbSlots[number]) => slot.id);

    // Filter out slots that already exist in the database
    const newSlotsToCreate = unavailableSlotsData.filter(
      (slot) => !remainingDbSlotIds.includes(slot.id),
    );

    // Only create truly new slots
    if (newSlotsToCreate.length > 0) {
      await prisma.availableEBInterviewTime.createMany({
        data: newSlotsToCreate,
      });
    }

    return NextResponse.json({
      success: true,
      unavailableSlotsData,
      message: "Unavailable time marked successfully",
    });
  } catch (error) {
    console.error("Error creating unavailable slot:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
