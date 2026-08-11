import { z } from "zod";

export const committeeApplicationSchema = z.object({
  studentNumber: z
    .string()
    .min(1, "Student number is required")
    .regex(/^\d{10}$/, "Student number must be 10 digits"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  section: z.string().min(1, "Section is required"),
  secondChoice: z.string().min(1, "Second choice committee is required"),
});

export type CommitteeApplicationFormData = z.infer<
  typeof committeeApplicationSchema
>;
