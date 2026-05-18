# Insights — LILA BLACK Player Behavior Analysis

> Three data-backed observations from 5 days of production gameplay (Feb 10–14, 2026),
> with actionable takeaways for level designers.

---

## Insight 1: Looting is Overwhelming the Combat Loop

### What caught my eye

Loot events account for **73% of all recorded events** in the dataset — far beyond any other category, including kills, deaths, and even movement samples. At a total of 12,885 loot pick-ups across ~797 matches, players are spending a disproportionate amount of match time looting rather than fighting or traversing.

### The numbers

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

**Put another way:** for every 1 player-vs-player kill, there are ~4,295 loot pick-ups. Even if some loot events are automated (auto-loot on kill), the ratio is dramatically skewed.

### Can we draw something actionable?

**Yes.** The loot density is creating a "loot loop" that delays engagement. Players are spending match time farming items rather than progressing toward objectives or extraction.

**Metrics affected:**
- Average engagement time per match
- Human-vs-human kill rate (currently near zero at 3 events over 5 days)
- Match completion / extraction rate
- Time-to-first-contact

**Actionable items:**
1. **Reduce loot node count in high-density areas** — if the minimap heat-map shows loot clustering near spawn points, shrink the spawn radius so players are forced outward faster.
2. **Add a per-match loot cap or loot despawn timer** — incentivises early extraction over extended farming.
3. **A/B test: one map variant with 30% fewer loot nodes** — measure whether human kill rate increases (a proxy for engagement quality).

### Why a level designer should care

The near-zero human-vs-human kill count isn't just a combat design problem — it's a **level design problem**. If loot is concentrated in safe, edge-of-map zones, players never need to cross paths. Redistribution of loot toward central, contested corridors would force routing overlap and drive emergent combat without changing game mechanics at all.

---

## Insight 2: AmbroseValley Dominates Play — GrandRift is Being Ignored

### What caught my eye

AmbroseValley appears in **71% of all matches**. GrandRift — one of the three available maps — is played in only **7.4%** of sessions. With nearly 1 in 10 players never touching it in a given day, GrandRift is effectively absent from the player experience.

### The numbers

| Map | Match Count | % of All Matches |
|---|---|---|
| AmbroseValley | 567 | 71.1% |
| Lockdown | 171 | 21.5% |
| GrandRift | 59 | 7.4% |

This isn't a selection-bias artifact — the dataset spans 5 full days and 1,243 files, giving 796+ unique matches a robust sample.

### Can we draw something actionable?

**Yes.** At 7.4% share, GrandRift is not reaching players enough to generate useful behavioral data, and any design work on it is effectively unvalidated at scale.

**Metrics affected:**
- Map rotation equity
- Per-map retention / re-queue rate
- Level designer iteration velocity (can't fix a map without data)

**Actionable items:**
1. **Force-rotate GrandRift into the queue more aggressively** — if the matchmaker allows preferences, add a queue-balance weight to increase GrandRift exposure by 2–3×. Measure whether re-queue rate drops, stays flat, or improves.
2. **Run a focused playtest on GrandRift** — recruit players for a GrandRift-only session. The current dataset offers only 59 matches of GrandRift signal; you need ~200 to identify routing patterns with confidence.
3. **Audit GrandRift's first-impression moments** — with the viewer tool, load all 59 GrandRift matches and look at where players slow down (traffic heat-map) vs. where they die early (deaths heat-map). If deaths cluster near the spawn, the opening area may be too exposed.

### Why a level designer should care

Every hour spent tuning GrandRift based on 59 matches is an hour with weak validation. The map cannot be confidently balanced until the data volume matches the other two maps. Fixing the rotation imbalance is a prerequisite for any informed iteration on GrandRift's layout.

---

## Insight 3: Storm Deaths Are an Edge Problem — Extraction Pressure Isn't Working

### What caught my eye

There are only **39 `KilledByStorm` events** across 797 matches and 1,243 player files. That is roughly one storm death every **20 matches**. The storm is meant to be a constant, map-reshaping pressure mechanic — but statistically, almost no one is dying to it.

More telling: when storm deaths *do* occur, the pixel coordinates consistently cluster toward the outer edges and corners of the minimap (e.g., AmbroseValley px ≈ 890, py ≈ 890; px ≈ 100, py ≈ 950 range), consistent with players stranded at map boundaries.

### The numbers

```
KilledByStorm events: 39 total across 5 days
Matches with at least one storm death: ~15–20 (estimated)
Storm death rate per match: ~0.05 per match
```

Compare with BotKilled (700 events) — players are 18× more likely to be killed by a bot than by the storm. The storm is not functioning as a meaningful elimination mechanic.

### Can we draw something actionable?

**Yes.** There are two competing possible explanations — and both have different design responses:

**Hypothesis A — Storm is too slow / too gentle:** Players have plenty of time to extract before the storm reaches them, so it never becomes a real threat.

**Hypothesis B — Players are extracting too early (too much pressure):** Players leave before engaging the map's middle and late-game content, making the storm irrelevant because they're already gone.

The viewer tool can help distinguish these: in matches *without* storm deaths, look at how much of the match timeline (0–100%) is covered by human position events before the last event. If human paths end at 20–30% of the match timeline, that's Hypothesis B.

**Metrics affected:**
- Match duration
- Storm death rate (direct KPI)
- Engagement with mid/late-map content (loot in contested zones, human kills)
- Extraction timing distribution

**Actionable items (Hypothesis A — storm is too slow):**
1. **Accelerate storm speed in the final third of the match** — target a storm death rate of ~1 per 5 matches as a design goal.
2. **Add storm warning UI tuning** — if players are caught by surprise at edges, improve edge-zone indicators.
3. **Add extraction incentives further from edges** — move high-value loot toward center so players must commit to mid-map before safe exit.

**Actionable items (Hypothesis B — players extract too early):**
1. **Review extraction point timing gates** — if players can extract in the first 25% of a match, add an extraction delay or locked-gate mechanic.
2. **Add high-stakes mid-map content** (boss zones, event loot caches) to pull players away from early extraction.

### Why a level designer should care

The storm is your most powerful pacing tool. If it's not eliminating players, it's not doing layout work — it's not compressing the safe zone, not forcing routing decisions, not creating urgency. A storm that 95%+ of players ignore is a mechanic that exists only on paper. Restoring it as a real spatial threat changes the function of every map zone: edges become genuinely dangerous, center-map becomes valuable as a safe corridor, and extraction timing becomes a real decision rather than a default.

---

*All statistics derived from 1,243 parquet files across February 10–14, 2026 (796 unique matches). Coordinates converted to pixel space using the formula in ARCHITECTURE.md.*
