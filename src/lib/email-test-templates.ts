import { emailTemplates, type EmailTemplate } from "@/lib/email";

export const EMAIL_TEMPLATE_TEST_OPTIONS = [
  {
    value: "member_application",
    template: "memberApplication",
    label: "Member Application Received",
    category: "Applications",
  },
  {
    value: "committee_application",
    template: "committeeApplication",
    label: "Committee Staff Application Received",
    category: "Applications",
  },
  {
    value: "executive_associate_application",
    template: "executiveAssistantApplication",
    label: "Executive Associate Application Received",
    category: "Applications",
  },
  {
    value: "member_accepted",
    template: "memberAccepted",
    label: "Member Accepted",
    category: "Applications",
  },
  {
    value: "committee_accepted",
    template: "committeeAccepted",
    label: "Committee Staff Accepted",
    category: "Applications",
  },
  {
    value: "executive_associate_accepted",
    template: "executiveAssistantAccepted",
    label: "Executive Associate Accepted",
    category: "Applications",
  },
  {
    value: "committee_evaluating",
    template: "committeeEvaluating",
    label: "Committee Staff Under Evaluation",
    category: "Applications",
  },
  {
    value: "executive_associate_evaluating",
    template: "executiveAssistantEvaluating",
    label: "Executive Associate Under Evaluation",
    category: "Applications",
  },
  {
    value: "committee_rejected",
    template: "committeeRejected",
    label: "Committee Staff Not Selected",
    category: "Applications",
  },
  {
    value: "executive_associate_rejected",
    template: "executiveAssistantRejected",
    label: "Executive Associate Not Selected",
    category: "Applications",
  },
  {
    value: "committee_redirected",
    template: "committeeRedirected",
    label: "Committee Staff Redirected",
    category: "Applications",
  },
  {
    value: "executive_associate_redirected",
    template: "executiveAssistantRedirected",
    label: "Executive Associate Redirected",
    category: "Applications",
  },
  {
    value: "executive_associate_redirected_to_committee",
    template: "executiveAssistantRedirectedToCommittee",
    label: "Executive Associate Redirected to Committee",
    category: "Applications",
  },
  {
    value: "committee_redirected_to_member",
    template: "committeeRedirectedToMember",
    label: "Committee Staff Redirected to Member",
    category: "Applications",
  },
  {
    value: "executive_associate_redirected_to_member",
    template: "executiveAssistantRedirectedToMember",
    label: "Executive Associate Redirected to Member",
    category: "Applications",
  },
  {
    value: "eb_interview_notification_ea",
    template: "ebInterviewNotificationEA",
    label: "New Executive Associate Interview (EB Notice)",
    category: "Interviews",
  },
  {
    value: "eb_interview_notification_committee",
    template: "ebInterviewNotificationCommittee",
    label: "New Committee Staff Interview (EB Notice)",
    category: "Interviews",
  },
  {
    value: "interview_schedule_cancelled",
    template: "interviewScheduleCancelled",
    label: "Interview Schedule Reset (EB Notice)",
    category: "Interviews",
  },
  {
    value: "acknowledgement_receipt_needs_revision",
    template: "acknowledgementReceiptNeedsRevision",
    label: "Acknowledgement Receipt Needs Revision",
    category: "Payment & Membership",
  },
  {
    value: "member_id_released",
    template: "memberIdReleased",
    label: "Member ID Released",
    category: "Payment & Membership",
  },
  {
    value: "payment_deadline_reminder",
    template: "paymentDeadlineReminder",
    label: "Payment Receipt Deadline Reminder",
    category: "Payment & Membership",
  },
  {
    value: "payment_reminder",
    template: "paymentReminder",
    label: "Payment Reminder",
    category: "Payment & Membership",
  },
  {
    value: "css_group_join",
    template: "cssGroupJoin",
    label: "CSS Community Join Reminder",
    category: "Community",
  },
] as const satisfies ReadonlyArray<{
  value: string;
  template: keyof typeof emailTemplates;
  label: string;
  category: string;
}>;

type TemplateName = keyof typeof emailTemplates;
type TestTemplateFactory = (
  name: string,
  groupLabel: string,
  groupUrl: string,
) => EmailTemplate;

