import { NextRequest } from "next/server";
import {
  withEmailCampaignAdmin,
  readCampaignRequest,
} from "@/lib/email-campaign-api";
import { createEmailCampaign, listEmailCampaigns } from "@/lib/email-campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return withEmailCampaignAdmin(async () => ({
    campaigns: await listEmailCampaigns(),
  }));
}

export async function POST(request: NextRequest) {
  return withEmailCampaignAdmin(
    async (actor) => ({
      campaign: await createEmailCampaign(
        await readCampaignRequest(request),
        actor,
      ),
    }),
    201,
  );
}
