import "server-only";

import { z } from "zod";
import { wrapCampaignEmail } from "@/lib/email-campaign-layout";
import type { EmailCampaignContent } from "@/lib/email-campaign-contract";

const hasHeaderControl = (value: string): boolean =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return (
      code < 32 ||
      (code >= 127 && code <= 159) ||
      code === 0x2028 ||
      code === 0x2029
    );
  });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

function isSafeHttpsUrl(value: string): boolean {
  // URL() otherwise silently removes tabs/newlines and normalizes backslashes.
  if (
    hasHeaderControl(value) ||
    /\s|\\/.test(value) ||
    !/^https:\/\//i.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    const authority = value.slice(value.indexOf("//") + 2).split(/[/?#]/, 1)[0];
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !authority.includes("@")
    );
  } catch {
    return false;
  }
}

/** Plain-text authoring only: markup is escaped by the renderer, never trusted. */
export const campaignContentSchema = z
  .object({
    templateType: z.enum(["event", "reminder"]),
    // Optional keeps existing immutable drafts compatible without rewriting them.
    logo: z.enum(["css", "cssapply"]).optional(),
    // Check BEFORE trimming so even a leading/trailing newline is rejected.
    subject: z
      .string()
      .refine((value) => !hasHeaderControl(value), {
        message: "Subject must not contain control characters or newlines",
      })
      .trim()
      .min(1)
      .max(160),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(10000),
    eventDate: optionalText(160),
    eventTime: optionalText(160),
    eventVenue: optionalText(300),
    ctaLabel: optionalText(100),
    ctaUrl: optionalText(2048).refine(
      (value) => !value || isSafeHttpsUrl(value),
      {
        message: "CTA URL must use HTTPS without credentials",
      },
    ),
  })
  .strict()
  .superRefine((content, context) => {
    if (Boolean(content.ctaLabel) !== Boolean(content.ctaUrl)) {
      context.addIssue({
        code: "custom",
        path: [content.ctaLabel ? "ctaUrl" : "ctaLabel"],
        message: "CTA label and URL must be supplied together",
      });
    }
  });

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });

function paragraphs(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split(/\n[\t ]*\n/)
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px; color: #134687; font-size: 15px; line-height: 1.75;">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

/** Campaign-only styling; automated application emails retain their existing layout. */
export function buildCampaignEmail(content: EmailCampaignContent): {
  subject: string;
  html: string;
} {
  const parsed = campaignContentSchema.parse(content);
  let innerHtml = paragraphs(parsed.body);

  if (parsed.templateType === "event") {
    const details = [
      ["Date", parsed.eventDate],
      ["Time", parsed.eventTime],
      ["Venue", parsed.eventVenue],
    ].filter(([, value]) => Boolean(value));
    if (details.length) {
      innerHtml += `<div class="accent-box" style="margin: 18px 0; padding: 18px 20px; border-radius: 12px; background-color: #E8F2FF;"><h3 style="margin: 0 0 10px; color: #134687; font-size: 15px; line-height: 1.5;">Event details</h3><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed; font-size: 14px; line-height: 1.6; color: #134687;">${details
        .map(
          ([label, value]) =>
            `<tr><td width="58" valign="top" style="width: 58px; padding: 3px 10px 3px 0; font-weight: 600;">${label}:</td><td valign="top" style="padding: 3px 0; overflow-wrap: anywhere; word-wrap: break-word;">${escapeHtml(value!)}</td></tr>`,
        )
        .join("")}</table></div>`;
    }
  }

  if (parsed.ctaLabel && parsed.ctaUrl) {
    innerHtml += `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 24px auto 8px; max-width: 100%;"><tr><td align="center" bgcolor="#044FAF" style="border-radius: 9px; background-color: #044FAF;"><a class="button" href="${escapeHtml(parsed.ctaUrl)}" style="display: inline-block; padding: 13px 24px; color: #FFFFFF; background-color: #044FAF; border-radius: 9px; font-size: 14px; line-height: 1.5; font-weight: 600; text-align: center; text-decoration: none; overflow-wrap: anywhere; word-break: break-word;">${escapeHtml(parsed.ctaLabel)}</a></td></tr></table>`;
  }

  return {
    subject: parsed.subject,
    html: wrapCampaignEmail(
      escapeHtml(parsed.title),
      innerHtml,
      parsed.logo ?? "cssapply",
    ),
  };
}
