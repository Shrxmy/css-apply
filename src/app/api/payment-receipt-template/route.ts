import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONFIG_KEY = "payment_receipt_template_path";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    return NextResponse.json({ url: config?.value ? `/api/payment-receipt-template/file?v=${encodeURIComponent(config.value)}` : "" });
  } catch (error) {
    console.error("Get payment receipt template error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
