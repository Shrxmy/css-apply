import * as brevo from "@getbrevo/brevo";
import {
  getEBEmailWithFallback,
  ADMIN_EMAILS,
  validateAllEmailMappings,
} from "@/data/emailMappings";
import { truncateToLast7 } from "@/lib/truncate-utils";

// Initialize Brevo API client
const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY! || "",
);

export interface EmailTemplate {
  subject: string;
  html: string;
}

// Capitalize the first letter of each word in a string
const capitalizeWords = (input: string): string => {
  if (!input) return input;
  return input.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

// Map committee IDs to their proper full names
const getCommitteeFullName = (committeeId: string): string => {
  const committeeMap: { [key: string]: string } = {
    academics: "Academics Committee",
    community: "Community Development Committee",
    creatives: "Creatives & Technical Committee",
    documentation: "Documentation Committee",
    external: "External Affairs Committee",
    finance: "Finance Committee",
    logistics: "Logistics Committee",
    publicity: "Publicity Committee",
    sports: "Sports & Talent Committee",
    technology: "Technology Development Committee",
  };

  return (
    committeeMap[committeeId] || capitalizeWords(committeeId) + " Committee"
  );
};

export const sendEmail = async (to: string, subject: string, html: string) => {
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
    console.log("Email sent successfully:", result);
    // The Brevo API returns { response, body }, and the messageId is in body.messageId
    return { success: true, messageId: result.body?.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error };
  }
};

// Get EB email address by EB role ID with comprehensive error handling
export const getEBEmail = (ebRoleId: string, context?: string): string => {
  try {
    return getEBEmailWithFallback(ebRoleId, context);
  } catch (error) {
    console.error(`Failed to get email for role ID: ${ebRoleId}`, error);
    console.error(
      `CRITICAL: Email lookup failed for ${ebRoleId}. Using fallback email.`,
    );

    // For interview notifications, we need to ensure the email is sent
    // Use President's email as fallback but log this as a critical issue
    console.error(
      `FALLBACK: Using President's email for ${ebRoleId} due to lookup failure`,
    );
    return ADMIN_EMAILS.PRESIDENT;
  }
};

// Legacy function for backward compatibility - now uses new system
export const getEBEmailLegacy = (ebRoleId: string): string => {
  try {
    return getEBEmailWithFallback(ebRoleId, "legacy-compatibility");
  } catch {
    console.warn(
      `Legacy email lookup failed for ${ebRoleId}, using President as fallback`,
    );
    return ADMIN_EMAILS.PRESIDENT;
  }
};

// Validate all email mappings on startup
export const validateEmailMappings = (): boolean => {
  try {
    const validation = validateAllEmailMappings();
    if (!validation.valid) {
      console.error("Email mapping validation failed:", validation.errors);
      return false;
    }
    console.log("✅ All email mappings validated successfully");
    return true;
  } catch (error) {
    console.error("Error validating email mappings:", error);
    return false;
  }
};

// Enhanced email sending with better error handling
export const sendEmailWithValidation = async (
  to: string,
  subject: string,
  html: string,
  context?: string,
): Promise<{ success: boolean; messageId?: string; error?: unknown }> => {
  try {
    // Basic email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(to)) {
      throw new Error(`Invalid email address: ${to}`);
    }

    console.log(`Sending email to: ${to}${context ? ` (${context})` : ""}`);
    const result = await sendEmail(to, subject, html);

    if (result.success) {
      console.log(`✅ Email sent successfully to ${to}: ${result.messageId}`);
    } else {
      console.error(`❌ Failed to send email to ${to}:`, result.error);
    }

    return result;
  } catch (error) {
    console.error(`❌ Email sending failed for ${to}:`, error);
    return { success: false, error };
  }
};

