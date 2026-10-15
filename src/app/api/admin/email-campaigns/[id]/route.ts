import { z } from "zod";
import { withEmailCampaignAdmin } from "@/lib/email-campaign-api";
import { getEmailCampaign } from "@/lib/email-campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const idSchema = z.string().min(1).max(100);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withEmailCampaignAdmin(async () => {
    const { id } = await context.params;
    return { campaign: await getEmailCampaign(idSchema.parse(id)) };
  });
}
