/** Client-safe contracts for the Super Admin email composer. */
export const EMAIL_CAMPAIGN_RECIPIENT_LIMIT = 250;
export type EmailCampaignGroup = "ea" | "staff" | "member";
export type EmailCampaignTemplate = "event" | "reminder";
export type EmailCampaignStatus =
  "DRAFT" | "SENDING" | "ACCEPTED" | "FAILED" | "UNKNOWN";
export type EmailCampaignRecipientStatus =
  "PENDING" | "SENDING" | "ACCEPTED" | "FAILED" | "UNKNOWN";

export interface EmailCampaignContent {
  templateType: EmailCampaignTemplate;
  subject: string;
  title: string;
  body: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  ctaLabel?: string;
  ctaUrl?: string;
}
export interface EmailCampaignAudienceRecipient {
  userId: string;
  name: string;
  email: string;
  groups: EmailCampaignGroup[];
  positions: string[];
}
export interface EmailCampaignAudience {
  cycle: { id: string; schoolYear: string } | null;
  counts: Record<EmailCampaignGroup, number>;
  recipients: EmailCampaignAudienceRecipient[];
}
export interface EmailCampaignCounts {
  total: number;
  pending: number;
  sending: number;
  accepted: number;
  failed: number;
  unknown: number;
}
export interface EmailCampaignSummary {
  id: string;
  subject: string;
  templateType: EmailCampaignTemplate;
  status: EmailCampaignStatus;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  acceptedAt: string | null;
  counts: EmailCampaignCounts;
  errorMessage: string | null;
}
export interface EmailCampaignDetail extends EmailCampaignSummary {
  content: EmailCampaignContent;
  recipients: Array<{
    userId: string;
    name: string;
    email: string;
    groups: EmailCampaignGroup[];
    status: EmailCampaignRecipientStatus;
  }>;
}
