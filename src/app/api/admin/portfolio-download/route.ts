import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

// GET Portfolio download link for Committee applications
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin access
    const userRole = session.user.role;
    const hasAdminAccess = userRole === "admin" || userRole === "super_admin";

    if (!hasAdminAccess) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const applicationId = searchParams.get("applicationId");

    if (!applicationId) {
      return NextResponse.json(
        { error: "Missing applicationId parameter" },
        { status: 400 },
      );
    }

    // Get committee application
    const application = await prisma.committeeApplication.findUnique({
      where: { id: applicationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    const portfolioLink = application.portfolioLink;

    if (!portfolioLink) {
      return NextResponse.json(
        { error: "Portfolio file not found for this application" },
        { status: 404 },
      );
    }

    try {
      // Check if portfolioLink is a full URL or just a path
      if (portfolioLink.startsWith("http")) {
        // It's a full URL, extract bucket and file path (handle both public and signed URLs)
        const urlMatch = portfolioLink.match(
          /\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+?)(?:\?|$)/,
        );

        if (urlMatch) {
          const bucketName = urlMatch[1];
          const filePath = urlMatch[2];

          // Generate a signed URL for better security (24 hours expiration)
          const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 86400);

          if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json(
              { error: "Failed to generate download link" },
              { status: 500 },
            );
          }

          return NextResponse.json({
            success: true,
            downloadUrl: data.signedUrl,
            fileName: `${application.user.name}_${application.user.studentNumber}_Portfolio.pdf`,
            application: {
              id: application.id,
              studentNumber: application.user.studentNumber,
              userName: application.user.name,
              userEmail: application.user.email,
            },
          });
        } else {
          // If we can't parse the URL, return the original URL as download link
          return NextResponse.json({
            success: true,
            downloadUrl: portfolioLink,
            fileName: `${application.user.name}_${application.user.studentNumber}_Portfolio.pdf`,
            application: {
              id: application.id,
              studentNumber: application.user.studentNumber,
              userName: application.user.name,
              userEmail: application.user.email,
            },
          });
        }
      } else {
        // It's just a file path, use the committee-applications bucket
        const bucketName = "committee-applications";

        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(portfolioLink, 86400);

        if (error) {
          console.error("Supabase error:", error);
          return NextResponse.json(
            { error: "Failed to generate download link" },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          downloadUrl: data.signedUrl,
          fileName: `${application.user.name}_${application.user.studentNumber}_Portfolio.pdf`,
          application: {
            id: application.id,
            studentNumber: application.user.studentNumber,
            userName: application.user.name,
            userEmail: application.user.email,
          },
        });
      }
    } catch (supabaseError) {
      console.error("Supabase storage error:", supabaseError);
      return NextResponse.json(
        { error: "Failed to access portfolio file" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error generating portfolio download link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
