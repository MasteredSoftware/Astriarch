#!/usr/bin/env node
/**
 * AI Decision Analyzer
 * 
 * Analyzes the AI decisions JSON file and provides insights.
 * Usage: node analyze-ai-decisions.js [filepath]
 */

const fs = require('fs');
const path = require('path');

const filepath = process.argv[2] || './ai-decisions-easy-vs-expert.json';

if (!fs.existsSync(filepath)) {
  console.error(`❌ File not found: ${filepath}`);
  process.exit(1);
}

console.log(`\n📊 Analyzing AI decisions from: ${filepath}\n`);

const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

console.log('=== SUMMARY ===');
console.log(`Total Decisions: ${data.total}`);
console.log(`\nDecisions by Category:`);
Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).forEach(([category, count]) => {
  const percent = ((count / data.total) * 100).toFixed(1);
  console.log(`  ${category.padEnd(15)}: ${count.toString().padStart(5)} (${percent}%)`);
});

console.log(`\nDecisions by Player:`);
Object.entries(data.byPlayer).forEach(([player, count]) => {
  const percent = ((count / data.total) * 100).toFixed(1);
  console.log(`  ${player.padEnd(15)}: ${count.toString().padStart(5)} (${percent}%)`);
});

// Analyze research decisions
const researchDecisions = data.decisions.filter(d => d.category === 'research' && d.decision === 'Set research percentage');
const avgResearchByPlayer = {};
researchDecisions.forEach(d => {
  if (!avgResearchByPlayer[d.playerName]) {
    avgResearchByPlayer[d.playerName] = { sum: 0, count: 0 };
  }
  avgResearchByPlayer[d.playerName].sum += d.details.adjustedPercent;
  avgResearchByPlayer[d.playerName].count++;
});

console.log(`\n=== RESEARCH ANALYSIS ===`);
Object.entries(avgResearchByPlayer).forEach(([player, stats]) => {
  const avg = (stats.sum / stats.count * 100).toFixed(1);
  console.log(`${player} average research: ${avg}%`);
});

// Analyze energy adjustments
const energyAdjusted = researchDecisions.filter(d => d.details.wasAdjusted);
console.log(`\nResearch adjusted for energy: ${energyAdjusted.length} times (${((energyAdjusted.length / researchDecisions.length) * 100).toFixed(1)}%)`);

// Research by player
const researchByPlayer = {};
researchDecisions.forEach(d => {
  if (!researchByPlayer[d.playerName]) {
    researchByPlayer[d.playerName] = { total: 0, energyAdjusted: 0 };
  }
  researchByPlayer[d.playerName].total++;
  if (d.details.wasAdjusted) researchByPlayer[d.playerName].energyAdjusted++;
});

console.log('\nBy player:');
Object.entries(researchByPlayer).forEach(([player, stats]) => {
  const adjustedPercent = ((stats.energyAdjusted / stats.total) * 100).toFixed(1);
  console.log(`  ${player}: ${stats.energyAdjusted}/${stats.total} adjusted for energy (${adjustedPercent}%)`);
});
// Analyze building decisions
const buildingDecisions = data.decisions.filter(d => d.category === 'building');
const improvementBuilds = buildingDecisions.filter(d => d.decision === 'Set improvement build goal');
const shipBuilds = buildingDecisions.filter(d => d.decision === 'Set ship build goal');
const productionEnqueued = buildingDecisions.filter(d => d.decision === 'Enqueued production item');

console.log(`\n=== BUILDING ANALYSIS ===`);
console.log(`Improvement goals set: ${improvementBuilds.length}`);
console.log(`Ship goals set: ${shipBuilds.length}`);
console.log(`Items actually built: ${productionEnqueued.length}`);

// Building by player
const buildingByPlayer = {};
buildingDecisions.forEach(d => {
  if (!buildingByPlayer[d.playerName]) {
    buildingByPlayer[d.playerName] = { improvementGoals: 0, shipGoals: 0, itemsBuilt: 0 };
  }
  if (d.decision === 'Set improvement build goal') buildingByPlayer[d.playerName].improvementGoals++;
  if (d.decision === 'Set ship build goal') buildingByPlayer[d.playerName].shipGoals++;
  if (d.decision === 'Enqueued production item') buildingByPlayer[d.playerName].itemsBuilt++;
});

console.log('\nBy player:');
Object.entries(buildingByPlayer).forEach(([player, stats]) => {
  console.log(`  ${player}: ${stats.improvementGoals} improvements, ${stats.shipGoals} ships, ${stats.itemsBuilt} built`);
});

// Analyze combat decisions
const combatDecisions = data.decisions.filter(d => d.category === 'combat');
const attacks = combatDecisions.filter(d => d.decision === 'Sent attack fleet');
const coordinated = combatDecisions.filter(d => d.decision === 'Sent coordinated attack fleet');

console.log(`\n=== COMBAT ANALYSIS ===`);
console.log(`Total attacks: ${attacks.length}`);
console.log(`Coordinated attacks: ${coordinated.length}`);

// Combat by player
const combatByPlayer = {};
combatDecisions.forEach(d => {
  if (!combatByPlayer[d.playerName]) {
    combatByPlayer[d.playerName] = { attacks: 0, coordinated: 0 };
  }
  if (d.decision === 'Sent attack fleet') combatByPlayer[d.playerName].attacks++;
  if (d.decision === 'Sent coordinated attack fleet') combatByPlayer[d.playerName].coordinated++;
});

