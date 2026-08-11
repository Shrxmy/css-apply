#!/usr/bin/env node

/**
 * CSS Group and Payment Email Campaign Script
 *
 * This script sends emails to accepted applicants:
 * 1. Payment Reminder (for accepted unpaid users)
 * 2. CSS Group Invitation (for accepted paid users, checking super admin config)
 */

const { PrismaClient } = require("@prisma/client");
const brevo = require("@getbrevo/brevo");

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || "",
);

// Helper function to truncate user ID to last 7 characters
const truncateToLast7 = (userId) => {
  if (!userId) return "UNKNOWN";
  return userId.slice(-7);
};

// Fetch dynamic payment QR path or return fallback
const getPaymentQrUrl = async () => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: "payment_qr_image_path" },
    });
    if (config && config.value && process.env.NEXTAUTH_URL) {
      return `${process.env.NEXTAUTH_URL}/api/payment-qr/image?v=${encodeURIComponent(config.value)}`;
    }
  } catch (error) {
    console.error("⚠️ Error fetching dynamic payment QR:", error);
  }
  // Fallback to static image
  return "https://itvimtcxzsubgcbnknvq.supabase.co/storage/v1/object/sign/payment/CSSPayment-Cropped.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zZDI2NmE0Mi02NGNmLTQzZjItOTE5Mi00OTk1MmViZDMxY2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYXltZW50L0NTU1BheW1lbnQtQ3JvcHBlZC5qcGciLCJpYXQiOjE3NTk1ODE4MjksImV4cCI6MTc5MTExNzgyOX0.SVFyO2WgwnA0pasjevIYWNESH6udyOLJiivdGob-FP4";
};

// Fetch dynamic community group config or return fallbacks
const getCommunityGroupConfig = async () => {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ["community_group_url", "community_group_label", "community_group_enabled"],
        },
      },
    });

    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    return {
      enabled: configMap.get("community_group_enabled") !== "false",
      url: configMap.get("community_group_url")?.trim() || "https://www.facebook.com/groups/1509464253581308",
      label: configMap.get("community_group_label")?.trim() || "Join UST CSS Members 25'-26' Group",
    };
  } catch (error) {
    console.error("⚠️ Error fetching community group config:", error);
    return {
      enabled: true,
      url: "https://www.facebook.com/groups/1509464253581308",
      label: "Join UST CSS Members 25'-26' Group",
    };
  }
};

