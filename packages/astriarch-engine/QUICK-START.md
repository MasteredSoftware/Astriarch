# Quick Usage Example for AI Decision Logging

Add this to your existing test file to see what the AI is doing:

```typescript
import { enableAIDebug, getAIDecisionSummary, printAIDecisions } from './testUtils';

describe('Your Test Name', () => {
  beforeEach(() => {
    enableAIDebug(); // Turn on AI logging
  });

  it('your test', () => {
    // Your existing test code...
    const { gameModel } = startNewTestGame();
    
    for (let turn = 0; turn < 10; turn++) {
      advanceGameCycles(gameModel, 1);
    }
    
    // At the end, print what the AI did:
    const summary = getAIDecisionSummary();
    console.log('AI made', summary.total, 'decisions');
    console.log('By category:', summary.byCategory);
    
    // Optionally print all decisions:
    // printAIDecisions();
    
    // Or just specific categories:
    // printAIDecisions('research');   // Show research decisions
    // printAIDecisions('building');   // Show building decisions
    // printAIDecisions('combat');     // Show combat decisions
  });
});
```

That's it! You'll see detailed information about every decision the AI makes during your tests.
