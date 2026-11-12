# Evals

| Layer | Question | How | Status |
| --- | --- | --- | --- |
| 1. Trigger | Does Claude load the skill at the right time? | `triggers.json`: 10 prompts that should load it, 10 that shouldn't. Target 9 of 10 each side. | Prompt set written, not yet scored |
| 2. Correctness | Does it catch real bugs without crying wolf? | `node scripts/check.js`: every seeded bug in the 3 examples is flagged, the fixed versions come back clean, each sheet renders in under 30 s. | Passing (9 seeded bugs found, 0 false flags) |
| 3. Better than nothing | Does a review with the skill find more than a review without it? | 5 components with hidden bugs, reviewed with and without the skill, 3 runs each. Count bugs found and false alarms. Ship rule: with-skill finds more in 4 of 5. | Not yet run |

## Taste tests

- **Almost-right pairs:** components where one state is subtly off (focus ring 1 px, loading 4 px narrower). The sheet plus Claude's look pass should name the off cell.
- **Next to the best:** the sheet itself should look like something a design team would pin up, not a test log.