// Reusable standard email layout wrapper with premium CSS theme
const wrapScriptEmail = (title, innerHtml) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Poppins:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f3f3fd;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .email-card {
      background-color: #ffffff;
      border-radius: 12px;
      border: 1px solid rgba(0, 95, 217, 0.1);
      padding: 30px;
    }
    .header-logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .header-logo img {
      height: 38px;
      width: auto;
    }
    h1, h2, h3, h4 {
      font-family: 'Poppins', 'Inter', sans-serif;
      color: #134687;
      margin-top: 0;
    }
    p {
      color: #4b5563;
      line-height: 1.6;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
    }
    .footer-text {
      color: #6b7280;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .footer-contact {
      color: #044FAF;
      text-decoration: none;
      font-weight: 500;
    }
    .button {
      display: inline-block;
      background-color: #134687;
      color: #ffffff !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 500;
      margin: 10px 0;
      font-family: 'Inter', sans-serif;
    }
    .button:hover {
      background-color: #044FAF;
    }
    .info-box {
      background-color: #f3f4f6;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info-box h3 {
      margin-top: 0;
      font-size: 16px;
      color: #134687;
    }
    .info-box p {
      margin: 8px 0;
    }
    .accent-box {
      background-color: #E8F2FF;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .accent-box h3 {
      margin-top: 0;
      font-size: 16px;
      color: #134687;
    }
    .accent-box p {
      color: #134687;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header-logo">
      <img src="https://odjmlznlgvuslhceobtz.supabase.co/storage/v1/object/public/css-apply-static-images/assets/logos/Logo_CSS%20Apply.svg" alt="CSSApply Logo" />
    </div>
    <div class="email-card">
      ${title ? `<h2 style="color: #134687; font-size: 22px; margin-top: 0; margin-bottom: 20px;">${title}</h2>` : ""}
      ${innerHtml}
    </div>
    <div class="footer">
      <p class="footer-text">
        If you encounter any issues, please contact us at <a href="mailto:css.cics@ust.edu.ph" class="footer-contact">css.cics@ust.edu.ph</a>.
      </p>
      <p class="footer-text" style="margin-top: 15px;">
        Best regards,<br>
        <strong style="color: #134687;">CSSApply Team</strong>
      </p>
    </div>
  </div>
</body>
</html>
`;

// Payment Reminder Email Template
const createPaymentReminderTemplate = (userName) => {
  return wrapScriptEmail(
    "CSS Membership Payment Reminder",
    `
    <p>Dear ${userName},</p>
    <p>We hope this message finds you well. This is a friendly reminder to complete your CSS membership payment.</p>
    
    <div class="accent-box" style="background-color: #E8F2FF;">
      <h3 style="margin-top: 0; color: #134687;">Payment Instructions</h3>
      <p style="color: #134687;">To complete your membership, please log in to the CSSApply recruitment portal to view the GCash QR code, download the acknowledgement receipt, and submit your payment proof.</p>
    </div>
    
    <div style="text-align: center; margin: 25px 0;">
      <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
        Log In to CSSApply
      </a>
    </div>
    
    <p>After paying, please upload your receipt proof to your UST Google Drive, generate a shareable link, and submit it on your application dashboard page to claim your permanent Member ID.</p>
    <p>Thank you for being part of the CSS community.</p>
    `
  );
};

// CSS Group Invitation Email Template
const createCssGroupInvitationTemplate = (userName, groupUrl, groupLabel) => {
  return wrapScriptEmail(
    "Join the CSS Community Group",
    `
    <p>Dear ${userName},</p>
    <p>Congratulations. We have verified your membership payment. You are now officially a member of the Computer Science Society.</p>
    <p>As a next step, we would like to invite you to join our official community group where we post updates, events, and announcements.</p>
    
    <div class="info-box" style="text-align: center; background-color: #f3f3fd; border: 1px solid rgba(0, 95, 217, 0.08);">
      <h3 style="margin-top: 0; color: #134687;">CSS Community Group</h3>
      <p style="margin-bottom: 20px;">Click the button below to join the official CSS group:</p>
      <div style="text-align: center;">
        <a href="${groupUrl}" target="_blank" class="button">
          ${groupLabel}
        </a>
      </div>
      <p style="margin-top: 15px; font-size: 13px; color: #6b7280; font-style: italic;">
        Please make sure to answer the membership questions when requesting to join.
      </p>
    </div>
    
    <p>Welcome once again, and we look forward to seeing you in the group and at our upcoming activities.</p>
    `
  );
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = {
      name: "CSSApply",
      email: process.env.BREVO_FROM_EMAIL || "noreply@cssapply.com",
    };
    sendSmtpEmail.to = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    return { success: true, messageId: result.body?.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return { success: false, error: error };
  }
};

// Get the active recruitment cycle ID
const getActiveCycleId = async () => {
  const activeCycle = await prisma.recruitmentCycle.findFirst({
    where: { isActive: true },
    select: { id: true }
  });
  return activeCycle ? activeCycle.id : null;
};

// Get all unpaid accepted applicants
const getUnpaidUsers = async () => {
  console.log("🔍 Fetching accepted unpaid users...");
  const cycleId = await getActiveCycleId();
  if (!cycleId) {
    console.log("⚠️ No active recruitment cycle found!");
    return [];
  }

  const members = await prisma.memberApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      paymentProof: "",
    },
    include: { user: true },
  });

  const eas = await prisma.eAApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      OR: [
        { paymentProof: null },
        { paymentProof: "" }
      ]
    },
    include: { user: true },
  });

  const staffs = await prisma.committeeApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      OR: [
        { paymentProof: null },
        { paymentProof: "" }
      ]
    },
    include: { user: true },
  });

  const allUnpaid = [];
  const emails = new Set();

  for (const app of [...members, ...eas, ...staffs]) {
    if (app.user && !emails.has(app.user.email)) {
      emails.add(app.user.email);
      allUnpaid.push({
        id: app.user.id,
        name: app.user.name,
        email: app.user.email,
        studentNumber: app.studentNumber || app.user.studentNumber,
      });
    }
  }

  console.log(`📊 Found ${allUnpaid.length} unique unpaid users:`);
  console.log(`   - Unpaid Members: ${members.length}`);
  console.log(`   - Unpaid EAs: ${eas.length}`);
  console.log(`   - Unpaid Staffs: ${staffs.length}`);

  return allUnpaid;
};

// Get all paid accepted applicants
const getPaidUsers = async () => {
  console.log("🔍 Fetching accepted paid users...");
  const cycleId = await getActiveCycleId();
  if (!cycleId) {
    console.log("⚠️ No active recruitment cycle found!");
    return [];
  }

  const members = await prisma.memberApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      paymentProof: { not: "" },
    },
    include: { user: true },
  });

  const eas = await prisma.eAApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      paymentProof: { notIn: [null, ""] },
    },
    include: { user: true },
  });

  const staffs = await prisma.committeeApplication.findMany({
    where: {
      hasAccepted: true,
      recruitmentCycleId: cycleId,
      paymentProof: { notIn: [null, ""] },
    },
    include: { user: true },
  });

  const allPaid = [];
  const emails = new Set();

  for (const app of [...members, ...eas, ...staffs]) {
    if (app.user && !emails.has(app.user.email)) {
      emails.add(app.user.email);
      allPaid.push({
        id: app.user.id,
        name: app.user.name,
        email: app.user.email,
        studentNumber: app.studentNumber || app.user.studentNumber,
      });
    }
  }

  console.log(`📊 Found ${allPaid.length} unique paid users:`);
  console.log(`   - Paid Members: ${members.length}`);
  console.log(`   - Paid EAs: ${eas.length}`);
  console.log(`   - Paid Staffs: ${staffs.length}`);

  return allPaid;
};

// Execute Payment Reminder Email Campaign
const runPaymentReminderCampaign = async () => {
  console.log("\n🚀 Starting Payment Reminder Campaign...");
  const targetUsers = await getUnpaidUsers();
  if (targetUsers.length === 0) {
    console.log("⚠️ No unpaid target users found. Campaign skipped.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  for (const user of targetUsers) {
    try {
      const html = createPaymentReminderTemplate(
        user.name || "Valued Member"
      );
      const result = await sendEmail(user.email, "CSS Group Payment Reminder", html);

      if (result.success) {
        successCount++;
        console.log(`   ✅ Sent to ${user.name} (${user.email})`);
      } else {
        failureCount++;
        failures.push({ user: user.name, email: user.email, error: result.error });
        console.log(`   ❌ Failed to send to ${user.name} (${user.email})`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      failureCount++;
      failures.push({ user: user.name, email: user.email, error: error.message });
      console.error(`   ❌ Error processing ${user.name} (${user.email}):`, error);
    }
  }

  console.log("\n📊 Payment Reminder Campaign Summary:");
  console.log(`✅ Successfully sent: ${successCount}`);
  console.log(`❌ Failed to send: ${failureCount}`);
  if (failures.length > 0) {
    console.log("❌ Failures detail:");
    failures.forEach((f) => console.log(`   - ${f.user} (${f.email}): ${f.error}`));
  }
};

// Execute CSS Group Invitation Email Campaign
const runCssGroupInvitationCampaign = async () => {
  console.log("\n🚀 Starting CSS Group Invitation Campaign...");
  const groupConfig = await getCommunityGroupConfig();

  if (!groupConfig.enabled) {
    console.log("⚠️ CSS Group Invitation is currently DISABLED in super admin settings. Campaign aborted.");
    return;
  }

  console.log(`🔗 Target FB Group URL: ${groupConfig.url}`);
  console.log(`🏷️ Button Label: ${groupConfig.label}`);

  const targetUsers = await getPaidUsers();
  if (targetUsers.length === 0) {
    console.log("⚠️ No paid target users found. Campaign skipped.");
    return;
  }

  let successCount = 0;
  let failureCount = 0;
  const failures = [];

  for (const user of targetUsers) {
    try {
      const html = createCssGroupInvitationTemplate(
        user.name || "Valued Member",
        groupConfig.url,
        groupConfig.label
      );
      const result = await sendEmail(user.email, "Join the CSS Community Group", html);

      if (result.success) {
        successCount++;
        console.log(`   ✅ Sent to ${user.name} (${user.email})`);
      } else {
        failureCount++;
        failures.push({ user: user.name, email: user.email, error: result.error });
        console.log(`   ❌ Failed to send to ${user.name} (${user.email})`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      failureCount++;
      failures.push({ user: user.name, email: user.email, error: error.message });
      console.error(`   ❌ Error processing ${user.name} (${user.email}):`, error);
    }
  }

  console.log("\n📊 CSS Group Invitation Campaign Summary:");
  console.log(`✅ Successfully sent: ${successCount}`);
  console.log(`❌ Failed to send: ${failureCount}`);
  if (failures.length > 0) {
    console.log("❌ Failures detail:");
    failures.forEach((f) => console.log(`   - ${f.user} (${f.email}): ${f.error}`));
  }
};

// Send single test email
const sendTestEmail = async (email, type) => {
  console.log(`\n🧪 Sending test ${type} to ${email}...`);
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    const testId = user ? user.id : "test_user_id";
    const testName = user ? user.name : "Test Recipient";

    let subject, html;
    if (type === "payment_reminder") {
      subject = "CSS Group Payment Reminder [TEST]";
      html = createPaymentReminderTemplate(testName);
    } else {
      const groupConfig = await getCommunityGroupConfig();
      subject = "CSS Community Group Invitation [TEST]";
      html = createCssGroupInvitationTemplate(testName, groupConfig.url, groupConfig.label);
    }

    const result = await sendEmail(email, subject, html);
    if (result.success) {
      console.log(`✅ Test email sent successfully to ${email} (Msg ID: ${result.messageId})`);
    } else {
      console.log(`❌ Failed to send test email: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ Test email failed:", error);
  }
};

