
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { AppError, isDuplicateKeyError } from "@/lib/utils/errors";
import { connectSchema, firstIssue } from "@/lib/validation/schemas";
import { Couple, type CoupleDocument } from "@/models/Couple";
import { User, type UserDocument } from "@/models/User";
import type { PartnerInfo } from "@/types";

export const SELF_CONNECTION_MESSAGE =
  "That's your own TwoChat ID. Enter the ID of the person you want to connect with.";
export const ALREADY_CONNECTED_MESSAGE =
  "You are already connected with someone. TwoChat supports one private connection per account.";
/** Deliberately identical for "no such user" and "user already connected". */
export const UNAVAILABLE_MESSAGE = "This connection is unavailable.";

const alreadyConnected = () => new AppError("ALREADY_CONNECTED", ALREADY_CONNECTED_MESSAGE, 409);
const unavailable = () => new AppError("CONNECTION_UNAVAILABLE", UNAVAILABLE_MESSAGE, 400);

export async function getActiveCoupleForUser(
  userId: Types.ObjectId,
): Promise<CoupleDocument | null> {
  await connectToDatabase();
  return Couple.findOne({ members: userId, status: "active" }).lean<CoupleDocument>();
}

/** Returns the partner of `userId` in their active couple (membership verified by the query). */
export async function getPartner(userId: Types.ObjectId): Promise<PartnerInfo | null> {
  const couple = await getActiveCoupleForUser(userId);
  if (!couple) return null;
  const partnerId = couple.userA.equals(userId) ? couple.userB : couple.userA;
  const partner = await User.findById(partnerId).select("name avatar").lean<UserDocument>();
  return partner ? { name: partner.name, avatar: partner.avatar ?? null } : null;
}

/**
 * Connects the authenticated user with the owner of the given Connection ID.
 * @param currentUserId MUST come from the verified session.
 */
export async function connectWithPartner(
  currentUserId: Types.ObjectId,
  input: unknown,
): Promise<{ coupleId: string; partner: PartnerInfo }> {
  const parsed = connectSchema.safeParse(input);
  if (!parsed.success) throw new AppError("VALIDATION", firstIssue(parsed.error), 400);

  await connectToDatabase();

  const me = await User.findById(currentUserId).lean<UserDocument>();
  if (!me) throw new AppError("UNAUTHORIZED", "Please log in to continue.", 401);

  if (me.connectionId === parsed.data.connectionId) {
    throw new AppError("SELF_CONNECTION", SELF_CONNECTION_MESSAGE, 400);
  }

  // Any existing couple (active, pending or blocked) counts: one couple per user.
  if (await Couple.exists({ members: me._id })) throw alreadyConnected();

  const target = await User.findOne({ connectionId: parsed.data.connectionId }).lean<UserDocument>();
  if (!target) throw unavailable();
  if (await Couple.exists({ members: target._id })) throw unavailable();

  try {
    const couple = await Couple.create({
      userA: me._id,
      userB: target._id,
      members: [me._id, target._id],
      status: "active",
    });
    return {
      coupleId: couple._id.toString(),
      partner: { name: target.name, avatar: target.avatar ?? null },
    };
  } catch (error) {
    // Lost a race against a concurrent connection; the unique index protected us.
    if (isDuplicateKeyError(error)) {
      if (await Couple.exists({ members: me._id })) throw alreadyConnected();
      throw unavailable();
    }
    throw error;
  }
}
