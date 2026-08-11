import { NextResponse } from "next/server";
import { roles } from "@/data/ebRoles";
import { getPositionTitle } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GET() {
  try {
    const activeCycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      select: { id: true, schoolYear: true },
    });

    let ebProfiles: Array<{
      position: string;
      meetingLink: string | null;
      imagePath: string | null;
      user: { name: string };
    }>;

    try {
      ebProfiles = await prisma.eBProfile.findMany({
        where: {
          isActive: true,
          ...(activeCycle ? { recruitmentCycleId: activeCycle.id } : {}),
        },
        select: {
          position: true,
          meetingLink: true,
          imagePath: true,
          user: { select: { name: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "P2022"
      ) {
        console.warn(
          "EBProfile.recruitmentCycleId is missing. Falling back to active EB profiles. Run `npx prisma db push` to enable AY-specific EB roles.",
        );

        ebProfiles = await prisma.eBProfile.findMany({
          where: { isActive: true },
          select: {
            position: true,
            meetingLink: true,
            imagePath: true,
            user: { select: { name: true } },
          },
        });
      } else {
        throw error;
      }
    }

    const availabilityConfig = await prisma.systemConfig.findUnique({
      where: { key: "available_executive_associate_roles" },
    });

    const availability = availabilityConfig
      ? JSON.parse(availabilityConfig.value) as Record<string, boolean>
      : {};

    const profileByPosition = new Map(
      ebProfiles.map((profile) => [profile.position, profile]),
    );

    const dynamicRoles = roles.filter((role) => availability[role.id] !== false).map((role) => {
      const profile = profileByPosition.get(getPositionTitle(role.id));

      return {
        ...role,
        ebName: profile?.user.name ? toTitleCase(profile.user.name) : "-",
        meetingLink: profile?.meetingLink || null,
        imageUrl: profile?.imagePath
          ? `/api/eb-roles/${encodeURIComponent(role.id)}/image?v=${encodeURIComponent(profile.imagePath)}`
          : null,
        schoolYear: activeCycle?.schoolYear || null,
      };
    });

    return NextResponse.json({ roles: dynamicRoles, activeCycle });
  } catch (error) {
    console.error("Get EB roles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
