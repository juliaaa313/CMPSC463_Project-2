from optimizer.graph import build_graph
from optimizer.dijkstra import dijkstra
from optimizer.priority import compute_priority


def run_simulation(data):
    """
    Minimal end-to-end simulation:
    - build graph
    - rank locations by priority
    - find shortest path from DC to each location
    - deliver as much as possible
    - return summary
    """
    distribution_center = data.get("distributionCenter", "Supply D.C.")
    supplies = data.get("supplies", {"food": 0, "medicine": 0})
    locations = data.get("locations", [])
    roads = data.get("roads", [])

    graph = build_graph(roads)

    ranked_locations = []
    for location in locations:
        location_copy = dict(location)
        location_copy["priorityScore"] = compute_priority(location_copy)
        ranked_locations.append(location_copy)

    ranked_locations.sort(key=lambda x: x["priorityScore"], reverse=True)

    remaining_food = int(supplies.get("food", 0))
    remaining_medicine = int(supplies.get("medicine", 0))

    results = []
    optimal_paths = []
    total_distance = 0
    unreachable_locations = []

    for rank, location in enumerate(ranked_locations, start=1):
        name = location["name"]
        food_need = int(location.get("demandFood", 0))
        medicine_need = int(location.get("demandMedicine", 0))

        distance, path = dijkstra(graph, distribution_center, name)

        if distance == float("inf") or not path:
            unreachable_locations.append(name)
            results.append({
                "rank": rank,
                "location": name,
                "priorityScore": location["priorityScore"],
                "route": "Unreachable",
                "travelDistance": 0,
                "deliveredFood": 0,
                "deliveredMedicine": 0,
                "unmetFood": food_need,
                "unmetMedicine": medicine_need,
                "status": "Unreachable"
            })
            continue

        delivered_food = min(remaining_food, food_need)
        delivered_medicine = min(remaining_medicine, medicine_need)

        remaining_food -= delivered_food
        remaining_medicine -= delivered_medicine

        unmet_food = food_need - delivered_food
        unmet_medicine = medicine_need - delivered_medicine

        if unmet_food == 0 and unmet_medicine == 0:
            status = "Delivered"
        else:
            status = "Partially Delivered"

        results.append({
            "rank": rank,
            "location": name,
            "priorityScore": location["priorityScore"],
            "route": " → ".join(path),
            "travelDistance": round(distance, 2),
            "deliveredFood": delivered_food,
            "deliveredMedicine": delivered_medicine,
            "unmetFood": unmet_food,
            "unmetMedicine": unmet_medicine,
            "status": status
        })

        optimal_paths.append(path)
        total_distance += distance

    return {
        "distributionCenter": distribution_center,
        "results": results,
        "summary": {
            "totalTravelDistance": round(total_distance, 2),
            "remainingFood": remaining_food,
            "remainingMedicine": remaining_medicine,
            "locationsServed": sum(1 for r in results if r["status"] != "Unreachable"),
            "unreachableCount": len(unreachable_locations)
        },
        "unreachableLocations": unreachable_locations,
        "optimalPaths": optimal_paths
    }