export const GENERIC_ERROR = "Something went wrong. Please try again.";

export type AppErrorCode =
  | "VALIDATION"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "INVALID_CREDENTIALS"
  | "SELF_CONNECTION"
  | "ALREADY_CONNECTED"
  | "CONNECTION_UNAVAILABLE"
  | "NOT_FOUND";

/** An expected error whose message is safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
