// src/app/api/files/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { supabase } from "@/lib/supabase";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      console.error("Unauthorized: No session or email");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the form data
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const studentNumber = formData.get("studentNumber") as string;
    const fileType = formData.get("fileType") as string;
    const applicationType = formData.get("applicationType") as string; // 'executive-associate' or 'committee'

    if (!file || !studentNumber || !fileType || !applicationType) {
      console.error("Missing required fields:", {
        file: !!file,
        studentNumber: !!studentNumber,
        fileType: !!fileType,
        applicationType: !!applicationType,
      });
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(studentNumber)) {
      return NextResponse.json(
        { error: "Student number must be 10 digits" },
        { status: 400 },
      );
    }

    if (!["cv", "portfolio"].includes(fileType)) {
      return NextResponse.json(
        { error: "Invalid file type field" },
        { status: 400 },
      );
    }

    if (!["executive-associate", "committee"].includes(applicationType)) {
      return NextResponse.json(
        { error: "Invalid application type" },
        { status: 400 },
      );
    }

    if (applicationType === "executive-associate" && fileType !== "cv") {
      return NextResponse.json(
        { error: "EA applications only support CV uploads" },
        { status: 400 },
      );
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      console.error("Invalid file type:", file.type);
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 },
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error("File too large:", file.size);
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 },
      );
    }

    // Check if user exists by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, studentNumber: true, section: true },
    });

    if (!user) {
      console.error("User not found for email:", session.user.email);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.studentNumber && user.studentNumber !== studentNumber) {
      console.error("Student number mismatch:", {
        dbStudentNumber: user.studentNumber,
        formStudentNumber: studentNumber,
      });
      return NextResponse.json(
        { error: "Student number does not match your account" },
        { status: 400 },
      );
    }

    // Determine the bucket and application type
    const bucketName =
      applicationType === "executive-associate"
        ? "ea-applications"
        : "committee-applications";

    // Generate unique file name
    const timestamp = Date.now();
    const fileName = `${studentNumber}_${fileType}_${timestamp}.pdf`;
    const filePath = `applications/${studentNumber}/${fileName}`;

    // Convert File to ArrayBuffer for Supabase upload
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Upload file to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, uint8Array, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file to storage" },
        { status: 500 },
      );
    }

    // File attach only stages the upload in storage.
    // Application records are created/updated only on final form submission.

    return NextResponse.json({
      success: true,
      filePath: filePath,
      bucketName,
      message: "File uploaded successfully",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