const testTemplateFactories = {
  memberApplication: (name) =>
    emailTemplates.memberApplication(name, "2025002027"),
  committeeApplication: (name) =>
    emailTemplates.committeeApplication(
      name,
      "2025002027",
      "academics",
      "creatives",
      "https://meet.google.com/test-css-interview",
      "Test Interviewer",
    ),
  executiveAssistantApplication: (name) =>
    emailTemplates.executiveAssistantApplication(
      name,
      "2025002027",
      "representative-1st-year",
      "representative-1st-year",
      "chief-of-staff",
      "https://meet.google.com/test-css-interview",
      "Test Interviewer",
    ),
  memberAccepted: (name) => emailTemplates.memberAccepted(name, "test-user-id"),
  committeeAccepted: (name) =>
    emailTemplates.committeeAccepted(name, "test-user-id", "academics"),
  executiveAssistantAccepted: (name) =>
    emailTemplates.executiveAssistantAccepted(
      name,
      "test-user-id",
      "representative-1st-year",
    ),
  committeeRejected: (name) =>
    emailTemplates.committeeRejected(name, "academics"),
  executiveAssistantRejected: (name) =>
    emailTemplates.executiveAssistantRejected(name, "representative-1st-year"),
  committeeRedirected: (name) =>
    emailTemplates.committeeRedirected(
      name,
      "test-user-id",
      "academics",
      "creatives",
    ),
  executiveAssistantRedirected: (name) =>
    emailTemplates.executiveAssistantRedirected(
      name,
      "test-user-id",
      "representative-1st-year",
      "chief-of-staff",
    ),
  executiveAssistantRedirectedToCommittee: (name) =>
    emailTemplates.executiveAssistantRedirectedToCommittee(
      name,
      "test-user-id",
      "representative-1st-year",
      "academics",
    ),
  committeeEvaluating: (name) =>
    emailTemplates.committeeEvaluating(name, "academics"),
  executiveAssistantEvaluating: (name) =>
    emailTemplates.executiveAssistantEvaluating(
      name,
      "representative-1st-year",
    ),
  ebInterviewNotificationEA: (name) =>
    emailTemplates.ebInterviewNotificationEA(
      name,
      "Test Applicant",
      "2025002027",
      "representative-1st-year",
      "October 15, 2026",
      "7:00 PM–7:30 PM",
      "https://meet.google.com/test-css-interview",
    ),
  ebInterviewNotificationCommittee: (name) =>
    emailTemplates.ebInterviewNotificationCommittee(
      name,
      "Test Applicant",
      "2025002027",
      "academics",
      "October 15, 2026",
      "7:00 PM–7:30 PM",
      "https://meet.google.com/test-css-interview",
    ),
  interviewScheduleCancelled: (name) =>
    emailTemplates.interviewScheduleCancelled(
      name,
      "Test Applicant",
      "Committee Staff",
    ),
  committeeRedirectedToMember: (name) =>
    emailTemplates.committeeRedirectedToMember(
      name,
      "test-user-id",
      "academics",
    ),
  executiveAssistantRedirectedToMember: (name) =>
    emailTemplates.executiveAssistantRedirectedToMember(
      name,
      "test-user-id",
      "representative-1st-year",
    ),
  acknowledgementReceiptNeedsRevision: (name) =>
    emailTemplates.acknowledgementReceiptNeedsRevision(
      name,
      "Please make sure the receipt date and payment reference are visible.",
    ),
  memberIdReleased: (name) =>
    emailTemplates.memberIdReleased(name, "CSS-2627-TEST"),
  paymentDeadlineReminder: () =>
    emailTemplates.paymentDeadlineReminder("2026-10-31T23:59:00+08:00"),
  paymentReminder: (name) => emailTemplates.paymentReminder(name),
  cssGroupJoin: (name, groupLabel, groupUrl) =>
    emailTemplates.cssGroupJoin(name, groupLabel, groupUrl),
} satisfies Record<TemplateName, TestTemplateFactory>;

type TestedTemplateName =
  (typeof EMAIL_TEMPLATE_TEST_OPTIONS)[number]["template"];
const allEmailTemplatesAreCovered: Exclude<
  TemplateName,
  TestedTemplateName
> extends never
  ? true
  : never = true;
void allEmailTemplatesAreCovered;

export function getEmailTemplateTestOptions() {
  return EMAIL_TEMPLATE_TEST_OPTIONS.map(({ value, label, category }) => ({
    value,
    label,
    category,
  }));
}

export function buildEmailTemplateTest(
  templateType: string,
  recipientName: string,
  groupLabel = "CSS Community Group",
  groupUrl = "",
): EmailTemplate | null {
  const option = EMAIL_TEMPLATE_TEST_OPTIONS.find(
    (candidate) => candidate.value === templateType,
  );
  if (!option) return null;

  return testTemplateFactories[option.template](
    recipientName,
    groupLabel,
    groupUrl,
  );
}
