import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withEmailCampaignAdmin,
  readCampaignRequest,
} from "@/lib/email-campaign-api";
import { sendEmailCampaign } from "@/lib/email-campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const idSchema = z.string().min(1).max(100);
const sendSchema = z.object({ confirmed: z.literal(true) }).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withEmailCampaignAdmin(async () => {
    sendSchema.parse(await readCampaignRequest(request));
    const { id } = await context.params;
    return { campaign: await sendEmailCampaign(idSchema.parse(id)) };
  });
}
