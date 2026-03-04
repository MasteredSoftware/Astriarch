import { Schema, model, Document } from "mongoose";

/**
 * Atomic sequence counter for event sourcing.
 *
 * Uses MongoDB's atomic findOneAndUpdate + $inc to generate
 * monotonically increasing sequence numbers per game.
 * No race conditions, no in-memory state, works across multiple server nodes.
 *
 * The _id field is the counter key (e.g., "game:<gameId>").
 */
export interface ISequenceCounter extends Document {
  _id: string;
  seq: number;
}

const SequenceCounterSchema = new Schema<ISequenceCounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    collection: "sequencecounters",
    // Disable _id auto-generation since we use a string _id
    _id: false,
  },
);

export const SequenceCounter = model<ISequenceCounter>("SequenceCounter", SequenceCounterSchema);
