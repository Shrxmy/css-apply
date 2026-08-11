import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const CONFIG_KEY = "payment_qr_image_path";
const BUCKET_NAME = "payment";

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    return NextResponse.json({
      url: config?.value
        ? `/api/payment-qr/image?v=${encodeURIComponent(config.value)}`
        : "",
    });
  } catch (error) {
    console.error("Get admin payment QR error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isSuperAdmin(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "QR image is required" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 },
      );
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Image size must be less than 5MB" },
        { status: 400 },
      );
    }

    const extension = file.name.split(".").pop() || "png";
    const filePath = `payment/payment-qr-${Date.now()}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, new Uint8Array(arrayBuffer), {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Payment QR upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload QR image" },
        { status: 500 },
      );
    }

    await prisma.systemConfig.upsert({
      where: { key: CONFIG_KEY },
      update: { value: filePath },
      create: {
        key: CONFIG_KEY,
        value: filePath,
        description: "Supabase storage path for payment QR image",
      },
    });

    return NextResponse.json({
      url: `/api/payment-qr/image?v=${encodeURIComponent(filePath)}`,
    });
  } catch (error) {
    console.error("Update payment QR error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
