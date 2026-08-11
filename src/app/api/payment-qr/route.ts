import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAYMENT_QR_IMAGE_URL } from "@/lib/payment-config";

const CONFIG_KEY = "payment_qr_image_path";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: CONFIG_KEY },
    });

    return NextResponse.json({
      url: config?.value?.trim()
        ? `/api/payment-qr/image?v=${encodeURIComponent(config.value)}`
        : PAYMENT_QR_IMAGE_URL || "",
    });
  } catch (error) {
    console.error("Get payment QR error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
