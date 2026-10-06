import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Message, type MessageDocument, MAX_MESSAGE_LENGTH } from "@/models/Message";
import { getActiveCoupleForUser } from "@/lib/services/couple-service";
import { storageProvider } from "@/lib/storage/r2";
import { AppError } from "@/lib/utils/errors";
import { randomBytes } from "node:crypto";

export type PublicMedia = {
  storageKey: string;
  url: string;
  mimeType: string;
  size: number;
  fileName?: string | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
};

export type PublicReplyTo = {
  messageId: string;
  content: string;
  senderId: string;
  type: "text" | "emoji" | "image" | "audio";
};

export type PublicReaction = {
  userId: string;
  emoji: string;
  createdAt: string;
};

export type PublicMessage = {
  id: string;
  coupleId: string;
  senderId: string;
  receiverId: string;
  type: "text" | "emoji" | "image" | "audio" | "call";
  content: string;
  media?: PublicMedia | null;
  status: "sending" | "sent" | "delivered" | "read";
  replyTo?: PublicReplyTo | null;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  deletedForEveryone: boolean;
  reactions: PublicReaction[];
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  deliveredAt: string | null;
  clientMessageId?: string;
};

export function toPublicMessage(
  doc: MessageDocument,
  authenticatedUserId?: string,
  clientMessageId?: string
): PublicMessage {
  const currentUserIdStr = authenticatedUserId?.toString();
  const isDeletedForEveryone = !!doc.deletedForEveryone;
  const isDeletedForMe =
    !!currentUserIdStr &&
    Array.isArray(doc.deletedFor) &&
    doc.deletedFor.some((id) => id.toString() === currentUserIdStr);

  const isHidden = isDeletedForEveryone || isDeletedForMe;

  return {
    id: doc._id.toString(),
    coupleId: doc.coupleId.toString(),
    senderId: doc.senderId.toString(),
    receiverId: doc.receiverId.toString(),
    type: doc.type as "text" | "emoji" | "image" | "audio" | "call",
    content: isHidden ? "This message was deleted" : doc.content || "",
    media: isHidden ? null : doc.media
      ? {
          storageKey: doc.media.storageKey,
          url: doc.media.url,
          mimeType: doc.media.mimeType,
          size: doc.media.size,
          fileName: doc.media.fileName,
          width: doc.media.width,
          height: doc.media.height,
          duration: doc.media.duration,
        }
      : null,
    status: doc.status as "sending" | "sent" | "delivered" | "read",
    replyTo: doc.replyTo
      ? {
          messageId: doc.replyTo.messageId.toString(),
          content: doc.replyTo.content,
          senderId: doc.replyTo.senderId.toString(),
          type: doc.replyTo.type as "text" | "emoji" | "image" | "audio",
        }
      : null,
    isEdited: !!doc.isEdited,
    editedAt: doc.editedAt ? (doc.editedAt instanceof Date ? doc.editedAt.toISOString() : new Date(doc.editedAt).toISOString()) : null,
    isDeleted: isHidden,
    deletedForEveryone: isDeletedForEveryone,
    reactions: isHidden
      ? []
      : (doc.reactions || []).map((r) => ({
          userId: r.userId.toString(),
          emoji: r.emoji,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
        })),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : new Date(doc.createdAt).toISOString(),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : new Date(doc.updatedAt).toISOString(),
    readAt: doc.readAt ? (doc.readAt instanceof Date ? doc.readAt.toISOString() : new Date(doc.readAt).toISOString()) : null,
    deliveredAt: doc.deliveredAt ? (doc.deliveredAt instanceof Date ? doc.deliveredAt.toISOString() : new Date(doc.deliveredAt).toISOString()) : null,
    clientMessageId,
  };
}

const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(userIdStr: string, limit = 15, windowMs = 3000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userIdStr) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  rateLimitMap.set(userIdStr, recent);
  return true;
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const ALLOWED_AUDIO_TYPES = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a"];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_AUDIO_SIZE = 15 * 1024 * 1024; // 15MB
export const MESSAGE_DELETE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window for delete for everyone

