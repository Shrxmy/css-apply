import "server-only";

import { z } from "zod";
import { wrapEmail } from "@/lib/email";
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
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

/** Reuses the CSS layout, without sending mail or adding catalog templates. */
export function buildCampaignEmail(content: EmailCampaignContent): {
  subject: string;
  html: string;
} {
  const parsed = campaignContentSchema.parse(content);
  const templateLabel =
    parsed.templateType === "event" ? "CSS event" : "Reminder";
  let innerHtml = `<p style="color: #134687; font-weight: 600;">${templateLabel}</p>\n${paragraphs(parsed.body)}`;

  if (parsed.templateType === "event") {
    const details = [
      ["Date", parsed.eventDate],
      ["Time", parsed.eventTime],
      ["Venue", parsed.eventVenue],
    ].filter(([, value]) => Boolean(value));
    if (details.length) {
      innerHtml += `<div class="accent-box"><h3>Event details</h3>${details
        .map(
          ([label, value]) =>
            `<p><strong>${label}:</strong> ${escapeHtml(value!)}</p>`,
        )
        .join("")}</div>`;
    }
  }

  if (parsed.ctaLabel && parsed.ctaUrl) {
    innerHtml += `<p style="text-align: center;"><a class="button" href="${escapeHtml(parsed.ctaUrl)}">${escapeHtml(parsed.ctaLabel)}</a></p>`;
  }

  return {
    subject: parsed.subject,
    html: wrapEmail(escapeHtml(parsed.title), innerHtml),
  };
}
