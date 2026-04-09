import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      session?.user?.role !== "admin" &&
      session?.user?.role !== "super_admin"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // member, committee, ea
    const committee = searchParams.get("committee"); // specific committee for committee staff
    const status = searchParams.get("status"); // all, accepted, pending, rejected

    if (!type) {
      return NextResponse.json(
        { error: "Type parameter is required" },
        { status: 400 },
      );
    }

    let csvData = "";
    let filename = "";

    switch (type) {
      case "member":
        csvData = await exportMemberApplications(status);
        filename = `accepted-member-applications-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "committee":
        csvData = await exportCommitteeApplications(committee, status);
        filename = `accepted-committee-applications-${committee || "all"}-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      case "ea":
        csvData = await exportEAApplications(status);
        filename = `accepted-ea-applications-${new Date().toISOString().split("T")[0]}.csv`;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 },
        );
    }

    return new NextResponse(csvData, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function exportMemberApplications(_status: string | null) {
  const whereClause: Record<string, unknown> = {
    hasAccepted: true, // Only export accepted member applications
  };

  // Note: For member applications, we only export accepted ones
  // Redirected applications to Member are created with hasAccepted: true

  const applications = await prisma.memberApplication.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentNumber: true,
          section: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Name",
    "Email",
    "Student Number",
    "Section",
    "Member ID",
    "Status",
    "Payment Proof",
    "Applied Date",
    "Updated Date",
  ];

  const rows = applications.map((app: typeof applications[number]) => [
    app.user.name,
    app.user.email,
    app.user.studentNumber || "",
    app.user.section || "",
    app.user.id.slice(-7).toUpperCase(), // Truncated Member ID
    "Accepted", // All member applications in CSV are accepted
    app.paymentProof || "",
    app.createdAt.toISOString().split("T")[0],
    app.updatedAt.toISOString().split("T")[0],
  ]);

  return generateCSV(headers, rows);
}

async function exportCommitteeApplications(
  committee: string | null,
  _status: string | null,
) {
  const whereClause: Record<string, unknown> = {};

  if (committee && committee !== "all") {
    // For committee-specific exports, we need to be more precise about what to include:
    // 1. Applications accepted TO this committee (firstOptionCommittee = committee AND hasAccepted = true)
    // 2. Applications redirected TO this committee (redirection contains committee-related values)

    // Get the committee title for the given committee ID
    const { committeeRolesSubmitted } = await import("@/data/committeeRoles");
    const committeeData = committeeRolesSubmitted.find(
      (c) => c.id === committee,
    );
    const committeeTitle = committeeData?.title;

    whereClause.OR = [
      // Case 1: Applications accepted TO this committee
      {
        firstOptionCommittee: committee,
        hasAccepted: true,
        redirection: null, // Not redirected elsewhere
      },
      // Case 2: Applications redirected TO this committee
      ...(committeeTitle
        ? [
            { redirection: committee }, // By committee ID
            { redirection: committeeTitle }, // By committee title
            { redirection: `committee-${committee}` }, // By committee-{id} format
            { redirection: `${committeeTitle} Staff` }, // By committee title + Staff format
          ]
        : [
            { redirection: committee }, // Fallback to just committee ID
            { redirection: `committee-${committee}` }, // Fallback to committee-{id} format
          ]),
    ];
  } else {
    // For 'all' committee exports, include all accepted and redirected applications
    whereClause.OR = [
      { hasAccepted: true }, // Accepted applications
      { redirection: { not: null } }, // Redirected applications
    ];
  }

  // Note: We include both accepted and redirected applications

  const applications = await prisma.committeeApplication.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentNumber: true,
          section: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Name",
    "Email",
    "Student Number",
    "Section",
    "Member ID",
    "First Option Committee",
    "Second Option Committee",
    "Status",
    "Redirection",
    "Interview Day",
    "Interview Time",
    "Interview By",
    "Applied Date",
    "Updated Date",
  ];

  const rows = applications.map((app: typeof applications[number]) => [
    app.user.name,
    app.user.email,
    app.user.studentNumber || "",
    app.user.section || "",
    app.user.id.slice(-7).toUpperCase(), // Truncated Member ID
    app.firstOptionCommittee || "",
    app.secondOptionCommittee || "",
    app.redirection ? "Redirected" : app.hasAccepted ? "Accepted" : "Pending",
    app.redirection || "",
    app.interviewSlotDay || "",
    app.interviewSlotTimeStart || "",
    app.interviewBy || "",
    app.createdAt.toISOString().split("T")[0],
    app.updatedAt.toISOString().split("T")[0],
  ]);

  return generateCSV(headers, rows);
}

async function exportEAApplications(_status: string | null) {
  const whereClause: Record<string, unknown> = {
    hasAccepted: true, // Only export accepted EA applications
    redirection: null, // Exclude redirected applications
  };

  // Note: For EA applications, we only export accepted ones that were NOT redirected
  // Redirected EA applications should not be included in EA CSV

  const applications = await prisma.eAApplication.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          studentNumber: true,
          section: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const headers = [
    "Name",
    "Email",
    "Student Number",
    "Section",
    "Member ID",
    "EB Role",
    "First Option EB",
    "Second Option EB",
    "Status",
    "Redirection",
    "Interview Day",
    "Interview Time",
    "Interview By",
    "Applied Date",
    "Updated Date",
  ];

  const rows = applications.map((app: typeof applications[number]) => [
    app.user.name,
    app.user.email,
    app.user.studentNumber || "",
    app.user.section || "",
    app.user.id.slice(-7).toUpperCase(), // Truncated Member ID
    app.ebRole || "",
    app.firstOptionEb || "",
    app.secondOptionEb || "",
    "Accepted", // All EA applications in CSV are accepted
    app.redirection || "",
    app.interviewSlotDay || "",
    app.interviewSlotTimeStart || "",
    app.interviewBy || "",
    app.createdAt.toISOString().split("T")[0],
    app.updatedAt.toISOString().split("T")[0],
  ]);

  return generateCSV(headers, rows);
}

function generateCSV(headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}
