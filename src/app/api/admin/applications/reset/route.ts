import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";
import { APPLICATION_STORAGE_BUCKETS } from "@/lib/application-storage";

const applicationTypes = ["member", "committee", "executive-associate"] as const;
type ApplicationType = (typeof applicationTypes)[number];

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "super_admin") return NextResponse.json({ error: "Super Admin access required" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const applicationId = typeof body?.applicationId === "string" ? body.applicationId : "";
  const type = body?.type as ApplicationType;
  if (!applicationId || !applicationTypes.includes(type)) {
    return NextResponse.json({ error: "Application ID and type are required" }, { status: 400 });
  }

  let filePaths: string[] = [];
  let bucketName: string | null = null;
  if (type === "committee") {
    const application = await prisma.committeeApplication.findUnique({ where: { id: applicationId }, select: { supabaseFilePath: true, portfolioLink: true } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    filePaths = [application.supabaseFilePath, application.portfolioLink].filter((path): path is string => Boolean(path));
    bucketName = APPLICATION_STORAGE_BUCKETS.committee;
  } else if (type === "executive-associate") {
    const application = await prisma.executiveAssociateApplication.findUnique({ where: { id: applicationId }, select: { supabaseFilePath: true } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
    filePaths = application.supabaseFilePath ? [application.supabaseFilePath] : [];
    bucketName = APPLICATION_STORAGE_BUCKETS.executiveAssociate;
  } else {
    const application = await prisma.memberApplication.findUnique({ where: { id: applicationId }, select: { id: true } });
    if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (type === "member") await prisma.memberApplication.delete({ where: { id: applicationId } });
  if (type === "committee") await prisma.committeeApplication.delete({ where: { id: applicationId } });
  if (type === "executive-associate") await prisma.executiveAssociateApplication.delete({ where: { id: applicationId } });

  if (bucketName && filePaths.length) {
    const paths = filePaths.map((path) => path.replace(/^.*\/storage\/v1\/object\/[^/]+\//, "").replace(/^\//, ""));
    await supabase.storage.from(bucketName).remove(paths);
  }

  return NextResponse.json({ success: true });
}
