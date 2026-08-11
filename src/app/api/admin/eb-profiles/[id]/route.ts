import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    const isAdmin = role === "admin" || role === "super_admin";
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden — Admin access required" },
        { status: 403 },
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const ebProfile = await prisma.eBProfile.findUnique({
      where: { userId: id },
    });

    if (!ebProfile) {
      return NextResponse.json(
        { error: "EB profile not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, ebProfile });
  } catch (error) {
    console.error("Error getting EB profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
