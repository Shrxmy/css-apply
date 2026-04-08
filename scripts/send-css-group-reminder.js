#!/usr/bin/env node

/**
 * CSS Group Payment Reminder Email Script
 *
 * This script sends reminder emails to:
 * - Accepted member applicants
 * - Accepted EA applicants
 * - Accepted committee staff applicants
 * - Admin and staff users
 *
 * The email reminds them to pay the fee and join the CSS Group via Facebook.
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

// CSS Group Facebook link
const CSS_GROUP_LINK = "https://www.facebook.com/groups/1509464253581308";

// Helper function to truncate user ID to last 7 characters (matching email.ts)
const truncateToLast7 = (userId) => {
  if (!userId) return "UNKNOWN";
  return userId.slice(-7);
};

// Email template
const createReminderEmailTemplate = (userName, userId) => {
  return `
    <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
        <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
            <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
            <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
        </div>
        
        <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">CSS Group Payment Reminder</h2>
        
        <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
            Dear ${userName},
        </p>
        
        <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
            We hope this message finds you well! This is a friendly reminder about your CSS membership and joining our official CSS Group.
        </p>
        
        <div style="background-color: #dcfce7; border: 2px solid #16a34a; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #15803d; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 18px;">✅ Already Paid & Joined?</h3>
            <p style="margin: 0; color: #15803d; font-size: 16px;">
                If you have already completed your membership fee payment and joined our CSS Group, you can safely disregard this email.
            </p>
        </div>
        
        <!-- Payment Instructions Section -->
        <div style="background-color: #ffffff; border: 2px solid #f59e0b; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(245, 158, 11, 0.2);">
            <h3 style="color: #92400e; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">💳 Payment Instructions</h3>
            
            <p style="color: #92400e; line-height: 1.6; font-weight: bold; text-align: center; margin-bottom: 20px; font-size: 16px;">
                To complete your membership, please proceed with the payment of <strong style="color: #134687; font-size: 18px;">₱250.00</strong> using the GCash QR code below:
            </p>
            
            <div style="text-align: center; margin: 20px 0;">
                <img src="https://itvimtcxzsubgcbnknvq.supabase.co/storage/v1/object/sign/payment/CSSPayment-Cropped.jpg?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8zZDI2NmE0Mi02NGNmLTQzZjItOTE5Mi00OTk1MmViZDMxY2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwYXltZW50L0NTU1BheW1lbnQtQ3JvcHBlZC5qcGciLCJpYXQiOjE3NTk1ODE4MjksImV4cCI6MTc5MTExNzgyOX0.SVFyO2WgwnA0pasjevIYWNESH6udyOLJiivdGob-FP4" 
                     alt="GCash QR Code for CSS Payment" 
                     style="max-width: 300px; width: 100%; height: auto; border: 3px solid #134687; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
            </div>
            
            <div style="background-color: #ffffff; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 4px 8px rgba(220, 38, 38, 0.2);">
                <h4 style="color: #dc2626; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 18px;">⚠️ IMPORTANT PAYMENT MESSAGE</h4>
                <p style="color: #dc2626; line-height: 1.6; text-align: center; font-weight: bold; margin: 0; font-size: 16px;">
                    When sending your payment via GCash QR, you MUST include this message:
                </p>
                <div style="background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); border-radius: 8px; padding: 15px; margin: 15px 0; text-align: center; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                    <code style="color: white; font-weight: bold; font-size: 18px; font-family: 'Poppins', monospace;">Member ID: ${truncateToLast7(userId).toUpperCase()}</code>
                </div>
                <p style="color: #dc2626; line-height: 1.6; text-align: center; font-size: 14px; margin: 0;">
                    This message is required for payment verification and processing.
                </p>
            </div>
            
            <p style="color: #92400e; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px;">
                Please keep a screenshot of your payment confirmation for your records.
            </p>
        </div>
        
        <div style="background-color: #e0f2fe; border: 2px solid #0284c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0284c7; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 18px;">🔗 Join Our CSS Group</h3>
            <p style="margin: 5px 0; color: #0c4a6e;">After payment, join our official CSS Group on Facebook:</p>
            <div style="margin: 15px 0; text-align: center;">
                <a href="${CSS_GROUP_LINK}" target="_blank" style="display: inline-block; background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
                    Join CSS Group on Facebook
                </a>
            </div>
            <p style="margin: 10px 0 0 0; color: #0c4a6e; font-size: 14px;">
                <em>Stay connected with fellow CSS members and get the latest updates!</em>
            </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 18px;">💾 Save Payment Proof</h3>
            <p style="margin: 5px 0; color: #1f2937; font-size: 16px;">Important: Please save your payment proof in your UST Google Drive:</p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #1f2937;">
                <li style="margin: 5px 0;">Take a screenshot of your GCash payment confirmation</li>
                <li style="margin: 5px 0;">Upload it to your UST Google Drive</li>
                <li style="margin: 5px 0;">Name the file: "CSS_Membership_Payment_[YourName]_[Date]"</li>
                <li style="margin: 5px 0;">Keep it for your records and future reference</li>
            </ul>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #1f2937; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 18px;">📋 Complete Checklist</h3>
            <p style="margin: 5px 0; color: #1f2937;">As an accepted member of CSS, please ensure you have:</p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #1f2937;">
                <li style="margin: 5px 0;">✅ Paid the membership fee via GCash</li>
                <li style="margin: 5px 0;">✅ Saved payment proof in your UST Google Drive</li>
                <li style="margin: 5px 0;">✅ Joined our official CSS Group on Facebook</li>
                <li style="margin: 5px 0;">✅ Stay updated with all CSS activities and announcements</li>
            </ul>
        </div>
        
        <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
            If you have any questions or concerns, please don't hesitate to reach out to us.
        </p>
        
        <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
            Thank you for being part of the CSS community!
        </p>
        
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 14px;">
                Best regards,<br>
                CSSApply Team
            </p>
        </div>
    </div>
  `;
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.sender = {
      name: "CSS Apply",
      email: process.env.BREVO_FROM_EMAIL || "noreply@cssapply.com",
    };
    sendSmtpEmail.to = [{ email: to }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(
      `✅ Email sent successfully to ${to}: ${result.body?.messageId}`,
    );
    return { success: true, messageId: result.body?.messageId };
  } catch (error) {
    console.error(`❌ Error sending email to ${to}:`, error);
    return { success: false, error: error };
  }
};

// Get all target users (only accepted applications)
const getTargetUsers = async () => {
  console.log("🔍 Fetching target users (accepted applications only)...");

  try {
    // Get users with accepted member applications
    const acceptedMembers = await prisma.user.findMany({
      where: {
        memberApplication: {
          hasAccepted: true,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
      },
    });

    // Get users with accepted EA applications
    const acceptedEAs = await prisma.user.findMany({
      where: {
        eaApplication: {
          hasAccepted: true,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
      },
    });

    // Get users with accepted committee applications
    const acceptedCommitteeStaff = await prisma.user.findMany({
      where: {
        committeeApplication: {
          hasAccepted: true,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
      },
    });

    // Combine all users and remove duplicates
    const allUsers = [
      ...acceptedMembers,
      ...acceptedEAs,
      ...acceptedCommitteeStaff,
    ];

    // Remove duplicates based on email
    const uniqueUsers = allUsers.filter(
      (user, index, self) =>
        index === self.findIndex((u) => u.email === user.email),
    );

    console.log(`📊 Found ${uniqueUsers.length} unique target users:`);
    console.log(`   - Accepted Members: ${acceptedMembers.length}`);
    console.log(`   - Accepted EAs: ${acceptedEAs.length}`);
    console.log(
      `   - Accepted Committee Staff: ${acceptedCommitteeStaff.length}`,
    );

    return uniqueUsers;
  } catch (error) {
    console.error("❌ Error fetching target users:", error);
    throw error;
  }
};

// Main function to send reminder emails
const sendReminderEmails = async () => {
  console.log("🚀 Starting CSS Group payment reminder email campaign...");
  console.log(`📧 CSS Group Link: ${CSS_GROUP_LINK}`);

  try {
    // Get target users
    const targetUsers = await getTargetUsers();

    if (targetUsers.length === 0) {
      console.log("⚠️  No target users found. Exiting.");
      return;
    }

    // Email configuration
    const subject = "CSS Group Payment Reminder - Join Our Official Group";
    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    console.log(`📤 Sending emails to ${targetUsers.length} users...`);

    // Send emails to each user
    for (const user of targetUsers) {
      try {
        const html = createReminderEmailTemplate(
          user.name || "Valued Member",
          user.id,
        );
        const result = await sendEmail(user.email, subject, html);

        if (result.success) {
          successCount++;
          console.log(`✅ Sent to ${user.name} (${user.email})`);
        } else {
          failureCount++;
          failures.push({
            user: user.name,
            email: user.email,
            error: result.error,
          });
          console.log(`❌ Failed to send to ${user.name} (${user.email})`);
        }

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failureCount++;
        failures.push({
          user: user.name,
          email: user.email,
          error: error.message,
        });
        console.error(
          `❌ Error processing ${user.name} (${user.email}):`,
          error,
        );
      }
    }

    // Summary
    console.log("\n📊 Email Campaign Summary:");
    console.log(`✅ Successfully sent: ${successCount}`);
    console.log(`❌ Failed to send: ${failureCount}`);
    console.log(`📧 Total recipients: ${targetUsers.length}`);

    if (failures.length > 0) {
      console.log("\n❌ Failed emails:");
      failures.forEach((failure) => {
        console.log(
          `   - ${failure.user} (${failure.email}): ${failure.error}`,
        );
      });
    }

    console.log("\n🎉 CSS Group reminder email campaign completed!");
  } catch (error) {
    console.error("❌ Campaign failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
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

// Get specific user by email
const getSpecificUser = async (email) => {
  console.log(`🔍 Looking up user: ${email}`);

  try {
    const user = await prisma.user.findUnique({
      where: { email: email },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
        role: true,
        memberApplication: {
          select: { hasAccepted: true },
        },
        eaApplication: {
          select: { hasAccepted: true },
        },
        committeeApplication: {
          select: { hasAccepted: true },
        },
        ebProfile: {
          select: { position: true, isActive: true },
        },
      },
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return null;
    }

    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Student Number: ${user.studentNumber || "N/A"}`);
    console.log(
      `   - Member Application Accepted: ${user.memberApplication?.hasAccepted || false}`,
    );
    console.log(
      `   - EA Application Accepted: ${user.eaApplication?.hasAccepted || false}`,
    );
    console.log(
      `   - Committee Application Accepted: ${user.committeeApplication?.hasAccepted || false}`,
    );
    console.log(
      `   - EB Profile: ${user.ebProfile ? `${user.ebProfile.position} (Active: ${user.ebProfile.isActive})` : "None"}`,
    );

    return user;
  } catch (error) {
    console.error(`❌ Error looking up user ${email}:`, error);
    return null;
  }
};

// Send test email to specific user
const sendTestEmail = async (userEmail) => {
  console.log("🧪 Sending test email to specific user...");

  try {
    const user = await getSpecificUser(userEmail);

    if (!user) {
      console.log("❌ Cannot send test email - user not found");
      return;
    }

    const subject = "CSS Group Payment Reminder - TEST EMAIL";
    const html = createReminderEmailTemplate(
      user.name || "Valued Member",
      user.id,
    );

    console.log(`📤 Sending test email to ${user.name} (${user.email})...`);
    const result = await sendEmail(user.email, subject, html);

    if (result.success) {
      console.log(
        `✅ Test email sent successfully to ${user.name} (${user.email})`,
      );
      console.log(`📧 Message ID: ${result.messageId}`);
    } else {
      console.log(
        `❌ Failed to send test email to ${user.name} (${user.email})`,
      );
      console.log(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ Test email failed:", error);
  } finally {
    await prisma.$disconnect();
  }
};

// Interactive prompt function
const promptUser = () => {
  return new Promise((resolve) => {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📧 Email Campaign Options:");
    console.log("1 - Send to ALL target users");
    console.log("2 - Send TEST email to joevannipaulo.gumban.cics@ust.edu.ph");
    console.log("3 - Send TEST email to custom email address");
    console.log("4 - Exit");

    rl.question("\nPlease select an option (1-4): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// Custom email prompt
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

// Main execution
const main = async () => {
  console.log("🎯 CSS Group Payment Reminder Email Script");
  console.log("==========================================\n");

  // Check environment
  checkEnvironment();

  // Interactive menu
  const choice = await promptUser();

  switch (choice) {
    case "1":
      console.log("\n🚀 Sending to ALL target users...");
      await sendReminderEmails();
      break;

    case "2":
      console.log("\n🧪 Sending TEST email to specified user...");
      await sendTestEmail("joevannipaulo.gumban.cics@ust.edu.ph");
      break;

    case "3":
      const customEmail = await promptCustomEmail();
      if (customEmail) {
        console.log(`\n🧪 Sending TEST email to: ${customEmail}`);
        await sendTestEmail(customEmail);
      } else {
        console.log("❌ No email address provided");
        process.exit(1);
      }
      break;

    case "4":
      console.log("👋 Goodbye!");
      await prisma.$disconnect();
      process.exit(0);
      break;

    default:
      console.log("❌ Invalid option. Please run the script again.");
      await prisma.$disconnect();
      process.exit(1);
  }
};

// Handle script termination
process.on("SIGINT", async () => {
  console.log("\n⚠️  Script interrupted. Cleaning up...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n⚠️  Script terminated. Cleaning up...");
  await prisma.$disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

module.exports = {
  sendReminderEmails,
  getTargetUsers,
  createReminderEmailTemplate,
  sendEmail,
};
