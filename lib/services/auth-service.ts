
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword, verifyPassword, getDummyHash } from "@/lib/auth/password";
import { generateConnectionId } from "@/lib/utils/connection-id";
import { AppError, isDuplicateKeyError } from "@/lib/utils/errors";
import { firstIssue, loginSchema, registerSchema } from "@/lib/validation/schemas";
import { User, type UserDocument } from "@/models/User";
import type { PublicUser } from "@/types";

const MAX_ID_ATTEMPTS = 5;
export const INVALID_CREDENTIALS_MESSAGE = "Incorrect Connection ID or password.";

export function toPublicUser(user: Pick<UserDocument, "_id" | "name" | "connectionId" | "avatar">): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    connectionId: user.connectionId,
    avatar: user.avatar ?? null,
  };
}

export async function registerUser(
  input: unknown,
  options: { generateId?: () => string } = {},
): Promise<UserDocument> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", firstIssue(parsed.error), 400);

  await connectToDatabase();
  const passwordHash = await hashPassword(parsed.data.password);
  const generateId = options.generateId ?? generateConnectionId;

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    try {
      const user = await User.create({
        name: parsed.data.name,
        passwordHash,
        connectionId: generateId(),
      });
      return user.toObject<UserDocument>();
    } catch (error) {
      // Connection ID collision → retry with a fresh ID.
      if (isDuplicateKeyError(error)) continue;
      throw error;
    }
  }

  throw new Error("Unable to allocate a unique connection ID");
}

export async function loginUser(input: unknown): Promise<UserDocument> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", firstIssue(parsed.error), 400);

  await connectToDatabase();
  const user = await User.findOne({ connectionId: parsed.data.connectionId })
    .select("+passwordHash")
    .lean<UserDocument>();

  if (!user) {
    // Burn equivalent time so response timing doesn't reveal account existence.
    await verifyPassword(parsed.data.password, await getDummyHash());
    throw new AppError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401);
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) throw new AppError("INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE, 401);

  await User.updateOne({ _id: user._id }, { $set: { lastSeen: new Date() } });
  const { passwordHash: _omit, ...safe } = user;
  void _omit;
  return safe as UserDocument;
}
