import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPositionTitle, getRoleId } from "@/lib/eb-mapping";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      applicationId?: string;
      type?: string;
    };
    if (
      !body.applicationId ||
      (body.type !== "committee" && body.type !== "executive-associate")
    ) {
      return NextResponse.json(
        { error: "applicationId and a valid application type are required" },
        { status: 400 },
      );
    }

    const application =
      body.type === "committee"
        ? await prisma.committeeApplication.findUnique({
            where: { id: body.applicationId },
            select: { id: true, interviewBy: true },
          })
        : await prisma.executiveAssociateApplication.findUnique({
            where: { id: body.applicationId },
            select: { id: true, interviewBy: true },
          });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (role !== "super_admin") {
      const profile = session.user.dbId
        ? await prisma.eBProfile.findUnique({
            where: { userId: session.user.dbId },
            select: { position: true },
          })
        : null;
      const assignedValues = profile
        ? [
            profile.position,
            getPositionTitle(profile.position),
            getRoleId(profile.position),
          ]
            .filter(Boolean)
            .map((value) => value.toLowerCase())
        : [];

      if (
        !application.interviewBy ||
        !assignedValues.includes(application.interviewBy.toLowerCase())
      ) {
        return NextResponse.json(
          { error: "You may only reset schedules assigned to you" },
          { status: 403 },
        );
      }
    }

    const data = {
      interviewSlotDay: null,
      interviewSlotTimeStart: null,
      interviewSlotTimeEnd: null,
      interviewBy: null,
    };

    if (body.type === "committee") {
      await prisma.committeeApplication.update({
        where: { id: body.applicationId },
        data,
      });
    } else {
      await prisma.executiveAssociateApplication.update({
        where: { id: body.applicationId },
        data,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reset interview schedule", error);
    return NextResponse.json(
      { error: "Failed to reset interview schedule" },
      { status: 500 },
    );
  }
}
