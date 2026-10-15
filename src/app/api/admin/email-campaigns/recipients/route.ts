import { withEmailCampaignAdmin } from "@/lib/email-campaign-api";
import { getEmailCampaignAudience } from "@/lib/email-campaign-recipients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withEmailCampaignAdmin(async () => getEmailCampaignAudience());
}
