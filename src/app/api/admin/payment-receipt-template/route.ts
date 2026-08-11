import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const CONFIG_KEY = "payment_receipt_template_path";
const BUCKET_NAME = "payment";

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const config = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
  return NextResponse.json({ url: config?.value ? `/api/payment-receipt-template/file?v=${encodeURIComponent(config.value)}` : "" });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isSuperAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "PDF is required" }, { status: 400 });
    if (file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "PDF must be less than 10MB" }, { status: 400 });

    const filePath = `payment/receipt-template-${Date.now()}.pdf`;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, buffer, {
      cacheControl: "3600",
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) {
      console.error("Receipt template upload error:", error);
      return NextResponse.json({ error: "Failed to upload receipt template" }, { status: 500 });
    }

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: filePath },
      create: { key: CONFIG_KEY, value: filePath, description: "Payment acknowledgement receipt PDF template" },
    });

    return NextResponse.json({ url: `/api/payment-receipt-template/file?v=${encodeURIComponent(filePath)}` });
  } catch (error) {
    console.error("Update receipt template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
