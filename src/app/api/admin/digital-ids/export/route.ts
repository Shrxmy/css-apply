import { NextResponse } from "next/server";
import sharp from "sharp";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { committeeRoles } from "@/data/committeeRoles";
import { getPositionTitle } from "@/lib/eb-mapping";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import {
  createDigitalIdPdf,
  type DigitalIdPdfMember,
} from "@/lib/digital-id-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAdminRole(role: string | undefined) {
  return role === "admin" || role === "super_admin" || role === "super-admin";
}

function getRoleTitle(user: {
  memberApplications: Array<{ paymentStatus: string }>;
  committeeApplications: Array<{
    firstOptionCommittee: string;
    paymentStatus: string;
  }>;
  executiveAssociateApplications: Array<{
    ebRole: string;
    firstOptionEb: string;
    paymentStatus: string;
  }>;
}) {
  const ea = user.executiveAssociateApplications[0];
  if (ea?.paymentStatus === "approved") {
    return `Executive Associate (${getPositionTitle(ea.ebRole || ea.firstOptionEb)})`;
  }

  const committee = user.committeeApplications[0];
  if (committee?.paymentStatus === "approved") {
    const role = committeeRoles.find(
      (item) => item.id === committee.firstOptionCommittee,
    );
    return `Staff - ${role?.title || committee.firstOptionCommittee}`;
  }

  return "Official Member";
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdminRole(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cycle = await prisma.recruitmentCycle.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        schoolYear: true,
        membershipExpiration: true,
      },
    });

    if (!cycle) {
      return NextResponse.json(
        { error: "No active recruitment cycle found" },
        { status: 404 },
      );
    }

    const memberships = await prisma.membership.findMany({
      where: { recruitmentCycleId: cycle.id },
      select: {
        memberId: true,
        photoPath: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            studentNumber: true,
            section: true,
            memberApplications: {
              where: { recruitmentCycleId: cycle.id },
              select: { paymentStatus: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            committeeApplications: {
              where: { recruitmentCycleId: cycle.id },
              select: {
                firstOptionCommittee: true,
                paymentStatus: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            executiveAssociateApplications: {
              where: { recruitmentCycleId: cycle.id },
              select: {
                ebRole: true,
                firstOptionEb: true,
                paymentStatus: true,
              },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
      orderBy: [{ user: { name: "asc" } }, { memberId: "asc" }],
    });

    const eligibleMemberships = memberships.filter((membership) => {
      const user = membership.user;
      return [
        user.memberApplications[0]?.paymentStatus,
        user.committeeApplications[0]?.paymentStatus,
        user.executiveAssociateApplications[0]?.paymentStatus,
      ].includes("approved");
    });

    const members: DigitalIdPdfMember[] = await Promise.all(
      eligibleMemberships.map(async (membership) => {
        let photo: Buffer | null = null;
        if (membership.photoPath) {
          const { data } = await supabase.storage
            .from("member-id-photos")
            .download(membership.photoPath);
          if (data) {
            try {
              photo = await sharp(Buffer.from(await data.arrayBuffer()))
                .resize(320, 320, { fit: "cover", position: "centre" })
                .png()
                .toBuffer();
            } catch (photoError) {
              console.warn(
                "Skipping an invalid digital ID photo during export:",
                photoError instanceof Error
                  ? photoError.message
                  : "unknown error",
              );
            }
          }
        }

        return {
          memberId: membership.memberId,
          schoolYear: cycle.schoolYear,
          roleTitle: getRoleTitle(membership.user),
          issueDate: membership.createdAt,
          expirationDate: cycle.membershipExpiration,
          name: membership.user.name,
          studentNumber: membership.user.studentNumber || "N/A",
          section: membership.user.section || "N/A",
          photo,
        };
      }),
    );

    if (members.length === 0) {
      return NextResponse.json(
        { error: "No eligible digital IDs found for the active cycle" },
        { status: 404 },
      );
    }

    if (new URL(request.url).searchParams.get("format") === "print-data") {
      return NextResponse.json({
        schoolYear: cycle.schoolYear,
        membershipExpiration: cycle.membershipExpiration,
        members: members.map((member) => ({
          memberId: member.memberId,
          schoolYear: member.schoolYear,
          roleTitle: member.roleTitle,
          issueDate: member.issueDate.toISOString(),
          expirationDate: member.expirationDate?.toISOString() || null,
          name: member.name,
          studentNumber: member.studentNumber,
          section: member.section,
          photo: member.photo
            ? `data:image/png;base64,${member.photo.toString("base64")}`
            : null,
        })),
      });
    }

    const pdf = await createDigitalIdPdf(members);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="css-digital-ids-${date}.pdf"`,
        "Content-Length": String(pdf.byteLength),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Digital ID PDF export failed:", error);
    return NextResponse.json(
      { error: "Could not generate the digital ID export" },
      { status: 500 },
    );
  }
}
