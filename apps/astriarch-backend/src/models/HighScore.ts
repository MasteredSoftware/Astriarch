import mongoose, { Schema, Document } from "mongoose";

export interface IHighScore extends Document {
  playerName: string;
  playerId: string;
  playerPoints: number;
  playerWon: boolean;
  gameId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const HighScoreSchema = new Schema<IHighScore>({
  playerName: { type: String, required: true },
  playerId: { type: String, required: true },
  playerPoints: { type: Number, required: true, index: true },
  playerWon: { type: Boolean, required: true, default: false },
  gameId: { type: Schema.Types.ObjectId, ref: "Game" },
  createdAt: { type: Date, index: true, default: Date.now },
});

// Compound index for efficient "top scores" queries
HighScoreSchema.index({ playerPoints: -1 });
HighScoreSchema.index({ createdAt: -1, playerPoints: -1 });

export const HighScoreModel = mongoose.model<IHighScore>("HighScore", HighScoreSchema);