export async function generateUploadAuthorizationService(
  authenticatedUserId: Types.ObjectId,
  kind: "image" | "audio",
  mimeType: string,
  size: number
): Promise<{ uploadUrl: string; storageKey: string; publicUrl: string }> {
  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  if (kind === "image") {
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
      throw new AppError("VALIDATION", "Unsupported image format. Allowed: JPEG, PNG, WebP, GIF.", 400);
    }
    if (size > MAX_IMAGE_SIZE) {
      throw new AppError("VALIDATION", "Image size exceeds maximum 10MB limit.", 400);
    }
  } else if (kind === "audio") {
    if (!ALLOWED_AUDIO_TYPES.some((t) => mimeType.toLowerCase().startsWith(t))) {
      throw new AppError("VALIDATION", "Unsupported audio format.", 400);
    }
    if (size > MAX_AUDIO_SIZE) {
      throw new AppError("VALIDATION", "Audio message size exceeds 15MB limit.", 400);
    }
  } else {
    throw new AppError("VALIDATION", "Invalid media type.", 400);
  }

  const randomId = randomBytes(16).toString("hex");
  const ext = mimeType.split("/")[1] || "bin";
  const storageKey = `couples/${couple._id.toString()}/${kind}_${randomId}.${ext}`;

  const uploadUrl = await storageProvider.createUploadPresignedUrl(storageKey, mimeType, size);
  const publicUrl = await storageProvider.getPublicOrPresignedUrl(storageKey);

  return { uploadUrl, storageKey, publicUrl };
}

export async function sendMessageService(
  authenticatedUserId: Types.ObjectId,
  content: string,
  clientMessageId?: string,
  mediaInput?: PublicMedia | null,
  replyToId?: string,
  msgType?: "text" | "emoji" | "image" | "audio" | "call"
): Promise<{ message: PublicMessage; coupleId: string; receiverId: string }> {
  const isMedia = !!mediaInput;

  if (!isMedia) {
    if (!content || !content.trim()) {
      throw new AppError("VALIDATION", "Message content cannot be empty.", 400);
    }
    if (content.trim().length > MAX_MESSAGE_LENGTH) {
      throw new AppError("VALIDATION", `Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`, 400);
    }
  }

  if (process.env.NODE_ENV !== "test" && !checkRateLimit(authenticatedUserId.toString())) {
    throw new AppError("INVALID_REQUEST", "Sending messages too fast. Please slow down.", 429);
  }

  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  if (mediaInput) {
    const expectedPrefix = `couples/${couple._id.toString()}/`;
    if (!mediaInput.storageKey.startsWith(expectedPrefix)) {
      throw new AppError("UNAUTHORIZED", "Invalid media storage authorization.", 403);
    }
  }

  let replyToData = null;
  if (replyToId) {
    const targetMsg = await Message.findById(replyToId).lean<MessageDocument>();
    if (targetMsg && targetMsg.coupleId.equals(couple._id) && !targetMsg.deletedForEveryone) {
      replyToData = {
        messageId: targetMsg._id,
        content: targetMsg.content || (targetMsg.type === "image" ? "📷 Photo" : "🎙️ Audio"),
        senderId: targetMsg.senderId,
        type: targetMsg.type,
      };
    }
  }

  const receiverId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;
  let type: "text" | "emoji" | "image" | "audio" | "call" = msgType || "text";

  if (mediaInput) {
    type = mediaInput.mimeType.startsWith("audio/") ? "audio" : "image";
  }

  const doc = await Message.create({
    coupleId: couple._id,
    senderId: authenticatedUserId,
    receiverId,
    type,
    content: content ? content.trim() : "",
    media: mediaInput || null,
    replyTo: replyToData,
    status: "sent",
  });

  return {
    message: toPublicMessage(doc, authenticatedUserId.toString(), clientMessageId),
    coupleId: couple._id.toString(),
    receiverId: receiverId.toString(),
  };
}

