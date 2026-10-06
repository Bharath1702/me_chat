import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const COUPLE_STATUSES = ["pending", "active", "blocked"] as const;
export type CoupleStatus = (typeof COUPLE_STATUSES)[number];

const coupleSchema = new Schema(
  {
    userA: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    userB: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    /**
     * Denormalised [userA, userB]. The unique multikey index below means no
     * user ID can appear in more than one Couple document — this is the
     * race-safe enforcement of "one couple per user".
     */
    members: {
      type: [Schema.Types.ObjectId],
      required: true,
      validate: {
        validator: (members: Types.ObjectId[]) =>
          members.length === 2 && !members[0].equals(members[1]),
        message: "A couple must contain exactly two different users",
      },
    },
    status: {
      type: String,
      enum: COUPLE_STATUSES,
      default: "active",
      required: true,
    },
  },
  { timestamps: true },
);

coupleSchema.index({ members: 1 }, { unique: true });
coupleSchema.index({ members: 1, status: 1 });

export type CoupleDocument = InferSchemaType<typeof coupleSchema> & {
  _id: Types.ObjectId;
};

export const Couple: Model<CoupleDocument> =
  (models.Couple as Model<CoupleDocument> | undefined) ??
  model<CoupleDocument>("Couple", coupleSchema);
