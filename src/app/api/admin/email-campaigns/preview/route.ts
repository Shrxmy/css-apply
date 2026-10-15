import { NextRequest } from "next/server";
import { z } from "zod";
import {
  withEmailCampaignAdmin,
  readCampaignRequest,
} from "@/lib/email-campaign-api";
import {
  buildCampaignEmail,
  campaignContentSchema,
} from "@/lib/email-campaign-content";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const previewSchema = z.object({ content: campaignContentSchema }).strict();

export async function POST(request: NextRequest) {
  return withEmailCampaignAdmin(async () => {
    const { content } = previewSchema.parse(await readCampaignRequest(request));
    return buildCampaignEmail(content);
  });
}
