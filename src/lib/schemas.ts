import { z } from 'zod';

// Application submissions
export const memberApplicationSchema = z.object({
  studentNumber: z.string().length(10).regex(/^\d{10}$/, 'Student number must be 10 digits'),
  section: z.string().min(1, 'Section is required').max(50),
  age: z.coerce.number().int().min(1, 'Age is required').max(120, 'Enter a valid age'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  isOldCssMember: z.boolean(),
});

export const committeeApplicationSchema = z.object({
  studentNumber: z.string().length(10).regex(/^\d{10}$/, 'Student number must be 10 digits'),
  section: z.string().min(1, 'Section is required').max(50),
  age: z.coerce.number().int().min(1, 'Age is required').max(120, 'Enter a valid age'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  isOldCssMember: z.boolean(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  firstOptionCommittee: z.string().min(1, 'First choice is required'),
  secondOptionCommittee: z.string().min(1, 'Second choice is required'),
  cv: z.string().optional(),
  portfolioLink: z.string().optional(),
});

export const executiveAssociateApplicationSchema = z.object({
  studentNumber: z.string().length(10).regex(/^\d{10}$/, 'Student number must be 10 digits'),
  section: z.string().min(1, 'Section is required').max(50),
  age: z.coerce.number().int().min(1, 'Age is required').max(120, 'Enter a valid age'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  isOldCssMember: z.boolean(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  firstOptionEb: z.string().min(1, 'First choice is required'),
  secondOptionEb: z.string().min(1, 'Second choice is required'),
  cv: z.string().optional(),
});

// Schedule
export const scheduleSchema = z.object({
  interviewSlotDay: z.string().min(1, 'Date is required'),
  interviewSlotTimeStart: z.string().min(1, 'Start time is required'),
  interviewSlotTimeEnd: z.string().min(1, 'End time is required'),
  interviewBy: z.string().min(1, 'Interviewer is required'),
});

export const eaScheduleSchema = z.object({
  interviewSlotDay: z.string().min(1, 'Date is required'),
  interviewSlotTimeStart: z.string().min(1, 'Start time is required'),
  interviewSlotTimeEnd: z.string().min(1, 'End time is required'),
  ebRole: z.string().min(1, 'EB role is required'),
  interviewBy: z.string().min(1, 'Interviewer is required'),
});

// Admin actions
export const applicationActionSchema = z.object({
  applicationId: z.string().min(1),
  type: z.enum(['member', 'committee', 'executive-associate']),
  action: z.enum(['accept', 'reject', 'redirect', 'evaluate']),
  redirection: z.string().optional(),
  interviewBy: z.string().optional(),
});

export const roleChangeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['user', 'admin', 'super_admin']),
});

export const ebProfileSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  position: z.string().min(1, 'Position is required'),
  committees: z.array(z.string()).min(1, 'At least one committee is required'),
  isActive: z.boolean().optional(),
  meetingLink: z.url('Invalid URL').optional().or(z.literal('')),
});

// Recruitment cycle
export const recruitmentCycleSchema = z.object({
  id: z.string().optional(),
  schoolYear: z.string().min(1, 'School year is required').regex(/^\d{4}-\d{4}$/, 'Format: YYYY-YYYY'),
  applicationStart: z.string().min(1, 'Application start is required'),
  interviewStart: z.string().min(1, 'Interview start is required'),
  interviewEnd: z.string().min(1, 'Interview end is required'),
  isActive: z.boolean().optional(),
});

// System config
export const systemConfigSchema = z.object({
  key: z.string().min(1, 'Key is required').regex(/^[a-z_]+$/, 'Key must be lowercase with underscores'),
  value: z.string(),
  description: z.string().optional(),
});

// Unavailable slots
export const unavailableSlotSchema = z.object({
  eb: z.string().min(1, 'EB role is required'),
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
});
