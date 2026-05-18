# Lila Games — Player Behavior Analysis & Insights

> Three data-backed observations from five days of production gameplay (February 10–14, 2026), with actionable takeaways for level designers.

---

## Insight 1: Looting Is Dominating the Combat Loop

### The Observation

Loot events account for **73% of all recorded events** in the dataset — far exceeding kills, deaths, or movement samples combined. With 12,885 loot pick-ups across ~797 matches, players are spending a disproportionate amount of match time farming items rather than fighting or traversing the map.

### Supporting Numbers

| Event Type | Count | % of Total |
|---|---|---|
| Loot | 12,885 | 73.0% |
| BotKill | 2,415 | 13.7% |
| Position | 799 | 4.5% |
| BotKilled | 700 | 4.0% |
| BotPosition | 444 | 2.5% |
| KilledByStorm | 39 | 0.2% |
| Kill (human→human) | 3 | <0.1% |
| Killed (human by human) | 3 | <0.1% |

**In plain terms:** for every single player-vs-player kill, there are ~4,295 loot pick-ups. Even accounting for auto-loot mechanics, this ratio reveals a skewed engagement pattern.

### Actionable Recommendations

1. **Reduce loot density in high-concentration spawn zones** — If the heat-map shows loot clustering near spawns, shrinking that radius forces players outward faster.
2. **Add a per-match loot cap or despawn timer** — This discourages extended farming sessions and pushes players toward combat or extraction.
3. **A/B test a map variant with 30% fewer loot nodes** — Use the human-vs-human kill rate as a proxy for engagement quality.

### Why This Matters for Level Design

The near-zero human kill count is a **level design problem**, not just a combat design problem. If loot is concentrated in safe, peripheral zones, players never need to cross paths. Redistributing high-value loot toward central, contested corridors creates natural routing overlap and drives emergent combat — no mechanic changes required.

---

## Insight 2: AmbroseValley Is Overplayed — GrandRift Is Being Neglected

### The Observation

AmbroseValley appears in **71% of all matches**. GrandRift — one of three available maps — accounts for only **7.4%** of sessions. With so few players encountering it, GrandRift is functionally absent from the live player experience.

### Supporting Numbers

| Map | Match Count | % of All Matches |
|---|---|---|
| AmbroseValley | 567 | 71.1% |
| Lockdown | 171 | 21.5% |
| GrandRift | 59 | 7.4% |

This is not a sampling artifact — the dataset spans five full days and 1,243 player files (~796 unique matches), making the distribution statistically significant.

### Actionable Recommendations

1. **Increase GrandRift's queue weighting by 2–3×** — Monitor whether the re-queue rate drops or holds steady as a signal of player reception.
2. **Run a focused GrandRift-only playtest session** — 59 matches is insufficient for confident routing analysis; ~200 are needed.
3. **Audit GrandRift's opening zones in the tool** — Load all 59 GrandRift matches and compare the traffic heat-map (where players slow down) vs. the death heat-map (where players die early) to identify pacing issues near spawn.

### Why This Matters for Level Design

Every hour spent iterating on GrandRift based on 59 matches is an hour with weak validation. The map cannot be confidently balanced until its data volume matches the other two maps. Fixing the rotation imbalance is a prerequisite for any meaningful evidence-based design work on GrandRift.

---

## Insight 3: Storm Deaths Are Negligible — The Pressure Mechanic Isn't Working

### The Observation

Only **39 `KilledByStorm` events** exist across 797 matches — roughly one storm death every **20 matches**. Storm death coordinates consistently cluster toward the outer edges and corners of the minimap, indicating only players already stranded at map boundaries are being caught.

### Supporting Numbers

```
KilledByStorm events:            39 total across 5 days
Estimated matches with storm death:  ~15–20
Storm death rate per match:          ~0.05
BotKilled events (for comparison):   700

→ Players are 18× more likely to be killed by a bot than by the storm.
```

### Two Competing Hypotheses

**Hypothesis A — Storm is too slow:** Players have ample time to extract safely, so it never becomes a real threat.

**Hypothesis B — Players extract too early:** Players leave before engaging mid/late-game content, making the storm irrelevant.

The visualization tool can help distinguish these: in matches *without* storm deaths, check how much of the normalized timeline (0–100%) human paths cover before the last recorded event. If paths end at 20–30%, that supports Hypothesis B.

### Actionable Recommendations

**If Hypothesis A (storm too slow):**
1. Accelerate storm contraction in the final third of the match — target ~1 storm death per 5 matches.
2. Improve storm boundary warning signals (UI/audio cues).
3. Relocate high-value loot toward map center to pull players inward before extraction.

**If Hypothesis B (players extract too early):**
1. Add a time-gate or delay to extraction points — prevent extraction in the first 25% of a match.
2. Introduce mid-map high-stakes content (boss zones, event caches) to pull players away from early exit routes.

### Why This Matters for Level Design

The storm is the most powerful pacing tool available to a level designer. If it generates no meaningful eliminations, it's not compressing the safe zone, not forcing routing decisions, and not creating urgency. Restoring it as a genuine spatial threat changes the role of every map zone — edges become dangerous, center becomes valuable, and extraction timing becomes a real in-match decision.

---

*All statistics are derived from 1,243 parquet files covering February 10–14, 2026 (796 unique matches). Coordinates converted to pixel space using the formula in [ARCHITECTURE.md](ARCHITECTURE.md).*
