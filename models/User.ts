import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { NAME_MAX_LENGTH } from "@/lib/validation/schemas";

const userSchema = new Schema(
  {
    connectionId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: NAME_MAX_LENGTH,
    },
    // Never selected unless explicitly requested with `.select("+passwordHash")`.
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: null },
    lastSeen: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: Types.ObjectId;
};

export const User: Model<UserDocument> =
  (models.User as Model<UserDocument> | undefined) ??
  model<UserDocument>("User", userSchema);