// Email templates for different application types
export const emailTemplates = {
  memberApplication: (
    userName: string,
    studentNumber: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Member Application Received",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${userName}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for submitting your member application to CSSApply! We have successfully received your application.
                </p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1f2937; margin-top: 0;">Application Details:</h3>
                    <p style="margin: 5px 0;"><strong>Student Number:</strong> ${studentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Member</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
                </div>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Our team will review your application and get back to you soon. Please keep an eye on your email for updates.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    If you have any questions, feel free to reach out to us.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  committeeApplication: (
    userName: string,
    studentNumber: string,
    firstOption: string,
    secondOption: string,
    meetingLink?: string,
    interviewer?: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Committee Staff Application Received",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${userName}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for submitting your committee staff application to CSSApply! We have successfully received your application.
                </p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1f2937; margin-top: 0;">Application Details:</h3>
                    <p style="margin: 5px 0;"><strong>Student Number:</strong> ${studentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Committee Staff</p>
                    <p style="margin: 5px 0;"><strong>First Choice:</strong> ${getCommitteeFullName(firstOption)}</p>
                    <p style="margin: 5px 0;"><strong>Second Choice:</strong> ${getCommitteeFullName(secondOption)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
                </div>
                
                ${
                  meetingLink
                    ? `
                <div style="background-color: #e0f2fe; border: 2px solid #0284c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0284c7; margin-top: 0;">📅 Interview Information:</h3>
                    <p style="margin: 5px 0; color: #0c4a6e;"><strong>Interviewer:</strong> ${interviewer ? capitalizeWords(interviewer) : `${getCommitteeFullName(firstOption)} Head`}</p>
                    <p style="margin: 5px 0; color: #0c4a6e;"><strong>Meeting Link:</strong></p>
                    <div style="margin: 10px 0;">
                        <a href="${meetingLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Join Google Meet Interview
                        </a>
                    </div>
                    <p style="margin: 10px 0 0 0; color: #0c4a6e; font-size: 14px;">
                        <em>Please schedule your interview time through the application dashboard, then use this link to join your interview.</em>
                    </p>
                </div>
                `
                    : `
                <p style="color: #4b5563; line-height: 1.6;">
                    Please proceed to schedule your interview through the application dashboard. The meeting link will be provided once you select your interview time.
                </p>
                `
                }
                
                <p style="color: #4b5563; line-height: 1.6;">
                    If you have any questions, feel free to reach out to us.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantApplication: (
    userName: string,
    studentNumber: string,
    ebRole: string,
    firstOption: string,
    secondOption: string,
    meetingLink?: string,
    interviewer?: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Executive Assistant Application Received",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${userName}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for submitting your executive assistant application to CSSApply! We have successfully received your application.
                </p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #1f2937; margin-top: 0;">Application Details:</h3>
                    <p style="margin: 5px 0;"><strong>Student Number:</strong> ${studentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Executive Assistant</p>
                    <p style="margin: 5px 0;"><strong>EA Role:</strong> ${capitalizeWords(ebRole)}</p>
                    <p style="margin: 5px 0;"><strong>First Choice:</strong> ${capitalizeWords(firstOption)}</p>
                    <p style="margin: 5px 0;"><strong>Second Choice:</strong> ${capitalizeWords(secondOption)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> Under Review</p>
                </div>
                
                ${
                  meetingLink
                    ? `
                <div style="background-color: #e0f2fe; border: 2px solid #0284c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0284c7; margin-top: 0;">📅 Interview Information:</h3>
                    <p style="margin: 5px 0; color: #0c4a6e;"><strong>Interviewer:</strong> ${interviewer ? capitalizeWords(interviewer) : `${capitalizeWords(firstOption)} Executive Board Member`}</p>
                    <p style="margin: 5px 0; color: #0c4a6e;"><strong>Meeting Link:</strong></p>
                    <div style="margin: 10px 0;">
                        <a href="${meetingLink}" target="_blank" style="display: inline-block; background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                            Join Google Meet Interview
                        </a>
                    </div>
                    <p style="margin: 10px 0 0 0; color: #0c4a6e; font-size: 14px;">
                        <em>Please schedule your interview time through the application dashboard, then use this link to join your interview.</em>
                    </p>
                </div>
                `
                    : `
                <p style="color: #4b5563; line-height: 1.6;">
                    Please proceed to schedule your interview through the application dashboard. The meeting link will be provided once you select your interview time.
                </p>
                `
                }
                
                <p style="color: #4b5563; line-height: 1.6;">
                    If you have any questions, feel free to reach out to us.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  // Acceptance notification templates
  memberAccepted: (userName: string, userId: string): EmailTemplate => ({
    subject:
      "CSSApply - Congratulations! Your Member Application Has Been Accepted",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Congratulations ${userName}!</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We are thrilled to inform you that your member application has been <strong style="color: #134687;">ACCEPTED</strong>! 
                    Welcome to the Computer Science Society!
                </p>
                
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🎉 Acceptance Details:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Member</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #134687; font-weight: bold; background-color: #e0f2fe; padding: 4px 8px; border-radius: 6px;">ACCEPTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for future activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We look forward to seeing you at our upcoming events and activities. Welcome to the CSS family!
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  committeeAccepted: (
    userName: string,
    userId: string,
    committee: string,
  ): EmailTemplate => ({
    subject:
      "CSSApply - Congratulations! Your Committee Staff Application Has Been Accepted",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Congratulations ${userName}!</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We are thrilled to inform you that your committee staff application has been <strong style="color: #134687;">ACCEPTED</strong>! 
                    Welcome to the Computer Science Society Committee Staff!
                </p>
                
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🎉 Acceptance Details:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Committee Staff</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #134687; font-weight: bold; background-color: #e0f2fe; padding: 4px 8px; border-radius: 6px;">ACCEPTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for committee activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    As a member of the ${getCommitteeFullName(committee)}, you'll be involved in exciting projects and initiatives. 
                    We look forward to working with you!
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantAccepted: (
    userName: string,
    userId: string,
    ebRole: string,
  ): EmailTemplate => ({
    subject:
      "CSSApply - Congratulations! Your Executive Assistant Application Has Been Accepted",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Congratulations ${userName}!</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We are thrilled to inform you that your executive assistant application has been <strong style="color: #134687;">ACCEPTED</strong>! 
                    Welcome to the Computer Science Society Executive Assistant!
                </p>
                
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🎉 Acceptance Details:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Executive Assistant</p>
                        <p style="margin: 0; color: #1f2937;"><strong>EA Role:</strong> ${capitalizeWords(ebRole)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #134687; font-weight: bold; background-color: #e0f2fe; padding: 4px 8px; border-radius: 6px;">ACCEPTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for executive assistant activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    As an Executive Assistant for ${capitalizeWords(ebRole)}, you'll play a crucial role in supporting our leadership team. 
                    We look forward to working with you!
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  // Rejection notification templates
  committeeRejected: (userName: string, committee: string): EmailTemplate => ({
    subject: "CSSApply - Committee Staff Application Update",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${userName},</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for your interest in joining the Computer Science Society Committee Staff. 
                    After careful consideration, we regret to inform you that your application for the 
                    <strong>${getCommitteeFullName(committee)}</strong> has not been successful this time.
                </p>
                
                <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #dc2626; margin-top: 0;">📋 Application Update:</h3>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Committee Staff</p>
                    <p style="margin: 5px 0;"><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">NOT SELECTED</span></p>
                </div>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    This decision was not easy to make, as we received many qualified applications. 
                    We encourage you to apply again in the future and to stay involved with CSS activities.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    We appreciate your interest in CSS and wish you the best in your academic journey.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantRejected: (
    userName: string,
    ebRole: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Executive Assistant Application Update",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${userName},</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for your interest in joining the Computer Science Society Executive Assistant. 
                    After careful consideration, we regret to inform you that your application for 
                    <strong>${capitalizeWords(ebRole)} Executive Assistant</strong> has not been successful this time.
                </p>
                
                <div style="background-color: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #dc2626; margin-top: 0;">📋 Application Update:</h3>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Executive Assistant</p>
                    <p style="margin: 5px 0;"><strong>EA Role:</strong> ${capitalizeWords(ebRole)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">NOT SELECTED</span></p>
                </div>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    This decision was not easy to make, as we received many qualified applications. 
                    We encourage you to apply again in the future and to stay involved with CSS activities.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    We appreciate your interest in CSS and wish you the best in your academic journey.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  // Redirection notification templates
  committeeRedirected: (
    userName: string,
    userId: string,
    originalCommittee: string,
    redirectedCommittee: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Committee Staff Application Redirected",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Hello, ${userName},</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We have reviewed your committee staff application and would like to offer you an opportunity 
                    with a different committee that we believe would be a better fit for your skills and interests.
                </p>
                
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #d97706; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(217, 119, 6, 0.2);">
                    <h3 style="color: #d97706; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🔄 Application Redirected:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Committee Staff</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Original Committee:</strong> ${getCommitteeFullName(originalCommittee)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Redirected to:</strong> ${getCommitteeFullName(redirectedCommittee)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 4px 8px; border-radius: 6px;">REDIRECTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for committee activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    This redirection is based on our assessment of your qualifications and the current needs 
                    of our committees. We believe you will have a great opportunity to contribute to the 
                    <strong style="color: #134687;">${getCommitteeFullName(redirectedCommittee)}</strong>.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Please let us know if you accept this redirection or if you have any questions about this change. Please contact: css.cics@ust.edu.ph.
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantRedirected: (
    userName: string,
    userId: string,
    originalEbRole: string,
    redirectedEbRole: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Executive Assistant Application Redirected",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Hello, ${userName},</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    We have reviewed your executive assistant application and would like to offer you an opportunity 
                    with a different EA role that we believe would be a better fit for your skills and interests.
                </p>
                
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #d97706; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(217, 119, 6, 0.2);">
                    <h3 style="color: #d97706; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🔄 Application Redirected:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Executive Assistant</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Original EA Role:</strong> ${capitalizeWords(originalEbRole)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Redirected to:</strong> ${capitalizeWords(redirectedEbRole)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 4px 8px; border-radius: 6px;">REDIRECTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for executive assistant activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    This redirection is based on our assessment of your qualifications and the current needs 
                    of our executive board. We believe you will have a great opportunity to contribute as 
                    <strong style="color: #134687;">${capitalizeWords(redirectedEbRole)} Executive Assistant</strong>.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Please let us know if you accept this redirection or if you have any questions about this change. Please contact: css.cics@ust.edu.ph.
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantRedirectedToCommittee: (
    userName: string,
    userId: string,
    originalEbRole: string,
    committeeId: string,
  ): EmailTemplate => ({
    subject:
      "CSSApply - Executive Assistant Application Redirected to Committee Staff",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Hello, ${userName}!</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Great news! Your Executive Assistant application has been redirected to a Committee Staff position 
                    that we believe is a better fit for your skills and qualifications.
                </p>
                
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border: 2px solid #d97706; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(217, 119, 6, 0.2);">
                    <h3 style="color: #d97706; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🔄 Application Redirected:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Application Type:</strong> Executive Assistant</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Original EA Role:</strong> ${capitalizeWords(originalEbRole)}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Redirected to:</strong> ${capitalizeWords(committeeId)} Committee Staff</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 4px 8px; border-radius: 6px;">REDIRECTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for committee activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    This redirection is based on our assessment of your qualifications and the current needs 
                    of our organization. We believe you will have a great opportunity to contribute as 
                    <strong style="color: #134687;">${capitalizeWords(committeeId)} Committee Staff</strong>.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    As a Committee Staff member, you will work closely with the committee to support various 
                    activities and projects. This role offers excellent opportunities for growth and 
                    meaningful contribution to the CSS community.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Please let us know if you accept this redirection or if you have any questions about this change. Please contact: css.cics@ust.edu.ph.
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  // Evaluation notification templates
  committeeEvaluating: (
    userName: string,
    committee: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Committee Staff Application Under Evaluation",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>

                <h2 style="color: #1f2937;">Hello, ${userName},</h2>

                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for your interest in joining the Computer Science Society Committee Staff. 
                    We are pleased to inform you that your application for the 
                    <strong>${getCommitteeFullName(committee)}</strong> is now under evaluation.
                </p>
                
                <div style="background-color: #f3e8ff; border: 2px solid #7c3aed; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #7c3aed; margin-top: 0;">📋 Evaluation Status:</h3>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Committee Staff</p>
                    <p style="margin: 5px 0;"><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #7c3aed; font-weight: bold;">UNDER EVALUATION</span></p>
                </div>

                <p style="color: #4b5563; line-height: 1.6;">
                    Our team is currently reviewing your application, including your qualifications, 
                    experience, and fit for the committee. This process typically takes a few days.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    We will notify you as soon as we have completed our evaluation. 
                    Thank you for your patience during this process.
                </p>

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantEvaluating: (
    userName: string,
    ebRole: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Executive Assistant Application Under Evaluation",
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>

                <h2 style="color: #1f2937;">Hello, ${userName},</h2>

                <p style="color: #4b5563; line-height: 1.6;">
                    Thank you for your interest in joining the Computer Science Society Executive Assistant. 
                    We are pleased to inform you that your application for 
                    <strong>${capitalizeWords(ebRole)} Executive Assistant</strong> is now under evaluation.
                </p>
                
                <div style="background-color: #f3e8ff; border: 2px solid #7c3aed; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #7c3aed; margin-top: 0;">📋 Evaluation Status:</h3>
                    <p style="margin: 5px 0;"><strong>Name:</strong> ${userName}</p>
                    <p style="margin: 5px 0;"><strong>Application Type:</strong> Executive Assistant</p>
                    <p style="margin: 5px 0;"><strong>EA Role:</strong> ${capitalizeWords(ebRole)}</p>
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #7c3aed; font-weight: bold;">UNDER EVALUATION</span></p>
                </div>

                <p style="color: #4b5563; line-height: 1.6;">
                    Our team is currently reviewing your application, including your qualifications, 
                    experience, and fit for the executive assistant position. This process typically takes a few days.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    We will notify you as soon as we have completed our evaluation. 
                    Thank you for your patience during this process.
                </p>

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  // EB Interview Notification Templates
  ebInterviewNotificationEA: (
    ebName: string,
    applicantName: string,
    studentNumber: string,
    ebRole: string,
    interviewDate: string,
    interviewTime: string,
    meetingLink?: string,
  ): EmailTemplate => ({
    subject: `CSSApply - New Executive Assistant Interview Scheduled - ${applicantName}`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${ebName}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    You have a new interview scheduled for an Executive Assistant application. 
                    An applicant has booked an interview slot for the <strong>${capitalizeWords(ebRole)}</strong> position.
                </p>
                
                <div style="background-color: #e0f2fe; border: 2px solid #0284c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0284c7; margin-top: 0;">📅 Interview Details:</h3>
                    <p style="margin: 5px 0;"><strong>Applicant Name:</strong> ${applicantName}</p>
                    <p style="margin: 5px 0;"><strong>Student Number:</strong> ${studentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Position:</strong> ${capitalizeWords(ebRole)} Executive Assistant</p>
                    <p style="margin: 5px 0;"><strong>Interview Date:</strong> ${interviewDate}</p>
                    <p style="margin: 5px 0;"><strong>Interview Time:</strong> ${interviewTime}</p>
                    ${meetingLink ? `<p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #0284c7;">${meetingLink}</a></p>` : ""}
                </div>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Please prepare for the interview and ensure you have access to the applicant's CV and application details 
                    through the admin dashboard.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    If you need to reschedule or have any questions, please contact the admin team.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  ebInterviewNotificationCommittee: (
    ebName: string,
    applicantName: string,
    studentNumber: string,
    committee: string,
    interviewDate: string,
    interviewTime: string,
    meetingLink?: string,
  ): EmailTemplate => ({
    subject: `CSSApply - New Committee Staff Interview Scheduled - ${applicantName}`,
    html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #134687; font-size: 28px; font-weight: bold; margin: 0; letter-spacing: 1px;">CSSApply</h1>
                </div>
                
                <h2 style="color: #1f2937;">Hello, ${ebName}!</h2>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    You have a new interview scheduled for a Committee Staff application. 
                    An applicant has booked an interview slot for the <strong>${getCommitteeFullName(committee)}</strong> position.
                </p>
                
                <div style="background-color: #e0f2fe; border: 2px solid #0284c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #0284c7; margin-top: 0;">📅 Interview Details:</h3>
                    <p style="margin: 5px 0;"><strong>Applicant Name:</strong> ${applicantName}</p>
                    <p style="margin: 5px 0;"><strong>Student Number:</strong> ${studentNumber}</p>
                    <p style="margin: 5px 0;"><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
                    <p style="margin: 5px 0;"><strong>Interview Date:</strong> ${interviewDate}</p>
                    <p style="margin: 5px 0;"><strong>Interview Time:</strong> ${interviewTime}</p>
                    ${meetingLink ? `<p style="margin: 5px 0;"><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #0284c7;">${meetingLink}</a></p>` : ""}
                </div>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    Please prepare for the interview and ensure you have access to the applicant's CV, portfolio, and application details 
                    through the admin dashboard.
                </p>
                
                <p style="color: #4b5563; line-height: 1.6;">
                    If you need to reschedule or have any questions, please contact the admin team.
                </p>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; font-size: 14px;">
                        Best regards,<br>
                        CSSApply Team
                    </p>
                </div>
            </div>
        `,
  }),

  // Member redirection templates
  committeeRedirectedToMember: (
    userName: string,
    userId: string,
    originalCommittee: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Committee Staff Application Redirected to Member",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Application Update - ${userName}</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Great news! Your Committee Staff application has been redirected to a Member position. 
                    We believe this will be a great opportunity for you to contribute to the CSS community!
                </p>
                
                <div style="background-color: #ffffff; border: 2px solid #d97706; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(217, 119, 6, 0.15);">
                    <h3 style="color: #d97706; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🔄 Application Redirected:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Original Application:</strong> ${getCommitteeFullName(originalCommittee)} Committee Staff</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Redirected to:</strong> Member</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold; background-color: #fef3c7; padding: 4px 8px; border-radius: 6px;">REDIRECTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for future activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    This redirection is based on our assessment of your qualifications and the current needs 
                    of our organization. We believe you will have a great opportunity to contribute as a 
                    <strong style="color: #134687;">Member</strong>.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    As a Member, you'll be involved in exciting projects and initiatives. 
                    We look forward to working with you!
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Please let us know if you accept this redirection or if you have any questions about this change. Please contact: css.cics@ust.edu.ph.
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),

  executiveAssistantRedirectedToMember: (
    userName: string,
    userId: string,
    originalEbRole: string,
  ): EmailTemplate => ({
    subject: "CSSApply - Executive Assistant Application Redirected to Member",
    html: `
            <div style="font-family: 'Inter', 'Raleway', 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #1f2937;">
                <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(19, 70, 135, 0.3);">
                    <h1 style="color: white; font-size: 32px; font-weight: bold; margin: 0; letter-spacing: 2px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">CSSApply</h1>
                    <p style="color: #e0e7ff; font-size: 14px; margin: 5px 0 0 0; font-weight: 300;">Computer Science Society</p>
                </div>
                
                <h2 style="color: #134687; font-family: 'Raleway', sans-serif; font-size: 24px; margin-bottom: 20px;">Application Update - ${userName}</h2>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Great news! Your Executive Assistant application has been redirected to a Member position. 
                    We believe this will be a great opportunity for you to contribute to the CSS community!
                </p>
                
                <div style="background-color: #ffffff; border: 2px solid #d97706; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(217, 119, 6, 0.15);">
                    <h3 style="color: #d97706; margin-top: 0; font-family: 'Raleway', sans-serif; font-size: 20px;">🔄 Application Redirected:</h3>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0; color: #1f2937;"><strong>Name:</strong> ${userName}</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Member ID:</strong> <span style="color: #134687; font-weight: bold;">${truncateToLast7(userId).toUpperCase()}</span></p>
                        <p style="margin: 0; color: #1f2937;"><strong>Original Application:</strong> ${capitalizeWords(originalEbRole)} Executive Assistant</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Redirected to:</strong> Member</p>
                        <p style="margin: 0; color: #1f2937;"><strong>Status:</strong> <span style="color: #d97706; font-weight: bold; background-color: #fef3c7; padding: 4px 8px; border-radius: 6px;">REDIRECTED</span></p>
                    </div>
                </div>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Your Member ID (<strong style="color: #134687;">${truncateToLast7(userId).toUpperCase()}</strong>) is now your official identifier within the organization. 
                    Please keep this information safe as you'll need it for future activities and events.
                </p>
                
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
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    This redirection is based on our assessment of your qualifications and the current needs 
                    of our organization. We believe you will have a great opportunity to contribute as a 
                    <strong style="color: #134687;">Member</strong>.
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    As a Member, you'll be involved in exciting projects and initiatives. 
                    We look forward to working with you!
                </p>
                
                <p style="color: #1f2937; line-height: 1.6; font-size: 16px;">
                    Please let us know if you accept this redirection or if you have any questions about this change. Please contact: css.cics@ust.edu.ph.
                </p>
                
                <!-- Join Group Section -->
                <div style="background-color: #ffffff; border: 2px solid #134687; padding: 25px; border-radius: 12px; margin: 25px 0; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.15);">
                    <h3 style="color: #134687; margin-top: 0; text-align: center; font-family: 'Raleway', sans-serif; font-size: 20px;">👥 Join Our Community</h3>
                    <p style="color: #1f2937; line-height: 1.6; text-align: center; font-size: 16px; margin-bottom: 15px;">
                        Join our exclusive private FB group for members to stay connected and receive updates:
                    </p>
                    <div style="text-align: center;">
                        <a href="https://fb.me/g/6UCY6FrzU/L7r94Zcj" 
                           style="display: inline-block; background: linear-gradient(135deg, #134687 0%, #0f3a6b 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 8px rgba(19, 70, 135, 0.3);">
                            👥 Join UST CSS Members 25'-26' Group
                        </a>
                    </div>
                    <p style="color: #6b7280; line-height: 1.6; text-align: center; font-size: 14px; margin-top: 15px; margin-bottom: 0;">
                        Connect with fellow members and stay updated with exclusive announcements!
                    </p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px; font-family: 'Inter', sans-serif;">
                        Best regards,<br>
                        <strong style="color: #134687;">CSSApply Team</strong>
                    </p>
                </div>
            </div>
        `,
  }),
};
