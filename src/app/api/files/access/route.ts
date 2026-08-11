import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

// GET file access for authenticated users (their own files)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileType = searchParams.get("fileType"); // 'cv' or 'portfolio'
    const applicationType = searchParams.get("applicationType"); // 'executive-associate' or 'committee'

    if (!fileType || !applicationType) {
      return NextResponse.json(
        { error: "Missing fileType or applicationType parameter" },
        { status: 400 },
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        studentNumber: true,
        name: true,
      },
    });

    if (!user || !user.studentNumber) {
      return NextResponse.json(
        { error: "User not found or student number not set" },
        { status: 404 },
      );
    }

    let application;
    let supabaseFilePath: string | null = null;

    if (applicationType === "executive-associate") {
      application = await prisma.executiveAssociateApplication.findFirst({
        where: { studentNumber: user.studentNumber },
        select: {
          supabaseFilePath: true,
          cv: true,
        },
      });
      supabaseFilePath = application?.supabaseFilePath || null;
    } else if (applicationType === "committee") {
      application = await prisma.committeeApplication.findFirst({
        where: { studentNumber: user.studentNumber },
        select: {
          supabaseFilePath: true,
          cv: true,
          portfolioLink: true,
        },
      });

      if (fileType === "cv") {
        supabaseFilePath = application?.supabaseFilePath || null;
      } else if (fileType === "portfolio") {
        supabaseFilePath = application?.portfolioLink || null;
      }
    } else {
      return NextResponse.json(
        {
          error:
            "Invalid applicationType parameter. Must be 'executive-associate' or 'committee'",
        },
        { status: 400 },
      );
    }

    if (!application || !supabaseFilePath) {
      return NextResponse.json(
        { error: "File not found for this application" },
        { status: 404 },
      );
    }

    try {
      // Check if supabaseFilePath is a full URL or just a path
      if (supabaseFilePath.startsWith("http")) {
        // It's a full URL, extract bucket and file path (handle both public and signed URLs)
        const urlMatch = supabaseFilePath.match(
          /\/storage\/v1\/object\/(?:public|sign)\/([^\/]+)\/(.+?)(?:\?|$)/,
        );

        if (urlMatch) {
          const bucketName = urlMatch[1];
          const filePath = urlMatch[2];

          // Generate a signed URL for secure access (24 hours expiration)
          const { data, error } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 86400);

          if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json(
              { error: "Failed to generate access link" },
              { status: 500 },
            );
          }

          return NextResponse.json({
            success: true,
            accessUrl: data.signedUrl,
            fileName: `${user.name}_${user.studentNumber}_${fileType.toUpperCase()}.pdf`,
            expiresIn: 86400,
          });
        } else {
          // If we can't parse the URL, return the original URL
          return NextResponse.json({
            success: true,
            accessUrl: supabaseFilePath,
            fileName: `${user.name}_${user.studentNumber}_${fileType.toUpperCase()}.pdf`,
            expiresIn: 86400,
          });
        }
      } else {
        // It's just a file path, use the bucket name
        const bucketName =
          applicationType === "executive-associate"
            ? "executive-associate-applications"
            : "committee-applications";

        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(supabaseFilePath, 86400);

        if (error) {
          console.error("Supabase error:", error);
          return NextResponse.json(
            { error: "Failed to generate access link" },
            { status: 500 },
          );
        }

        return NextResponse.json({
          success: true,
          accessUrl: data.signedUrl,
          fileName: `${user.name}_${user.studentNumber}_${fileType.toUpperCase()}.pdf`,
          expiresIn: 86400,
        });
      }
    } catch (supabaseError) {
      console.error("Supabase storage error:", supabaseError);
      return NextResponse.json(
        { error: "Failed to access file" },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Error generating file access link:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
