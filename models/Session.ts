import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // HMAC-SHA256 of the raw token. The raw token only ever lives in the cookie.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index: MongoDB removes sessions once expiresAt passes. Expiry is also
// enforced in code because the TTL monitor only runs periodically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = InferSchemaType<typeof sessionSchema> & {
  _id: Types.ObjectId;
};

export const Session: Model<SessionDocument> =
  (models.Session as Model<SessionDocument> | undefined) ??
  model<SessionDocument>("Session", sessionSchema);
