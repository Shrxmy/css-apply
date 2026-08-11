import { z } from "zod";

const studentNumberSchema = z
  .string()
  .regex(/^\d{10}$/, "Student number must be 10 digits");

const dateOfBirthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid date of birth")
  .refine(
    (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
    "Date of birth cannot be in the future",
  );

const applicantProfileSchema = {
  studentNumber: studentNumberSchema,
  section: z.string().trim().min(1, "Section is required").max(50),
  age: z.coerce
    .number()
    .int("Age must be a whole number")
    .min(1, "Age is required")
    .max(120, "Enter a valid age"),
  dateOfBirth: dateOfBirthSchema,
  sex: z.enum(["M", "F"], { error: "Sex is required" }),
  isOldCssMember: z.boolean(),
};

// Application submissions
export const memberApplicationSchema = z.object(applicantProfileSchema);

export const committeeApplicationSchema = z
  .object({
    ...applicantProfileSchema,
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    firstOptionCommittee: z.string().trim().min(1, "First choice is required"),
    secondOptionCommittee: z.string().trim().min(1, "Second choice is required"),
    cv: z.string().trim().min(1, "CV is required"),
    portfolio: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    ({ firstOptionCommittee, secondOptionCommittee }) =>
      firstOptionCommittee !== secondOptionCommittee,
    {
      path: ["secondOptionCommittee"],
      message: "Committee choices must be different",
    },
  );

export const executiveAssociateApplicationSchema = z
  .object({
    ...applicantProfileSchema,
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    ebRole: z.string().trim().min(1, "Executive Board role is required"),
    firstOptionEb: z.string().trim().min(1, "First choice is required"),
    secondOptionEb: z.string().trim().min(1, "Second choice is required"),
    cv: z.string().trim().min(1, "CV is required"),
  })
  .refine(({ ebRole, firstOptionEb }) => ebRole === firstOptionEb, {
    path: ["ebRole"],
    message: "Applied role must match the first Executive Board choice",
  })
  .refine(
    ({ firstOptionEb, secondOptionEb }) => firstOptionEb !== secondOptionEb,
    {
      path: ["secondOptionEb"],
      message: "Executive Board choices must be different",
    },
  );

// Schedule
export const scheduleSchema = z.object({
  interviewSlotDay: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid interview date"),
  interviewSlotTimeStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Select a valid start time"),
  interviewSlotTimeEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Select a valid end time"),
  interviewBy: z.string().trim().min(1, "Interviewer is required"),
});

export const eaScheduleSchema = scheduleSchema.extend({
  ebRole: z.string().trim().min(1, "EB role is required"),
});

export const paymentProofSchema = z.object({
  paymentProof: z.string().trim().min(1, "Google Drive receipt link is required"),
});

// Admin actions
export const applicationActionSchema = z.object({
  applicationId: z.string().min(1),
  type: z.enum(["member", "committee", "executive-associate"]),
  action: z.enum(["accept", "reject", "redirect", "evaluate"]),
  redirection: z.string().optional(),
  interviewBy: z.string().optional(),
});

export const roleChangeSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(["user", "admin", "super_admin"]),
});

export const ebProfileSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  position: z.string().min(1, "Position is required"),
  committees: z.array(z.string()).min(1, "At least one committee is required"),
  isActive: z.boolean().optional(),
  meetingLink: z.url("Invalid URL").optional().or(z.literal("")),
});

// Recruitment cycle
export const recruitmentCycleSchema = z.object({
  id: z.string().optional(),
  schoolYear: z
    .string()
    .min(1, "School year is required")
    .regex(/^\d{4}-\d{4}$/, "Format: YYYY-YYYY"),
  applicationStart: z.string().min(1, "Application start is required"),
  interviewStart: z.string().min(1, "Interview start is required"),
  interviewEnd: z.string().min(1, "Interview end is required"),
  isActive: z.boolean().optional(),
});

// System config
export const systemConfigSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(/^[a-z_]+$/, "Key must be lowercase with underscores"),
  value: z.string(),
  description: z.string().optional(),
});

// Unavailable slots
export const unavailableSlotSchema = z.object({
  eb: z.string().min(1, "EB role is required"),
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
});
