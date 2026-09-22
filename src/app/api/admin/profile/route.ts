import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return { error: "Unauthorized", status: 401 as const };
  if (session.user.role !== "admin" && session.user.role !== "super_admin") {
    return { error: "Forbidden - Admin access required", status: 403 as const };
  }
  const user = session.user.dbId
    ? await prisma.user.findUnique({
        where: { id: session.user.dbId },
        select: { id: true, name: true, email: true, studentNumber: true, section: true, ebProfile: { select: { position: true, isActive: true } } },
      })
    : null;
  if (!user) return { error: "Admin profile not found", status: 404 as const };
  if (!user.ebProfile?.isActive) return { error: "Only active EB profiles may edit these details", status: 403 as const };
  return { user };
}

export async function GET() {
  const result = await getAdminUser();
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ user: result.user });
}

export async function PATCH(request: NextRequest) {
  try {
    const result = await getAdminUser();
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

    const body = (await request.json()) as { studentNumber?: unknown; section?: unknown };
    const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber.trim().toUpperCase() : "";
    const section = typeof body.section === "string" ? body.section.trim() : "";

    if (!studentNumber || studentNumber.length > 10 || !/^(?:\d{8,10}|N\/A)$/.test(studentNumber)) {
      return NextResponse.json({ error: "Enter a valid student number or N/A" }, { status: 400 });
    }
    if (section.length > 100) {
      return NextResponse.json({ error: "Section must be 100 characters or fewer" }, { status: 400 });
    }

    if (studentNumber !== result.user.studentNumber) {
      const [member, ea, committee] = await Promise.all([
        prisma.memberApplication.count({ where: { studentNumber: result.user.studentNumber ?? "" } }),
        prisma.executiveAssociateApplication.count({ where: { studentNumber: result.user.studentNumber ?? "" } }),
        prisma.committeeApplication.count({ where: { studentNumber: result.user.studentNumber ?? "" } }),
      ]);
      if (member + ea + committee > 0) {
        return NextResponse.json({ error: "This profile is linked to an application and its student number cannot be changed here. Ask a Super Admin to update it safely." }, { status: 409 });
      }
    }

    const user = await prisma.user.update({
      where: { id: result.user.id },
      data: { studentNumber, section: section || null },
      select: { id: true, name: true, email: true, studentNumber: true, section: true },
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "That student number is already in use" }, { status: 409 });
    }
    console.error("Failed to update admin profile", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
