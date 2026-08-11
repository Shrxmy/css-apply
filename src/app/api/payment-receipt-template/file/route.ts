import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabase } from "@/lib/supabase";

const CONFIG_KEY = "payment_receipt_template_path";
const BUCKET_NAME = "payment";

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { key: CONFIG_KEY } });
    if (!config?.value) return NextResponse.json({ error: "Template not configured" }, { status: 404 });

    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(config.value);
    if (error || !data) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="payment-acknowledgement-receipt.pdf"',
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Payment receipt template file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
