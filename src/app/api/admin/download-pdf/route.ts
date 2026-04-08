import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

// GET PDF file with download headers for forced download
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
    const type = searchParams.get("type"); // 'cv' or 'portfolio'
    const applicationType = searchParams.get("applicationType"); // 'ea' or 'committee'

    if (!applicationId || !type || !applicationType) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    let application;
    let supabaseFilePath: string | null = null;
    let fileName: string;

    // Get application data based on type
    if (applicationType === "ea") {
      application = await prisma.eAApplication.findUnique({
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

      if (type === "cv") {
        supabaseFilePath = application?.supabaseFilePath || null;
        fileName = `${application?.user.name}_${application?.user.studentNumber}_CV.pdf`;
      } else {
        return NextResponse.json(
          { error: "Invalid type for EA application" },
          { status: 400 },
        );
      }
    } else if (applicationType === "committee") {
      application = await prisma.committeeApplication.findUnique({
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

      if (type === "cv") {
        supabaseFilePath = application?.supabaseFilePath || null;
        fileName = `${application?.user.name}_${application?.user.studentNumber}_CV.pdf`;
      } else if (type === "portfolio") {
        supabaseFilePath = application?.portfolioLink || null;
        fileName = `${application?.user.name}_${application?.user.studentNumber}_Portfolio.pdf`;
      } else {
        return NextResponse.json(
          { error: "Invalid type for committee application" },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid application type" },
        { status: 400 },
      );
    }

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 },
      );
    }

    if (!supabaseFilePath) {
      return NextResponse.json(
        { error: "File not found for this application" },
        { status: 404 },
      );
    }

    try {
      let bucketName: string;
      let filePath: string;

      // Check if supabaseFilePath is a full URL or just a path
      if (supabaseFilePath.startsWith("http")) {
        // It's a full URL, extract bucket and file path (handle both public and signed URLs)
        const urlMatch = supabaseFilePath.match(
          /\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+?)(?:\?|$)/,
        );

        if (urlMatch) {
          bucketName = urlMatch[1];
          filePath = urlMatch[2];
        } else {
          return NextResponse.json(
            { error: "Invalid file URL format" },
            { status: 400 },
          );
        }
      } else {
        // It's just a file path, determine bucket based on application type
        bucketName =
          applicationType === "ea"
            ? "ea-applications"
            : "committee-applications";
        filePath = supabaseFilePath;
      }

      // Download the file from Supabase
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) {
        console.error("Supabase download error:", error);
        return NextResponse.json(
          { error: "Failed to download file from storage" },
          { status: 500 },
        );
      }

      if (!data) {
        return NextResponse.json(
          { error: "File not found in storage" },
          { status: 404 },
        );
      }

      // Convert blob to array buffer
      const arrayBuffer = await data.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Return the file with download headers
      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length": arrayBuffer.byteLength.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    } catch (supabaseError) {
      console.error("Supabase storage error:", supabaseError);
      return NextResponse.json(
        { error: "Failed to access file" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error downloading PDF file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
