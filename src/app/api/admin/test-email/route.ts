import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendEmail, emailTemplates } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { templateType } = await request.json();

    const recipientEmail = session.user.email;
    const testName = session.user.name || "Super Admin";

    let subject: string;
    let html: string;

    switch (templateType) {
      case "member_application":
        const memberTemplate = emailTemplates.memberApplication(
          testName,
          "2024XXXX",
        );
        subject = memberTemplate.subject;
        html = memberTemplate.html;
        break;

      case "committee_application":
        const committeeTemplate = emailTemplates.committeeApplication(
          testName,
          "2024XXXX",
          "academics",
          "creatives",
        );
        subject = committeeTemplate.subject;
        html = committeeTemplate.html;
        break;

      case "executive_associate_application":
        const eaTemplate = emailTemplates.executiveAssistantApplication(
          testName,
          "2024XXXX",
          "President",
          "Vice President",
          "Secretary",
        );
        subject = eaTemplate.subject;
        html = eaTemplate.html;
        break;

      case "member_accepted":
        const memberAcceptedTemplate = emailTemplates.memberAccepted(
          testName,
          "test123",
        );
        subject = memberAcceptedTemplate.subject;
        html = memberAcceptedTemplate.html;
        break;

      case "committee_accepted":
        const committeeAcceptedTemplate = emailTemplates.committeeAccepted(
          testName,
          "test123",
          "academics",
        );
        subject = committeeAcceptedTemplate.subject;
        html = committeeAcceptedTemplate.html;
        break;

      case "executive_associate_accepted":
        const eaAcceptedTemplate = emailTemplates.executiveAssistantAccepted(
          testName,
          "test123",
          "President",
        );
        subject = eaAcceptedTemplate.subject;
        html = eaAcceptedTemplate.html;
        break;

      case "committee_rejected":
        const committeeRejectedTemplate = emailTemplates.committeeRejected(
          testName,
          "academics",
        );
        subject = committeeRejectedTemplate.subject;
        html = committeeRejectedTemplate.html;
        break;

      case "executive_associate_rejected":
        const eaRejectedTemplate = emailTemplates.executiveAssistantRejected(
          testName,
          "President",
        );
        subject = eaRejectedTemplate.subject;
        html = eaRejectedTemplate.html;
        break;

      case "committee_redirected":
        const committeeRedirectedTemplate = emailTemplates.committeeRedirected(
          testName,
          "test123",
          "creatives",
          "academics",
        );
        subject = committeeRedirectedTemplate.subject;
        html = committeeRedirectedTemplate.html;
        break;

      case "member_id_released":
        const memberIdReleasedTemplate = emailTemplates.memberIdReleased(
          testName,
          "TEST123"
        );
        subject = memberIdReleasedTemplate.subject;
        html = memberIdReleasedTemplate.html;
        break;

      case "payment_reminder":
        const paymentReminderTemplate = emailTemplates.paymentReminder(
          testName
        );
        subject = paymentReminderTemplate.subject;
        html = paymentReminderTemplate.html;
        break;

      case "css_group_join":
        const cssGroupJoinTemplate = emailTemplates.cssGroupJoin(
          testName,
          "https://fb.me/g/6UCY6FrzU/L7r94Zcj",
          "Join UST CSS Members 25'-26' Group"
        );
        subject = cssGroupJoinTemplate.subject;
        html = cssGroupJoinTemplate.html;
        break;

      default:
        return NextResponse.json(
          { error: "Invalid template type" },
          { status: 400 },
        );
    }

    const result = await sendEmail(recipientEmail, subject, html);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${recipientEmail}`,
        messageId: result.messageId,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to send email", details: result.error },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Test email error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}