import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import {
  buildEmailTemplateTest,
  getEmailTemplateTestOptions,
} from "@/lib/email-test-templates";

export const dynamic = "force-dynamic";

const testEmailSchema = z
  .object({ templateType: z.string().min(1).max(100) })
  .strict();
const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: noStoreHeaders });
}

function isSuperAdmin(role?: string) {
  return role === "super_admin" || role === "super-admin";
}

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return { response: json({ error: "Unauthorized" }, 401) };
  if (!isSuperAdmin(session.user.role)) {
    return { response: json({ error: "Forbidden" }, 403) };
  }
  return { session };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if ("response" in authorization) return authorization.response;

    return json({ templates: getEmailTemplateTestOptions() });
  } catch (error) {
    console.error("Load email test catalog failed", error);
    return json({ error: "Could not load email test templates." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await authorize();
    if ("response" in authorization) return authorization.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }

    const parsed = testEmailSchema.safeParse(body);
    if (!parsed.success)
      return json({ error: "Invalid email template type." }, 400);

    const option = getEmailTemplateTestOptions().find(
      (template) => template.value === parsed.data.templateType,
    );
    if (!option) return json({ error: "Invalid email template type." }, 400);

    let communityLabel = "CSS Community Group";
    if (parsed.data.templateType === "css_group_join") {
      try {
        const config = await prisma.systemConfig.findUnique({
          where: { key: "community_group_label" },
          select: { value: true },
        });
        communityLabel = config?.value.trim() || communityLabel;
      } catch (configError) {
        console.error(
          "Could not load community label for email test",
          configError,
        );
      }
    }

    const recipientEmail = authorization.session.user.email;
    const recipientName = authorization.session.user.name || "Super Admin";
    const template = buildEmailTemplateTest(
      parsed.data.templateType,
      recipientName,
      communityLabel,
    );
    if (!template) return json({ error: "Invalid email template type." }, 400);

    const result = await sendEmail(
      recipientEmail,
      template.subject,
      template.html,
    );
    if (!result.success) {
      return json(
        { error: "The email provider could not accept the test email." },
        502,
      );
    }

    return json({
      success: true,
      message: `Test email accepted for ${recipientEmail}`,
      template: option.label,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error(
      "Test email send failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json({ error: "Could not send the test email." }, 500);
  }
}