export async function editMessageService(
  authenticatedUserId: Types.ObjectId,
  messageId: string,
  newContent: string
): Promise<{ message: PublicMessage; coupleId: string; receiverId: string }> {
  if (!newContent || !newContent.trim()) {
    throw new AppError("VALIDATION", "Message content cannot be empty.", 400);
  }
  if (newContent.trim().length > MAX_MESSAGE_LENGTH) {
    throw new AppError("VALIDATION", `Message exceeds maximum length.`, 400);
  }

  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  const doc = await Message.findById(messageId);
  if (!doc || !doc.coupleId.equals(couple._id)) {
    throw new AppError("NOT_FOUND", "Message not found.", 404);
  }
  if (!doc.senderId.equals(authenticatedUserId)) {
    throw new AppError("UNAUTHORIZED", "Only the sender can edit this message.", 403);
  }
  if (doc.type !== "text" && doc.type !== "emoji") {
    throw new AppError("VALIDATION", "Only text messages can be edited.", 400);
  }
  if (doc.deletedForEveryone) {
    throw new AppError("VALIDATION", "Deleted messages cannot be edited.", 400);
  }

  doc.content = newContent.trim();
  doc.isEdited = true;
  doc.editedAt = new Date();
  await doc.save();

  const receiverId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;
  return {
    message: toPublicMessage(doc, authenticatedUserId.toString()),
    coupleId: couple._id.toString(),
    receiverId: receiverId.toString(),
  };
}

export async function deleteMessageService(
  authenticatedUserId: Types.ObjectId,
  messageId: string,
  forEveryone = false
): Promise<{ message: PublicMessage; coupleId: string; receiverId: string }> {
  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  const doc = await Message.findById(messageId);
  if (!doc || !doc.coupleId.equals(couple._id)) {
    throw new AppError("NOT_FOUND", "Message not found.", 404);
  }

  const receiverId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;

  if (forEveryone) {
    if (!doc.senderId.equals(authenticatedUserId)) {
      throw new AppError("UNAUTHORIZED", "Only the sender can delete a message for everyone.", 403);
    }
    const elapsed = Date.now() - new Date(doc.createdAt).getTime();
    if (elapsed > MESSAGE_DELETE_WINDOW_MS) {
      throw new AppError("VALIDATION", "Message can no longer be deleted for everyone (15-minute window expired).", 400);
    }
    doc.deletedForEveryone = true;
    doc.content = "";
    doc.media = null;
    doc.reactions.splice(0, doc.reactions.length);
    await doc.save();
  } else {
    if (!doc.deletedFor.some((id) => id.equals(authenticatedUserId))) {
      doc.deletedFor.push(authenticatedUserId);
      await doc.save();
    }
  }

  return {
    message: toPublicMessage(doc, authenticatedUserId.toString()),
    coupleId: couple._id.toString(),
    receiverId: receiverId.toString(),
  };
}

export async function toggleReactionService(
  authenticatedUserId: Types.ObjectId,
  messageId: string,
  emoji: string
): Promise<{ message: PublicMessage; coupleId: string; receiverId: string }> {
  if (!emoji || !emoji.trim()) {
    throw new AppError("VALIDATION", "Emoji is required for reaction.", 400);
  }

  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  const doc = await Message.findById(messageId);
  if (!doc || !doc.coupleId.equals(couple._id)) {
    throw new AppError("NOT_FOUND", "Message not found.", 404);
  }
  if (doc.deletedForEveryone) {
    throw new AppError("VALIDATION", "Cannot react to deleted messages.", 400);
  }

  const existingIdx = doc.reactions.findIndex(
    (r) => r.userId.equals(authenticatedUserId) && r.emoji === emoji.trim()
  );

  if (existingIdx >= 0) {
    doc.reactions.splice(existingIdx, 1);
  } else {
    // Remove any previous reaction from this user if single reaction policy or append
    doc.reactions.push({
      userId: authenticatedUserId,
      emoji: emoji.trim(),
      createdAt: new Date(),
    } as unknown as (typeof doc.reactions)[0]);
  }

  await doc.save();

  const receiverId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;
  return {
    message: toPublicMessage(doc, authenticatedUserId.toString()),
    coupleId: couple._id.toString(),
    receiverId: receiverId.toString(),
  };
}

