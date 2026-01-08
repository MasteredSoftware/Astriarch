import mongoose, { Document, Model } from "mongoose";
import { logger } from "../utils/logger";

/**
 * Data Access Layer for MongoDB document persistence.
 * Automatically handles markModified() for Schema.Types.Mixed fields before saving.
 */
export class DocumentPersistence {
  /**
   * Save a document with automatic Mixed field marking.
   * This replaces direct calls to document.save()
   */
  static async saveDocument<T extends Document>(document: T, mixedFields?: string[]): Promise<T> {
    try {
      // Auto-detect Mixed fields if not explicitly provided
      const fieldsToMark = mixedFields || DocumentPersistence.detectMixedFields(document);

      // Mark all Mixed type fields as modified
      fieldsToMark.forEach((field) => {
        document.markModified(field);
      });

      // Save and return the document
      const savedDocument = await document.save();

      logger.debug(`Document saved successfully. Mixed fields marked: [${fieldsToMark.join(", ")}]`);
      return savedDocument;
    } catch (error) {
      logger.error("Error saving document:", error);
      throw error;
    }
  }

  /**
   * Save a Game document (convenience method)
   */
  static async saveGame(gameDocument: Document): Promise<Document> {
    return DocumentPersistence.saveDocument(gameDocument, ["gameState", "gameOptions"]);
  }

  /**
   * Save a PlayerAction document (convenience method)
   */
  static async savePlayerAction(actionDocument: Document): Promise<Document> {
    return DocumentPersistence.saveDocument(actionDocument, ["actionData", "changes"]);
  }

  /**
   * Save a GameEvent document (convenience method)
   */
  static async saveGameEvent(eventDocument: Document): Promise<Document> {
    return DocumentPersistence.saveDocument(eventDocument, ["eventData"]);
  }

  /**
   * Save a GameState document (convenience method)
   */
  static async saveGameState(gameStateDocument: Document): Promise<Document> {
    return DocumentPersistence.saveDocument(gameStateDocument, ["planets", "fleets", "players", "gameSettings"]);
  }

  /**
   * Auto-detect Mixed type fields from the document's schema
   */
  private static detectMixedFields(document: Document): string[] {
    const mixedFields: string[] = [];

    try {
      const schema = (document.constructor as any).schema;
      if (schema && schema.paths) {
        for (const [path, schemaType] of Object.entries(schema.paths)) {
          // Check if this path is a Mixed type
          if ((schemaType as any).instance === "Mixed") {
            mixedFields.push(path);
          }
        }
      }
    } catch (error) {
      logger.warn("Could not auto-detect Mixed fields:", error);
    }

    return mixedFields;
  }

  /**
   * Bulk save multiple documents with Mixed field handling
   */
  static async saveDocuments<T extends Document>(documents: { doc: T; mixedFields?: string[] }[]): Promise<T[]> {
    const savePromises = documents.map(({ doc, mixedFields }) => DocumentPersistence.saveDocument(doc, mixedFields));

    return Promise.all(savePromises);
  }

  /**
   * Find and update a document with Mixed field handling
   */
  static async findByIdAndUpdate<T extends Document>(
    model: Model<T>,
    id: string,
    update: any,
    mixedFields?: string[],
    options: any = {},
  ): Promise<T | null> {
    try {
      // First find the document
      const document = await model.findById(id);
      if (!document) {
        return null;
      }

      // Apply updates
      Object.assign(document, update);

      // Save with Mixed field handling
      return await DocumentPersistence.saveDocument(document, mixedFields);
    } catch (error) {
      logger.error("Error in findByIdAndUpdate:", error);
      throw error;
    }
  }

  /**
   * Create and save a new document with Mixed field handling
   */
  static async createDocument<T extends Document>(model: Model<T>, data: any, mixedFields?: string[]): Promise<T> {
    try {
      const document = new model(data);
      return await DocumentPersistence.saveDocument(document, mixedFields);
    } catch (error) {
      logger.error("Error creating document:", error);
      throw error;
    }
  }

  /**
   * Save game with concurrency protection using nonce field.
   * This method uses the nonce field to protect against concurrent edits on the game document.
   * Pattern from: http://docs.mongodb.org/ecosystem/use-cases/metadata-and-asset-management/
   *
   * @param gameId The game document ID
   * @param transformFunction Function that receives the game doc and returns the data to update
   * @param maxRetries Maximum number of retry attempts (default: 10)
   * @returns The updated game document
   */
  static async saveGameWithConcurrencyProtection<T extends Document>(
    model: Model<T>,
    gameId: string,
    transformFunction: (doc: T) => Promise<Partial<T>>,
    maxRetries: number = 10,
  ): Promise<T> {
    let retries = 0;

    const attemptSave = async (): Promise<T> => {
      // Find the current game document
      const doc = await model.findById(gameId);
      if (!doc) {
        throw new Error(`Game not found: ${gameId}`);
      }

      // Get the current nonce value (for conditional update)
      const currentNonce = (doc as any).nonce;

      // Execute the transform function to get update data
      const updateData = await transformFunction(doc);

      // Generate a new nonce for this update
      const newNonce = new mongoose.Types.ObjectId();
      (updateData as any).nonce = newNonce;

      // Conditional update: only update if nonce matches
      const filter: any = { _id: gameId };
      if (currentNonce) {
        filter.nonce = currentNonce; // Only update if nonce hasn't changed
      }

      const result = await model.updateOne(filter, updateData).exec();

      if (result.matchedCount === 0) {
        // Update failed - nonce mismatch means someone else modified the document
        if (retries < maxRetries) {
          retries++;
          logger.warn(`Concurrent edit detected for game ${gameId}. Retry attempt ${retries}/${maxRetries}`);

          // Exponential backoff: 20ms, 40ms, 80ms, 160ms, etc.
          const delay = 20 * Math.pow(2, retries - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));

          // Retry the save
          return attemptSave();
        } else {
          throw new Error(`Failed to save game ${gameId} after ${maxRetries} retries due to concurrent modifications`);
        }
      }

      // Success - fetch and return the updated document
      const updatedDoc = await model.findById(gameId);
      if (!updatedDoc) {
        throw new Error(`Game not found after save: ${gameId}`);
      }

      if (retries > 0) {
        logger.info(`Successfully saved game ${gameId} after ${retries} retries`);
      }

      return updatedDoc;
    };

    return attemptSave();
  }
}

/**
 * Convenience export for common usage patterns
 */
export const persist = DocumentPersistence.saveDocument;
export const persistGame = DocumentPersistence.saveGame;
export const persistPlayerAction = DocumentPersistence.savePlayerAction;
export const persistGameEvent = DocumentPersistence.saveGameEvent;
export const persistGameState = DocumentPersistence.saveGameState;
export const saveGameWithConcurrencyProtection = DocumentPersistence.saveGameWithConcurrencyProtection;
