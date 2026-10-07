import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const pushSubscriptionKeysSchema = new Schema(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { _id: false }
);

const pushSubscriptionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true },
    keys: { type: pushSubscriptionKeysSchema, required: true },
    userAgent: { type: String, default: null },
    deviceName: { type: String, default: null },
    lastUsedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

// Compound unique index per user and endpoint
pushSubscriptionSchema.index({ userId: 1, endpoint: 1 }, { unique: true });

export type PushSubscriptionDocument = InferSchemaType<typeof pushSubscriptionSchema> & {
  _id: Types.ObjectId;
};

export const PushSubscription: Model<PushSubscriptionDocument> =
  (models.PushSubscription as Model<PushSubscriptionDocument> | undefined) ??
  model<PushSubscriptionDocument>("PushSubscription", pushSubscriptionSchema);
