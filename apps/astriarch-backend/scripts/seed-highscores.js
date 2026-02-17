#!/usr/bin/env node

// Script to insert sample high score data for development/testing
const mongoose = require('mongoose');

const SAMPLE_SCORES = [
  { playerName: 'StarConqueror',    playerId: 'test-player-1',  playerPoints: 4250, playerWon: true,  daysAgo: 0 },
  { playerName: 'NebulaQueen',      playerId: 'test-player-2',  playerPoints: 3180, playerWon: true,  daysAgo: 1 },
  { playerName: 'VoidWalker',       playerId: 'test-player-3',  playerPoints: 2750, playerWon: false, daysAgo: 2 },
  { playerName: 'CosmicDrifter',    playerId: 'test-player-4',  playerPoints: 2340, playerWon: true,  daysAgo: 3 },
  { playerName: 'AstroNomad',       playerId: 'test-player-5',  playerPoints: 1920, playerWon: false, daysAgo: 5 },
  { playerName: 'GalacticOverlord', playerId: 'test-player-6',  playerPoints: 3800, playerWon: true,  daysAgo: 10 },
  { playerName: 'PlanetCrusher',    playerId: 'test-player-7',  playerPoints: 3500, playerWon: true,  daysAgo: 14 },
  { playerName: 'DarkMatter',       playerId: 'test-player-8',  playerPoints: 2100, playerWon: false, daysAgo: 20 },
  { playerName: 'SolarFlare',       playerId: 'test-player-9',  playerPoints: 1650, playerWon: false, daysAgo: 30 },
  { playerName: 'OrbitBreaker',     playerId: 'test-player-10', playerPoints: 1200, playerWon: true,  daysAgo: 60 },
];

async function seedHighScores() {
  const mongoUrl = 'mongodb://127.0.0.1:27017/astriarch_v2_dev';

  console.log('Connecting to MongoDB...');

  try {
    await mongoose.connect(mongoUrl);
    const db = mongoose.connection.db;
    const collection = db.collection('highscores');

    const existing = await collection.countDocuments();
    console.log(`Existing high scores: ${existing}`);

    const docs = SAMPLE_SCORES.map((s) => ({
      playerName: s.playerName,
      playerId: s.playerId,
      playerPoints: s.playerPoints,
      playerWon: s.playerWon,
      gameId: new mongoose.Types.ObjectId(),
      createdAt: new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000),
    }));

    const result = await collection.insertMany(docs);
    console.log(`Inserted ${result.insertedCount} high score entries.`);

    // Show what was inserted
    const allScores = await collection.find({}).sort({ playerPoints: -1 }).toArray();
    console.log('\nAll high scores (by points desc):');
    allScores.forEach((s, i) => {
      const age = Math.round((Date.now() - new Date(s.createdAt).getTime()) / (24 * 60 * 60 * 1000));
      console.log(
        `  ${i + 1}. ${s.playerName.padEnd(20)} ${String(s.playerPoints).padStart(5)} pts  ${s.playerWon ? 'WON' : 'LOST'}  ${age}d ago`
      );
    });

    // Preview what the API would return
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = allScores.filter((s) => new Date(s.createdAt) > sevenDaysAgo);
    console.log(`\nRecent (last 7 days): ${recent.length} entries`);
    console.log(`All time: ${allScores.length} entries`);
  } catch (error) {
    console.error('Error seeding high scores:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDone.');
  }
}

seedHighScores();
