import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { APPLICATION_STORAGE_BUCKETS } from "@/lib/application-storage";
import { createLogger } from "@/lib/logger";

const uploadLogger = createLogger("api/files/upload-url");
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const studentNumber = typeof body.studentNumber === "string" ? body.studentNumber : "";
    const fileType = typeof body.fileType === "string" ? body.fileType : "";
    const applicationType = typeof body.applicationType === "string" ? body.applicationType : "";
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0;

    if (!/^\d{10}$/.test(studentNumber) || !["cv", "portfolio"].includes(fileType) || !["executive-associate", "committee"].includes(applicationType)) {
      return NextResponse.json({ error: "Invalid upload details" }, { status: 400 });
    }
    if (applicationType === "executive-associate" && fileType !== "cv") {
      return NextResponse.json({ error: "EA applications only support CV uploads" }, { status: 400 });
    }
    if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must be 10MB or smaller" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { studentNumber: true },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.studentNumber && user.studentNumber !== studentNumber) {
      return NextResponse.json({ error: "Student number does not match your account" }, { status: 400 });
    }

    const bucketName = applicationType === "executive-associate"
      ? APPLICATION_STORAGE_BUCKETS.executiveAssociate
      : APPLICATION_STORAGE_BUCKETS.committee;
    const filePath = `applications/${studentNumber}/${studentNumber}_${fileType}_${crypto.randomUUID()}.pdf`;
    const { data, error } = await supabase.storage.from(bucketName).createSignedUploadUrl(filePath);
    if (error || !data?.token) {
      uploadLogger.error("signed upload URL creation failed", error, { bucketName, fileType });
      return NextResponse.json({ error: "Failed to prepare file upload" }, { status: 500 });
    }

    return NextResponse.json({ success: true, bucketName, filePath, token: data.token });
  } catch (error) {
    uploadLogger.error("signed upload URL request failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
