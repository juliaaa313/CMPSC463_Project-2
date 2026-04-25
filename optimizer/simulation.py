from optimizer.graph import build_graph
from optimizer.dijkstra import dijkstra
from optimizer.priority import compute_priority


def run_simulation(data):
    """
    End-to-end simulation:
    - build graph
    - rank locations based on selected optimization mode
    - find shortest path from DC to each location
    - distribute food, medicine, water, and blankets
    - return delivery plan summary
    """
    distribution_center = data.get("distributionCenter", "Supply D.C.")
    optimization_mode = data.get("optimizationMode", "balanced")
    supplies = data.get("supplies", {})
    locations = data.get("locations", [])
    roads = data.get("roads", [])

    graph = build_graph(roads)

    ranked_locations = build_ranked_locations(
        locations,
        graph,
        distribution_center,
        optimization_mode,
    )

    remaining_food = int(supplies.get("food", 0))
    remaining_medicine = int(supplies.get("medicine", 0))
    remaining_water = int(supplies.get("water", 0))
    remaining_blankets = int(supplies.get("blankets", 0))

    results = []
    optimal_paths = []
    total_distance = 0
    unreachable_locations = []

    for rank, location in enumerate(ranked_locations, start=1):
        name = location.get("name", "Unknown Location")

        food_need = int(location.get("demandFood", 0))
        medicine_need = int(location.get("demandMedicine", 0))
        water_need = int(location.get("demandWater", 0))
        blankets_need = int(location.get("demandBlankets", 0))

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
                "deliveredWater": 0,
                "deliveredBlankets": 0,
                "unmetFood": food_need,
                "unmetMedicine": medicine_need,
                "unmetWater": water_need,
                "unmetBlankets": blankets_need,
                "status": "Unreachable",
            })
            continue

        delivered_food = min(remaining_food, food_need)
        delivered_medicine = min(remaining_medicine, medicine_need)
        delivered_water = min(remaining_water, water_need)
        delivered_blankets = min(remaining_blankets, blankets_need)

        remaining_food -= delivered_food
        remaining_medicine -= delivered_medicine
        remaining_water -= delivered_water
        remaining_blankets -= delivered_blankets

        unmet_food = food_need - delivered_food
        unmet_medicine = medicine_need - delivered_medicine
        unmet_water = water_need - delivered_water
        unmet_blankets = blankets_need - delivered_blankets

        status = get_allocation_status(
            delivered_food,
            delivered_medicine,
            delivered_water,
            delivered_blankets,
            unmet_food,
            unmet_medicine,
            unmet_water,
            unmet_blankets,
        )

        results.append({
            "rank": rank,
            "location": name,
            "priorityScore": location["priorityScore"],
            "route": " → ".join(path),
            "travelDistance": round(distance, 2),
            "deliveredFood": delivered_food,
            "deliveredMedicine": delivered_medicine,
            "deliveredWater": delivered_water,
            "deliveredBlankets": delivered_blankets,
            "unmetFood": unmet_food,
            "unmetMedicine": unmet_medicine,
            "unmetWater": unmet_water,
            "unmetBlankets": unmet_blankets,
            "status": status,
        })

        optimal_paths.append(path)
        total_distance += distance

    return {
        "distributionCenter": distribution_center,
        "optimizationMode": optimization_mode,
        "results": results,
        "summary": {
            "totalTravelDistance": round(total_distance, 2),
            "remainingFood": remaining_food,
            "remainingMedicine": remaining_medicine,
            "remainingWater": remaining_water,
            "remainingBlankets": remaining_blankets,
            "locationsServed": count_served_locations(results),
            "unreachableCount": len(unreachable_locations),
        },
        "unreachableLocations": unreachable_locations,
        "optimalPaths": optimal_paths,
    }


def build_ranked_locations(locations, graph, distribution_center, optimization_mode):
    ranked_locations = []

    for location in locations:
        location_copy = dict(location)
        name = location_copy.get("name", "")

        distance, _ = dijkstra(graph, distribution_center, name)

        location_copy["priorityScore"] = compute_priority(location_copy)
        location_copy["distanceFromDC"] = distance

        ranked_locations.append(location_copy)

    if optimization_mode == "urgency-first":
        ranked_locations.sort(
            key=lambda location: (
                get_urgency_weight(location.get("urgency", "Low")),
                location["priorityScore"],
                -safe_distance(location["distanceFromDC"]),
            ),
            reverse=True,
        )

    elif optimization_mode == "distance-first":
        ranked_locations.sort(
            key=lambda location: (
                safe_distance(location["distanceFromDC"]),
                -location["priorityScore"],
            ),
        )

    else:
        ranked_locations.sort(
            key=lambda location: (
                location["priorityScore"] - safe_distance(location["distanceFromDC"]),
            ),
            reverse=True,
        )

    return ranked_locations


def get_urgency_weight(urgency):
    urgency_weights = {
        "critical": 4,
        "high": 3,
        "medium": 2,
        "low": 1,
    }

    return urgency_weights.get(str(urgency).lower(), 1)


def safe_distance(distance):
    if distance == float("inf"):
        return 999999
    return distance


def count_served_locations(results):
    served_count = 0

    for result in results:
        total_delivered = (
            result.get("deliveredFood", 0)
            + result.get("deliveredMedicine", 0)
            + result.get("deliveredWater", 0)
            + result.get("deliveredBlankets", 0)
        )

        if total_delivered > 0:
            served_count += 1

    return served_count


def get_allocation_status(
    delivered_food,
    delivered_medicine,
    delivered_water,
    delivered_blankets,
    unmet_food,
    unmet_medicine,
    unmet_water,
    unmet_blankets,
):
    total_delivered = (
        delivered_food
        + delivered_medicine
        + delivered_water
        + delivered_blankets
    )

    total_unmet = (
        unmet_food
        + unmet_medicine
        + unmet_water
        + unmet_blankets
    )

    if total_delivered == 0:
        return "No Supplies Available"

    if total_unmet == 0:
        return "Planned Full Supply"

    return "Planned Partial Supply"