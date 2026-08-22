import { BrevoClient } from "@getbrevo/brevo";
import { createLogger } from "@/lib/logger";

const emailLogger = createLogger("email");

const brevo = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || "",
});

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
        const result = await brevo.transactionalEmails.sendTransacEmail({
            subject,
            htmlContent: html,
            sender: {
                name: "CSSApply",
                email: process.env.BREVO_FROM_EMAIL || "noreply@cssapply.com",
            },
            to: [{ email: to }],
        });

        return { success: true, messageId: result.messageId };
    } catch (error) {
        emailLogger.error("delivery failed", error);
        return { success: false, error };
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
            throw new Error("Invalid email address");
        }

        const result = await sendEmail(to, subject, html);

        if (!result.success) {
            emailLogger.error("delivery returned an error", result.error, {
                context: context || "unspecified",
            });
        }

        return result;
    } catch (error) {
        emailLogger.error("validation or delivery failed", error, {
            context: context || "unspecified",
        });
        return { success: false, error };
    }
};

// Reusable standard email layout wrapper with premium CSS theme
const wrapEmail = (title: string, innerHtml: string): string => `
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
    .meeting-box {
      background-color: #e0f2fe;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .meeting-box h3 {
      color: #0369a1;
      margin-top: 0;
      font-size: 16px;
    }
    .meeting-box p {
      color: #0c4a6e;
      margin: 8px 0;
    }
    .badge {
      display: inline-block;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .badge-pending {
      background-color: rgba(4, 79, 175, 0.1);
      color: #044FAF;
    }
    .badge-accepted {
      background-color: rgba(4, 79, 175, 0.1);
      color: #044FAF;
    }
    .badge-redirected {
      background-color: rgba(217, 119, 6, 0.1);
      color: #d97706;
    }
    .badge-rejected {
      background-color: rgba(220, 38, 38, 0.1);
      color: #dc2626;
    }
    .badge-evaluating {
      background-color: rgba(124, 58, 237, 0.1);
      color: #7c3aed;
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

// Email templates for different application types
export const emailTemplates = {
    memberApplication: (
        userName: string,
        studentNumber: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Member Application Received",
        html: wrapEmail(
            `Hello, ${userName}!`,
            `
            <p>
              Thank you for submitting your member application to CSSApply! We have successfully received your application.
            </p>
            
            <div class="info-box">
              <h3>Application Details</h3>
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              <p><strong>Application Type:</strong> Member</p>
              <p><strong>Status:</strong> <span class="badge badge-pending">Under Review</span></p>
            </div>
            
            <p>
              Our team will review your application and get back to you soon. Please keep an eye on your email for updates.
            </p>
            
            <p>
              If you have any questions, feel free to reach out to us.
            </p>
            `
        ),
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
        html: wrapEmail(
            `Hello, ${userName}!`,
            `
            <p>
              Thank you for submitting your committee staff application to CSSApply! We have successfully received your application.
            </p>
            
            <div class="info-box">
              <h3>Application Details</h3>
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              <p><strong>Application Type:</strong> Committee Staff</p>
              <p><strong>First Choice:</strong> ${getCommitteeFullName(firstOption)}</p>
              <p><strong>Second Choice:</strong> ${getCommitteeFullName(secondOption)}</p>
              <p><strong>Status:</strong> <span class="badge badge-pending">Under Review</span></p>
            </div>
            
            ${meetingLink
                ? `
                <div class="meeting-box">
                  <h3>Interview Information</h3>
                  <p><strong>Interviewer:</strong> ${interviewer ? capitalizeWords(interviewer) : `${getCommitteeFullName(firstOption)} Head`}</p>
                  <p><strong>Meeting Link:</strong></p>
                  <div style="margin: 15px 0;">
                    <a href="${meetingLink}" target="_blank" class="button">
                      Join Google Meet Interview
                    </a>
                  </div>
                  <p style="margin: 10px 0 0 0; font-size: 13px;">
                    Please schedule your interview time through the application dashboard, then use this link to join your interview.
                  </p>
                </div>
                `
                : `
                <p>
                  Please proceed to schedule your interview through the application dashboard. The meeting link will be provided once you select your interview time.
                </p>
                `
            }
            
            <p>
              If you have any questions, feel free to reach out to us.
            </p>
            `
        ),
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
        subject: "CSSApply - Executive Associate Application Received",
        html: wrapEmail(
            `Hello, ${userName}!`,
            `
            <p>
                Thank you for submitting your executive associate application to CSSApply! We have successfully received your application.
            </p>
            
            <div class="info-box">
                <h3>Application Details</h3>
                <p><strong>Student Number:</strong> ${studentNumber}</p>
                <p><strong>Application Type:</strong> Executive Associate</p>
                <p><strong>Executive Associate Role:</strong> ${capitalizeWords(ebRole)}</p>
                <p><strong>First Choice:</strong> ${capitalizeWords(firstOption)}</p>
                <p><strong>Second Choice:</strong> ${capitalizeWords(secondOption)}</p>
                <p><strong>Status:</strong> <span class="badge badge-pending">Under Review</span></p>
            </div>
            
            ${meetingLink
                ? `
                <div class="meeting-box">
                    <h3>Interview Information</h3>
                    <p><strong>Interviewer:</strong> ${interviewer ? capitalizeWords(interviewer) : `${capitalizeWords(firstOption)} Executive Board Member`}</p>
                    <p><strong>Meeting Link:</strong></p>
                    <div style="margin: 15px 0;">
                        <a href="${meetingLink}" target="_blank" class="button">
                            Join Google Meet Interview
                        </a>
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 13px;">
                        Please schedule your interview time through the application dashboard, then use this link to join your interview.
                    </p>
                </div>
                `
                : `
                <p>
                    Please proceed to schedule your interview through the application dashboard. The meeting link will be provided once you select your interview time.
                </p>
                `
            }
            
            <p>
                If you have any questions, feel free to reach out to us.
            </p>
            `
        ),
    }),

    // Acceptance notification templates
    memberAccepted: (userName: string, _userId: string): EmailTemplate => ({
        subject:
            "CSSApply - Congratulations! Your Member Application Has Been Accepted",
        html: wrapEmail(
            `Congratulations ${userName}!`,
            `
            <p>
              We are thrilled to inform you that your member application has been <strong style="color: #134687;">ACCEPTED</strong>! 
              Welcome to the Computer Science Society!
            </p>
            
            <div class="info-box">
              <h3>Acceptance Details</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Member</p>
              <p><strong>Status:</strong> <span class="badge badge-accepted">ACCEPTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              We look forward to seeing you at our upcoming events and activities. Welcome to the CSS family!
            </p>
            `
        ),
    }),

    committeeAccepted: (
        userName: string,
        _userId: string,
        committee: string,
    ): EmailTemplate => ({
        subject:
            "CSSApply - Congratulations! Your Committee Staff Application Has Been Accepted",
        html: wrapEmail(
            `Congratulations ${userName}!`,
            `
            <p>
              We are thrilled to inform you that your committee staff application has been <strong style="color: #134687;">ACCEPTED</strong>! 
              Welcome to the Computer Science Society Committee Staff!
            </p>
            
            <div class="info-box">
              <h3>Acceptance Details</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Committee Staff</p>
              <p><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
              <p><strong>Status:</strong> <span class="badge badge-accepted">ACCEPTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              As a member of the ${getCommitteeFullName(committee)}, you'll be involved in exciting projects and initiatives. 
              We look forward to working with you!
            </p>
            `
        ),
    }),

    executiveAssistantAccepted: (
        userName: string,
        _userId: string,
        ebRole: string,
    ): EmailTemplate => ({
        subject:
            "CSSApply - Congratulations! Your Executive Associate Application Has Been Accepted",
        html: wrapEmail(
            `Congratulations ${userName}!`,
            `
            <p>
              We are thrilled to inform you that your executive associate application has been <strong style="color: #134687;">ACCEPTED</strong>! 
              Welcome to the Computer Science Society Executive Associate!
            </p>
            
            <div class="info-box">
              <h3>Acceptance Details</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Executive Associate</p>
              <p><strong>Executive Associate Role:</strong> ${capitalizeWords(ebRole)}</p>
              <p><strong>Status:</strong> <span class="badge badge-accepted">ACCEPTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              As an Executive Associate for ${capitalizeWords(ebRole)}, you'll play a crucial role in supporting our leadership team. 
              We look forward to working with you!
            </p>
            `
        ),
    }),

    // Rejection notification templates
    committeeRejected: (userName: string, committee: string): EmailTemplate => ({
        subject: "CSSApply - Committee Staff Application Update",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              Thank you for your interest in joining the Computer Science Society Committee Staff. 
              After careful consideration, we regret to inform you that your application for the 
              <strong>${getCommitteeFullName(committee)}</strong> has not been successful this time.
            </p>
            
            <div class="info-box">
              <h3>Application Update</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Committee Staff</p>
              <p><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
              <p><strong>Status:</strong> <span class="badge badge-rejected">NOT SELECTED</span></p>
            </div>
            
            <p>
              This decision was not easy to make, as we received many qualified applications. 
              We encourage you to apply again in the future and to stay involved with CSS activities.
            </p>
            
            <p>
              We appreciate your interest in CSS and wish you the best in your academic journey.
            </p>
            `
        ),
    }),

    executiveAssistantRejected: (
        userName: string,
        ebRole: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Executive Associate Application Update",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              Thank you for your interest in joining the Computer Science Society Executive Associate. 
              After careful consideration, we regret to inform you that your application for 
              <strong>${capitalizeWords(ebRole)} Executive Associate</strong> has not been successful this time.
            </p>
            
            <div class="info-box">
              <h3>Application Update</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Executive Associate</p>
              <p><strong>Executive Associate Role:</strong> ${capitalizeWords(ebRole)}</p>
              <p><strong>Status:</strong> <span class="badge badge-rejected">NOT SELECTED</span></p>
            </div>
            
            <p>
              This decision was not easy to make, as we received many qualified applications. 
              We encourage you to apply again in the future and to stay involved with CSS activities.
            </p>
            
            <p>
              We appreciate your interest in CSS and wish you the best in your academic journey.
            </p>
            `
        ),
    }),

    // Redirection notification templates
    committeeRedirected: (
        userName: string,
        _userId: string,
        originalCommittee: string,
        redirectedCommittee: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Committee Staff Application Redirected",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              We have reviewed your committee staff application and would like to offer you an opportunity 
              with a different committee that we believe would be a better fit for your skills and interests.
            </p>
            
            <div class="info-box">
              <h3>Application Redirected</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Committee Staff</p>
              <p><strong>Original Committee:</strong> ${getCommitteeFullName(originalCommittee)}</p>
              <p><strong>Redirected to:</strong> ${getCommitteeFullName(redirectedCommittee)}</p>
              <p><strong>Status:</strong> <span class="badge badge-redirected">REDIRECTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              This redirection is based on our assessment of your qualifications and the current needs 
              of our committees. We believe you will have a great opportunity to contribute to the 
              <strong style="color: #134687;">${getCommitteeFullName(redirectedCommittee)}</strong>.
            </p>
            
            <p>
              Please let us know if you accept this redirection or if you have any questions about this change.
            </p>
            `
        ),
    }),

    executiveAssistantRedirected: (
        userName: string,
        _userId: string,
        originalEbRole: string,
        redirectedEbRole: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Executive Associate Application Redirected",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              We have reviewed your executive associate application and would like to offer you an opportunity 
              with a different Executive Associate role that we believe would be a better fit for your skills and interests.
            </p>
            
            <div class="info-box">
              <h3>Application Redirected</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Executive Associate</p>
              <p><strong>Original Executive Associate Role:</strong> ${capitalizeWords(originalEbRole)}</p>
              <p><strong>Redirected to:</strong> ${capitalizeWords(redirectedEbRole)} Executive Associate</p>
              <p><strong>Status:</strong> <span class="badge badge-redirected">REDIRECTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              This redirection is based on our assessment of your qualifications and the current needs 
              of our executive board. We believe you will have a great opportunity to contribute as 
              <strong style="color: #134687;">${capitalizeWords(redirectedEbRole)} Executive Associate</strong>.
            </p>
            
            <p>
              Please let us know if you accept this redirection or if you have any questions about this change.
            </p>
            `
        ),
    }),

    executiveAssistantRedirectedToCommittee: (
        userName: string,
        _userId: string,
        originalEbRole: string,
        committeeId: string,
    ): EmailTemplate => ({
        subject:
            "CSSApply - Executive Associate Application Redirected to Committee Staff",
        html: wrapEmail(
            `Hello, ${userName}!`,
            `
            <p>
              Great news! Your Executive Associate application has been redirected to a Committee Staff position 
              that we believe is a better fit for your skills and qualifications.
            </p>
            
            <div class="info-box">
              <h3>Application Redirected</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Executive Associate</p>
              <p><strong>Original Executive Associate Role:</strong> ${capitalizeWords(originalEbRole)}</p>
              <p><strong>Redirected to:</strong> ${getCommitteeFullName(committeeId)} Committee Staff</p>
              <p><strong>Status:</strong> <span class="badge badge-redirected">REDIRECTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              This redirection is based on our assessment of your qualifications and the current needs 
              of our organization. We believe you will have a great opportunity to contribute as 
              <strong style="color: #134687;">${getCommitteeFullName(committeeId)} Committee Staff</strong>.
            </p>
            
            <p>
              As a Committee Staff member, you will work closely with the committee to support various 
              activities and projects. This role offers excellent opportunities for growth and 
              meaningful contribution to the CSS community.
            </p>
            
            <p>
              Please let us know if you accept this redirection or if you have any questions about this change.
            </p>
            `
        ),
    }),

    // Evaluation notification templates
    committeeEvaluating: (
        userName: string,
        committee: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Committee Staff Application Under Evaluation",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              Thank you for your interest in joining the Computer Science Society Committee Staff. 
              We are pleased to inform you that your application for the 
              <strong>${getCommitteeFullName(committee)}</strong> is now under evaluation.
            </p>
            
            <div class="info-box">
              <h3>Evaluation Status</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Committee Staff</p>
              <p><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
              <p><strong>Status:</strong> <span class="badge badge-evaluating">UNDER EVALUATION</span></p>
            </div>

            <p>
              Our team is currently reviewing your application, including your qualifications, 
              experience, and fit for the committee. This process typically takes a few days.
            </p>
            
            <p>
              We will notify you as soon as we have completed our evaluation. 
              Thank you for your patience during this process.
            </p>
            `
        ),
    }),

    executiveAssistantEvaluating: (
        userName: string,
        ebRole: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Executive Associate Application Under Evaluation",
        html: wrapEmail(
            `Hello, ${userName},`,
            `
            <p>
              Thank you for your interest in joining the Computer Science Society Executive Associate. 
              We are pleased to inform you that your application for 
              <strong>${capitalizeWords(ebRole)} Executive Associate</strong> is now under evaluation.
            </p>
            
            <div class="info-box">
              <h3>Evaluation Status</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Application Type:</strong> Executive Associate</p>
              <p><strong>Executive Associate Role:</strong> ${capitalizeWords(ebRole)}</p>
              <p><strong>Status:</strong> <span class="badge badge-evaluating">UNDER EVALUATION</span></p>
            </div>

            <p>
              Our team is currently reviewing your application, including your qualifications, 
              experience, and fit for the executive associate position. This process typically takes a few days.
            </p>
            
            <p>
              We will notify you as soon as we have completed our evaluation. 
              Thank you for your patience during this process.
            </p>
            `
        ),
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
        subject: `CSSApply - New Executive Associate Interview Scheduled - ${applicantName}`,
        html: wrapEmail(
            `Hello, ${ebName}!`,
            `
            <p>
              You have a new interview scheduled for an Executive Associate application. 
              An applicant has booked an interview slot for the <strong>${capitalizeWords(ebRole)}</strong> position.
            </p>
            
            <div class="info-box">
              <h3>Interview Details</h3>
              <p><strong>Applicant Name:</strong> ${applicantName}</p>
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              <p><strong>Position:</strong> ${capitalizeWords(ebRole)} Executive Associate</p>
              <p><strong>Interview Date:</strong> ${interviewDate}</p>
              <p><strong>Interview Time:</strong> ${interviewTime}</p>
              ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #134687;">${meetingLink}</a></p>` : ""}
            </div>
            
            <p>
              Please prepare for the interview and ensure you have access to the applicant's CV and application details 
              through the admin dashboard.
            </p>
            
            <p>
              If you need to reschedule or have any questions, please contact the admin team.
            </p>
            `
        ),
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
        html: wrapEmail(
            `Hello, ${ebName}!`,
            `
            <p>
              You have a new interview scheduled for a Committee Staff application. 
              An applicant has booked an interview slot for the <strong>${getCommitteeFullName(committee)}</strong> position.
            </p>
            
            <div class="info-box">
              <h3>Interview Details</h3>
              <p><strong>Applicant Name:</strong> ${applicantName}</p>
              <p><strong>Student Number:</strong> ${studentNumber}</p>
              <p><strong>Committee:</strong> ${getCommitteeFullName(committee)}</p>
              <p><strong>Interview Date:</strong> ${interviewDate}</p>
              <p><strong>Interview Time:</strong> ${interviewTime}</p>
              ${meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meetingLink}" target="_blank" style="color: #134687;">${meetingLink}</a></p>` : ""}
            </div>
            
            <p>
              Please prepare for the interview and ensure you have access to the applicant's CV, portfolio, and application details 
              through the admin dashboard.
            </p>
            
            <p>
              If you need to reschedule or have any questions, please contact the admin team.
            </p>
            `
        ),
    }),

    // Member redirection templates
    committeeRedirectedToMember: (
        userName: string,
        _userId: string,
        originalCommittee: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Committee Staff Application Redirected to Member",
        html: wrapEmail(
            `Application Update - ${userName}`,
            `
            <p>
              Great news! Your Committee Staff application has been redirected to a Member position. 
              We believe this will be a great opportunity for you to contribute to the CSS community!
            </p>
            
            <div class="info-box">
              <h3>Application Redirected</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Original Application:</strong> ${getCommitteeFullName(originalCommittee)} Committee Staff</p>
              <p><strong>Redirected to:</strong> Member</p>
              <p><strong>Status:</strong> <span class="badge badge-redirected">REDIRECTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              This redirection is based on our assessment of your qualifications and the current needs 
              of our organization. We believe you will have a great opportunity to contribute as a 
              <strong style="color: #134687;">Member</strong>.
            </p>
            
            <p>
              As a Member, you'll be involved in exciting projects and initiatives. 
              We look forward to working with you!
            </p>
            
            <p>
              Please let us know if you accept this redirection or if you have any questions about this change.
            </p>
            `
        ),
    }),

    executiveAssistantRedirectedToMember: (
        userName: string,
        _userId: string,
        originalEbRole: string,
    ): EmailTemplate => ({
        subject: "CSSApply - Executive Associate Application Redirected to Member",
        html: wrapEmail(
            `Application Update - ${userName}`,
            `
            <p>
              Great news! Your Executive Associate application has been redirected to a Member position. 
              We believe this will be a great opportunity for you to contribute to the CSS community!
            </p>
            
            <div class="info-box">
              <h3>Application Redirected</h3>
              <p><strong>Name:</strong> ${userName}</p>
              <p><strong>Original Application:</strong> ${capitalizeWords(originalEbRole)} Executive Associate</p>
              <p><strong>Redirected to:</strong> Member</p>
              <p><strong>Status:</strong> <span class="badge badge-redirected">REDIRECTED</span></p>
            </div>

            <div class="accent-box">
              <h3>Payment Instructions</h3>
              <p>
                To complete your membership, please open your application progress page, scan the latest payment QR shown there, download and fill out the acknowledgement receipt PDF, upload it to Google Drive, and submit the shareable link in the system.
              </p>
              <p style="font-size: 13px; margin: 10px 0 0 0;">
                Your Member ID will be sent through a separate email and shown in the system after an authorized Executive Board reviewer verifies and approves your acknowledgement receipt.
              </p>
            </div>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.NEXTAUTH_URL || 'https://cssapply.com'}" class="button">
                Go to Application Progress
              </a>
            </div>

            <p>
              This redirection is based on our assessment of your qualifications and the current needs 
              of our organization. We believe you will have a great opportunity to contribute as a 
              <strong style="color: #134687;">Member</strong>.
            </p>
            
            <p>
              As a Member, you'll be involved in exciting projects and initiatives. 
              We look forward to working with you!
            </p>
            
            <p>
              Please let us know if you accept this redirection or if you have any questions about this change.
            </p>
            `
        ),
    }),

    // Member ID Released template
    memberIdReleased: (userName: string, memberId: string): EmailTemplate => ({
        subject: "CSSApply - Your Member ID",
        html: wrapEmail(
            "Your Member ID is ready",
            `
            <p>Hi ${userName}, an authorized Executive Board reviewer has reviewed and approved your acknowledgement receipt.</p>
            
            <div class="accent-box" style="background-color: #E8F2FF; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
              <p style="margin: 0 0 8px; color: #134687; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;">Member ID</p>
              <p style="margin: 0; color: #044FAF; font-size: 30px; font-weight: 800; letter-spacing: 1px;">${memberId}</p>
            </div>
            
            <p>Please keep this ID for CSS activities and payment verification.</p>
            <p>If there are any issues, you may contact us at <a href="mailto:css.cics@ust.edu.ph" style="color: #044FAF; font-weight: 600;">css.cics@ust.edu.ph</a>.</p>
            `
        ),
    }),

    // Payment Reminder Template
    paymentReminder: (
        userName: string,
    ): EmailTemplate => ({
        subject: "CSS Group Payment Reminder",
        html: wrapEmail(
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
        ),
    }),

    // CSS Group Join Invitation Template
    cssGroupJoin: (
        userName: string,
        groupUrl: string,
        groupLabel: string,
    ): EmailTemplate => ({
        subject: "CSS Community Group Invitation",
        html: wrapEmail(
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
        ),
    }),
};
