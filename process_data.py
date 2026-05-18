import pyarrow.parquet as pq
import json
import os
from pathlib import Path

MAP_CONFIGS = {
    "AmbroseValley": {"scale": 900, "origin_x": -370, "origin_z": -473},
    "GrandRift": {"scale": 581, "origin_x": -290, "origin_z": -290},
    "Lockdown": {"scale": 1000, "origin_x": -500, "origin_z": -500}
}

def world_to_pixel(x, z, map_id):
    cfg = MAP_CONFIGS[map_id]
    u = (x - cfg["origin_x"]) / cfg["scale"]
    v = (z - cfg["origin_z"]) / cfg["scale"]
    return {
        "x": int(u * 1024),
        "y": int((1 - v) * 1024)
    }

def ts_to_ms(ts):
    return (ts.hour * 3600 + ts.minute * 60 + ts.second) * 1000 + ts.microsecond // 1000

def process_file(filepath):
    t = pq.read_table(filepath)
    df = t.to_pydict()
    
    user_id = df["user_id"][0]
    match_id = df["match_id"][0]
    map_id = df["map_id"][0]
    
    is_uuid_pattern = "-" in user_id and len(user_id) > 10
    is_bot = not is_uuid_pattern
    
    events = []
    
    for i in range(len(df["event"])):
        event_type = df["event"][i].decode('utf-8')
        ts = ts_to_ms(df["ts"][i])
        x, z = df["x"][i], df["z"][i]
        
        # Keep ALL events (no sampling) to show complete player paths
        pixel = world_to_pixel(x, z, map_id)
        
        events.append({
            "type": event_type,
            "px": pixel["x"],
            "py": pixel["y"],
            "ts": ts,
            "x": round(x, 2),
            "z": round(z, 2)
        })
    
    return {
        "user_id": user_id,
        "match_id": match_id,
        "map_id": map_id,
        "is_bot": is_bot,
        "events": events
    }

def process_day(folder):
    output = {}
    files = list(Path(folder).glob("*.nakama-0"))
    
    for f in files:
        try:
            result = process_file(f)
            match_id = result["match_id"]
            
            if match_id not in output:
                output[match_id] = {
                    "match_id": match_id,
                    "map_id": result["map_id"],
                    "date": folder,
                    "players": []
                }
            
            output[match_id]["players"].append({
                "user_id": result["user_id"],
                "is_bot": result["is_bot"],
                "events": result["events"]
            })
        except Exception as e:
            print(f"Error processing {f}: {e}")
    
    return output

for day in ["February_10", "February_11", "February_12", "February_13", "February_14"]:
    print(f"Processing {day}...")
    matches = process_day(f"player_data/{day}")
    
    os.makedirs(f"output/{day}", exist_ok=True)
    for match_id, data in matches.items():
        data["date"] = day
        with open(f"output/{day}/{match_id.replace('.nakama-0', '')}.json", "w") as f:
            json.dump(data, f)
    
    print(f"  {day}: {len(matches)} matches")
