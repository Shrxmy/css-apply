import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// POST to resolve a specific conflict by clearing one of the conflicting bookings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "admin" && session.user.role !== "super_admin")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { studentNumber, applicationType } = await request.json();

    if (!studentNumber || !applicationType) {
      return NextResponse.json(
        { error: "Student number and application type are required" },
        { status: 400 },
      );
    }

    let updatedApplication;

    if (applicationType === "executive-associate") {
      updatedApplication = await prisma.executiveAssociateApplication.updateMany({
        where: { studentNumber },
        data: {
          interviewSlotDay: null,
          interviewSlotTimeStart: null,
          interviewSlotTimeEnd: null,
          interviewBy: null,
        },
      });
    } else if (applicationType === "committee") {
      updatedApplication = await prisma.committeeApplication.updateMany({
        where: { studentNumber },
        data: {
          interviewSlotDay: null,
          interviewSlotTimeStart: null,
          interviewSlotTimeEnd: null,
          interviewBy: null,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid application type. Must be "executive-associate" or "committee"' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conflict resolved successfully",
      application: updatedApplication,
    });
  } catch (error) {
    console.error("Error resolving conflict:", error);

    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
