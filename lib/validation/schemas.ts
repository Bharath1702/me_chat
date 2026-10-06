import { z } from "zod";

export const NAME_MAX_LENGTH = 40;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const CONNECTION_ID_REGEX = /^[A-Z]{3}-[A-Z0-9]{4}$/;

/** Uppercases, strips spaces/dashes and re-inserts the dash: "ahn 7k2m" → "AHN-7K2M". */
export function normalizeConnectionId(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length === 7) return `${compact.slice(0, 3)}-${compact.slice(3)}`;
  return raw.trim().toUpperCase();
}

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Please enter your name.")
  .max(NAME_MAX_LENGTH, `Name must be ${NAME_MAX_LENGTH} characters or fewer.`)
  .refine((v) => !/[\u0000-\u001F\u007F<>]/.test(v), "Name contains invalid characters.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);

export const connectionIdSchema = z
  .string()
  .trim()
  .min(1, "Please enter a Connection ID.")
  .transform(normalizeConnectionId)
  .refine((v) => CONNECTION_ID_REGEX.test(v), "Enter a valid Connection ID, like AHN-7K2M.");

export const registerSchema = z.object({ name: nameSchema, password: passwordSchema });

export const loginSchema = z.object({
  connectionId: connectionIdSchema,
  // Login only checks presence; strength rules apply at registration.
  password: z.string().min(1, "Please enter your password.").max(PASSWORD_MAX_LENGTH),
});

export const connectSchema = z.object({ connectionId: connectionIdSchema });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConnectInput = z.infer<typeof connectSchema>;

/** Returns the first human-readable issue message from a failed parse. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}
