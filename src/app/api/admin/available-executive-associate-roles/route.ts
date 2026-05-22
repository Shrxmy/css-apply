import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { roles } from "@/data/ebRoles";
import { prisma } from "@/lib/prisma";

const CONFIG_KEY = "available_executive_associate_roles";

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

function defaultAvailability() {
  return Object.fromEntries(roles.map((role) => [role.id, true]));
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    const availability = {
      ...defaultAvailability(),
      ...(config ? JSON.parse(config.value) : {}),
    };

    return NextResponse.json({ availability });
  } catch (error) {
    console.error("Get available executive associate roles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { availability } = await request.json();

    if (!availability || typeof availability !== "object") {
      return NextResponse.json(
        { error: "Availability map is required" },
        { status: 400 },
      );
    }

    const sanitizedAvailability = Object.fromEntries(
      roles.map((role) => [role.id, Boolean(availability[role.id])]),
    );

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: JSON.stringify(sanitizedAvailability) },
      create: {
        key: CONFIG_KEY,
        value: JSON.stringify(sanitizedAvailability),
        description: "Executive Associate EB roles available for applicants",
      },
    });

    return NextResponse.json({ availability: sanitizedAvailability });
  } catch (error) {
    console.error("Update available executive associate roles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