console.log('\nBy player:');
Object.entries(combatByPlayer).forEach(([player, stats]) => {
  console.log(`  ${player}: ${stats.attacks} attacks, ${stats.coordinated} coordinated`);
});

if (attacks.length > 0) {
  const validAdvantages = attacks
    .map(d => d.details.strengthAdvantage)
    .filter(adv => adv !== 'Undefended' && adv !== 'Infinity' && !isNaN(parseFloat(adv)));
  
  const undefendedAttacks = attacks.filter(d => 
    d.details.strengthAdvantage === 'Undefended' || 
    d.details.strengthAdvantage === 'Infinity' ||
    d.details.enemyStrength === 0
  ).length;
  
  if (validAdvantages.length > 0) {
    const avgStrengthAdvantage = validAdvantages.reduce((sum, adv) => sum + parseFloat(adv), 0) / validAdvantages.length;
    console.log(`\nAverage strength advantage: ${avgStrengthAdvantage.toFixed(2)}x (${validAdvantages.length} defended targets)`);
  }
  
  if (undefendedAttacks > 0) {
    console.log(`Attacks on undefended planets: ${undefendedAttacks}`);
  }
}

// Analyze exploration
const exploration = data.decisions.filter(d => d.category === 'exploration');
console.log(`\n=== EXPLORATION ANALYSIS ===`);
console.log(`Scout fleets sent: ${exploration.length}`);

// Exploration by player
const explorationByPlayer = {};
exploration.forEach(d => {
  explorationByPlayer[d.playerName] = (explorationByPlayer[d.playerName] || 0) + 1;
});

console.log('\nBy player:');
Object.entries(explorationByPlayer).forEach(([player, count]) => {
  console.log(`  ${player}: ${count} scouts`);
});

// Turn analysis - find interesting patterns
const turnKeys = Object.keys(data.byTurn).map(Number).sort((a, b) => a - b);
const firstTurn = turnKeys[0];
const lastTurn = turnKeys[turnKeys.length - 1];
const gameLength = Math.floor(lastTurn);

console.log(`\n=== GAME TIMELINE ===`);
console.log(`Game lasted: ${gameLength} turns`);
console.log(`Average decisions per turn: ${(data.total / gameLength).toFixed(1)}`);

// Find most active turns
const topTurns = Object.entries(data.byTurn)
  .map(([turn, count]) => ({ turn: parseFloat(turn), count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 5);

console.log(`\nMost active turns:`);
topTurns.forEach(({ turn, count }) => {
  console.log(`  Turn ${Math.floor(turn)}: ${count} decisions`);
});

// Find player-specific patterns
console.log(`\n=== PLAYER-SPECIFIC PATTERNS ===`);
['Matt', 'Computer1'].forEach(playerName => {
  const playerDecisions = data.decisions.filter(d => d.playerName === playerName);
  if (playerDecisions.length === 0) return;
  
  const categories = {};
  playerDecisions.forEach(d => {
    categories[d.category] = (categories[d.category] || 0) + 1;
  });
  
  console.log(`\n${playerName}:`);
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    const percent = ((count / playerDecisions.length) * 100).toFixed(1);
    console.log(`  ${cat.padEnd(15)}: ${count.toString().padStart(4)} (${percent}%)`);
  });
});

console.log(`\n✅ Analysis complete!\n`);

// Export summary
const summary = {
  totalDecisions: data.total,
  gameLength,
  byCategory: data.byCategory,
  byPlayer: data.byPlayer,
  research: {
    avgResearchPercent: Object.fromEntries(
      Object.entries(avgResearchByPlayer).map(([player, stats]) => 
        [player, (stats.sum / stats.count * 100).toFixed(1)]
      )
    ),
    byPlayer: researchByPlayer
  },
  building: {
    improvementGoals: improvementBuilds.length,
    shipGoals: shipBuilds.length,
    itemsBuilt: productionEnqueued.length,
    byPlayer: buildingByPlayer
  },
  combat: {
    totalAttacks: attacks.length,
    coordinatedAttacks: coordinated.length,
    undefendedAttacks: attacks.filter(d => 
      d.details.strengthAdvantage === 'Undefended' || 
      d.details.strengthAdvantage === 'Infinity' ||
      d.details.enemyStrength === 0
    ).length,
    avgStrengthAdvantage: (() => {
      const validAdvantages = attacks
        .map(d => d.details.strengthAdvantage)
        .filter(adv => adv !== 'Undefended' && adv !== 'Infinity' && !isNaN(parseFloat(adv)));
      
      return validAdvantages.length > 0
        ? (validAdvantages.reduce((sum, adv) => sum + parseFloat(adv), 0) / validAdvantages.length).toFixed(2)
        : 'N/A';
    })(),
    byPlayer: combatByPlayer
  },
  exploration: {
    scoutsSent: exploration.length,
    byPlayer: explorationByPlayer
  }
};

fs.writeFileSync(
  filepath.replace('.json', '-summary.json'),
  JSON.stringify(summary, null, 2)
);
console.log(`📄 Summary saved to: ${filepath.replace('.json', '-summary.json')}\n`);