export async function searchMessagesService(
  authenticatedUserId: Types.ObjectId,
  searchTerm: string,
  limit = 30
): Promise<{ messages: PublicMessage[] }> {
  if (!searchTerm || !searchTerm.trim()) return { messages: [] };

  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  const safeLimit = Math.min(Math.max(1, limit), 50);
  const regex = new RegExp(searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const docs = await Message.find({
    coupleId: couple._id,
    deletedForEveryone: { $ne: true },
    deletedFor: { $ne: authenticatedUserId },
    content: { $regex: regex },
  })
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean<MessageDocument[]>();

  return {
    messages: docs.map((d) => toPublicMessage(d, authenticatedUserId.toString())),
  };
}

export async function getMessagesService(
  authenticatedUserId: Types.ObjectId,
  before?: string,
  limit = 50
): Promise<{ messages: PublicMessage[]; hasMore: boolean }> {
  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) {
    throw new AppError("UNAUTHORIZED", "You do not have an active couple connection.", 403);
  }

  const safeLimit = Math.min(Math.max(1, limit), 100);
  const query: Record<string, unknown> = {
    coupleId: couple._id,
    deletedFor: { $ne: authenticatedUserId },
  };

  if (before) {
    const cursorDoc = await Message.findById(before).lean<MessageDocument>();
    if (cursorDoc && cursorDoc.coupleId.equals(couple._id)) {
      query.$or = [
        { createdAt: { $lt: cursorDoc.createdAt } },
        { createdAt: cursorDoc.createdAt, _id: { $lt: cursorDoc._id } },
      ];
    }
  }

  const raw = await Message.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .lean<MessageDocument[]>();

  const hasMore = raw.length > safeLimit;
  const docs = hasMore ? raw.slice(0, safeLimit) : raw;

  const messages = docs
    .map((d) => toPublicMessage(d, authenticatedUserId.toString()))
    .reverse();

  return { messages, hasMore };
}

export async function markMessagesAsReadService(
  authenticatedUserId: Types.ObjectId
): Promise<{ updatedCount: number; coupleId: string; senderId: string } | null> {
  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) return null;

  const senderId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;
  const now = new Date();

  const res = await Message.updateMany(
    {
      coupleId: couple._id,
      receiverId: authenticatedUserId,
      status: { $in: ["sent", "delivered"] },
    },
    {
      $set: { status: "read", readAt: now },
    }
  );

  if (res.modifiedCount > 0) {
    return {
      updatedCount: res.modifiedCount,
      coupleId: couple._id.toString(),
      senderId: senderId.toString(),
    };
  }
  return null;
}

export async function markMessagesAsDeliveredService(
  authenticatedUserId: Types.ObjectId
): Promise<{ updatedCount: number; coupleId: string; senderId: string } | null> {
  await connectToDatabase();
  const couple = await getActiveCoupleForUser(authenticatedUserId);
  if (!couple) return null;

  const senderId = couple.userA.equals(authenticatedUserId) ? couple.userB : couple.userA;
  const now = new Date();

  const res = await Message.updateMany(
    {
      coupleId: couple._id,
      receiverId: authenticatedUserId,
      status: "sent",
    },
    {
      $set: { status: "delivered", deliveredAt: now },
    }
  );

  if (res.modifiedCount > 0) {
    return {
      updatedCount: res.modifiedCount,
      coupleId: couple._id.toString(),
      senderId: senderId.toString(),
    };
  }
  return null;
}
