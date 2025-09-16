#!/usr/bin/env node

// Simple script to clean up corrupted sessions from MongoDB
const mongoose = require('mongoose');

async function cleanupSessions() {
  const mongoUrl = 'mongodb://127.0.0.1:27017/astriarch_v2_dev';
  
  console.log('Connecting to MongoDB...');
  
  try {
    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;
    
    // Clean up Express sessions (connect-mongo)
    const expressSessionsCollection = db.collection('sessions');
    console.log('Cleaning up Express sessions...');
    
    const result1 = await expressSessionsCollection.deleteMany({ sessionId: null });
    console.log(`Deleted ${result1.deletedCount} Express sessions with null sessionId`);
    
    const result2 = await expressSessionsCollection.deleteMany({ sessionId: { $exists: false } });
    console.log(`Deleted ${result2.deletedCount} Express sessions with undefined sessionId`);
    
    const result3 = await expressSessionsCollection.deleteMany({ sessionId: "" });
    console.log(`Deleted ${result3.deletedCount} Express sessions with empty sessionId`);
    
    const result4 = await expressSessionsCollection.deleteMany({ expires: { $exists: false } });
    console.log(`Deleted ${result4.deletedCount} Express sessions with undefined expires (old format)`);
    
    const result5 = await expressSessionsCollection.deleteMany({ expires: null });
    console.log(`Deleted ${result5.deletedCount} Express sessions with null expires`);
    
    const remainingExpress = await expressSessionsCollection.countDocuments();
    console.log(`Remaining Express sessions: ${remainingExpress}`);
    
    // Clean up game sessions
    const gameSessionsCollection = db.collection('game_sessions');
    console.log('Cleaning up game sessions...');
    
    const gameResult1 = await gameSessionsCollection.deleteMany({ sessionId: null });
    console.log(`Deleted ${gameResult1.deletedCount} game sessions with null sessionId`);
    
    const gameResult2 = await gameSessionsCollection.deleteMany({ sessionId: { $exists: false } });
    console.log(`Deleted ${gameResult2.deletedCount} game sessions with undefined sessionId`);
    
    const remainingGame = await gameSessionsCollection.countDocuments();
    console.log(`Remaining game sessions: ${remainingGame}`);
    
    // List remaining sessions for inspection if any
    if (remainingExpress > 0) {
      const sessions = await expressSessionsCollection.find({}).limit(5).toArray();
      console.log('Sample Express sessions:', sessions.map(s => ({ 
        _id: s._id, 
        sessionId: s.sessionId, 
        expires: s.expires 
      })));
    }
    
    if (remainingGame > 0) {
      const gameSessions = await gameSessionsCollection.find({}).limit(5).toArray();
      console.log('Sample game sessions:', gameSessions.map(s => ({ 
        _id: s._id, 
        sessionId: s.sessionId, 
        playerName: s.playerName 
      })));
    }
    
  } catch (error) {
    console.error('Error cleaning up sessions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Done.');
  }
}

cleanupSessions();
