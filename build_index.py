import json
import os
from pathlib import Path
from collections import defaultdict

index = {"dates": {}, "maps": defaultdict(list), "total_matches": 0}

for day in ["February_10", "February_11", "February_12", "February_13", "February_14"]:
    index["dates"][day] = []
    day_path = Path(f"output/{day}")
    
    for f in day_path.glob("*.json"):
        with open(f) as fp:
            data = json.load(fp)
            map_id = data["map_id"]
            match_info = {
                "match_id": data["match_id"],
                "map_id": map_id,
                "date": day,
                "player_count": len(data["players"]),
                "human_count": sum(1 for p in data["players"] if not p["is_bot"]),
                "bot_count": sum(1 for p in data["players"] if p["is_bot"])
            }
            index["dates"][day].append(match_info)
            index["maps"][map_id].append(match_info)
            index["total_matches"] += 1

index["maps"] = dict(index["maps"])

with open("output/index.json", "w") as f:
    json.dump(index, f, indent=2)

print(f"Total matches: {index['total_matches']}")
print(f"Maps: {list(index['maps'].keys())}")
for day, matches in index["dates"].items():
    print(f"  {day}: {len(matches)} matches")
