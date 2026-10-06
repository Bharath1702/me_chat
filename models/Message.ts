import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const MESSAGE_TYPES = ["text", "emoji", "image", "audio", "call"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_STATUSES = ["sending", "sent", "delivered", "read"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MAX_MESSAGE_LENGTH = 2000;

export const mediaMetadataSchema = new Schema(
  {
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    fileName: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    duration: { type: Number, default: null },
  },
  { _id: false }
);

export const replyToSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    content: { type: String, default: "" },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: MESSAGE_TYPES, required: true },
  },
  { _id: false }
);

export const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, ref: "Couple", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: MESSAGE_TYPES, default: "text", required: true },
    content: {
      type: String,
      default: "",
      trim: true,
      maxlength: MAX_MESSAGE_LENGTH,
    },
    media: {
      type: mediaMetadataSchema,
      default: null,
    },
    status: {
      type: String,
      enum: MESSAGE_STATUSES,
      default: "sent",
      required: true,
    },
    replyTo: {
      type: replyToSchema,
      default: null,
    },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    readAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Primary pagination & ordering index
messageSchema.index({ coupleId: 1, createdAt: -1, _id: -1 });
// Quick unread query index
messageSchema.index({ coupleId: 1, receiverId: 1, status: 1 });
// Compound text index for searching couple messages
messageSchema.index({ coupleId: 1, content: "text" });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: Types.ObjectId;
};

export const Message: Model<MessageDocument> =
  (models.Message as Model<MessageDocument> | undefined) ??
  model<MessageDocument>("Message", messageSchema);