// Check environment variables
const checkEnvironment = () => {
  const requiredEnvVars = ["BREVO_API_KEY", "BREVO_FROM_EMAIL", "DATABASE_URL"];
  const missing = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((envVar) => console.error(`   - ${envVar}`));
    console.error("\nPlease set these environment variables and try again.");
    process.exit(1);
  }

  console.log("✅ Environment variables validated");
};

// Interactive menu options
const promptUser = () => {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📧 Email Campaign Campaigns & Options:");
    console.log("1 - Run Payment Reminders campaign (unpaid users)");
    console.log("2 - Run CSS Group Invitations campaign (paid users)");
    console.log("3 - Send TEST Payment Reminder to joevannipaulo.gumban.cics@ust.edu.ph");
    console.log("4 - Send TEST CSS Group Invitation to joevannipaulo.gumban.cics@ust.edu.ph");
    console.log("5 - Send TEST Payment Reminder to custom email address");
    console.log("6 - Send TEST CSS Group Invitation to custom email address");
    console.log("7 - Exit");

    rl.question("\nPlease select an option (1-7): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

const promptCustomEmail = () => {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter email address: ", (email) => {
      rl.close();
      resolve(email.trim());
    });
  });
};

const main = async () => {
  console.log("🎯 CSS Recruitment Campaigns Manager");
  console.log("====================================\n");

  checkEnvironment();

  const choice = await promptUser();

  switch (choice) {
    case "1":
      await runPaymentReminderCampaign();
      break;

    case "2":
      await runCssGroupInvitationCampaign();
      break;

    case "3":
      await sendTestEmail("joevannipaulo.gumban.cics@ust.edu.ph", "payment_reminder");
      break;

    case "4":
      await sendTestEmail("joevannipaulo.gumban.cics@ust.edu.ph", "css_group_join");
      break;

    case "5":
      const emailReminder = await promptCustomEmail();
      if (emailReminder) {
        await sendTestEmail(emailReminder, "payment_reminder");
      } else {
        console.log("❌ No email address provided");
      }
      break;

    case "6":
      const emailInvitation = await promptCustomEmail();
      if (emailInvitation) {
        await sendTestEmail(emailInvitation, "css_group_join");
      } else {
        console.log("❌ No email address provided");
      }
      break;

    case "7":
      console.log("👋 Goodbye!");
      break;

    default:
      console.log("❌ Invalid option.");
      break;
  }

  await prisma.$disconnect();
  process.exit(0);
};

// Handle script termination
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Run script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

module.exports = {
  getUnpaidUsers,
  getPaidUsers,
  createPaymentReminderTemplate,
  createCssGroupInvitationTemplate,
  sendEmail,
};
