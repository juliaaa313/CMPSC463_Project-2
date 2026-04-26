from optimizer.graph import build_graph
from optimizer.dijkstra import dijkstra
from optimizer.priority import compute_priority, URGENCY_WEIGHTS


def run_simulation(data):
    """
    End-to-end simulation:
    - build graph
    - choose delivery order based on optimization mode
    - create a sequential route
    - distribute food, medicine, water, and blankets
    - return to the distribution center after the last delivery
    - return delivery plan summary
    """
    distribution_center = data.get("distributionCenter", "Supply D.C.")
    optimization_mode = data.get("optimizationMode", "balanced")
    supplies = data.get("supplies", {})
    locations = data.get("locations", [])
    roads = data.get("roads", [])

    graph = build_graph(roads)
    remaining_locations = prepare_locations(locations)

    remaining_food = int(supplies.get("food", 0))
    remaining_medicine = int(supplies.get("medicine", 0))
    remaining_water = int(supplies.get("water", 0))
    remaining_blankets = int(supplies.get("blankets", 0))

    results = []
    optimal_paths = []
    total_distance = 0
    unreachable_locations = []

    current_position = distribution_center
    rank = 1

    while remaining_locations:
        next_location, distance, path = choose_next_location(
            remaining_locations,
            graph,
            current_position,
            optimization_mode,
        )

        if next_location is None:
            for location in remaining_locations:
                name = location.get("name", "Unknown Location")
                food_need, medicine_need, water_need, blankets_need = get_location_needs(location)

                unreachable_locations.append(name)

                results.append({
                    "rank": None,
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

            break

        name = next_location.get("name", "Unknown Location")
        food_need, medicine_need, water_need, blankets_need = get_location_needs(next_location)

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
            "priorityScore": next_location["priorityScore"],
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
        current_position = name

        remaining_locations = [
            location
            for location in remaining_locations
            if location.get("name") != name
        ]

        rank += 1

    return_distance, return_path = dijkstra(
        graph,
        current_position,
        distribution_center,
    )

    if current_position != distribution_center:
        if return_path:
            optimal_paths.append(return_path)
            total_distance += return_distance
        else:
            unreachable_locations.append("Return to Distribution Center")

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


def prepare_locations(locations):
    prepared_locations = []

    for location in locations:
        location_copy = dict(location)
        location_copy["priorityScore"] = compute_priority(location_copy)
        prepared_locations.append(location_copy)

    return prepared_locations


def choose_next_location(locations, graph, current_position, optimization_mode):
    candidates = []

    for location in locations:
        name = location.get("name", "")
        distance, path = dijkstra(graph, current_position, name)

        if distance == float("inf") or not path:
            continue

        candidates.append({
            "location": location,
            "distance": distance,
            "path": path,
        })

    if not candidates:
        return None, 0, []

    if optimization_mode == "urgency-first":
        candidates.sort(
            key=lambda candidate: (
                get_urgency_score(candidate["location"].get("urgency", "low")),
                candidate["location"]["priorityScore"],
                -candidate["distance"],
            ),
            reverse=True,
        )

    elif optimization_mode == "distance-first":
        candidates.sort(
            key=lambda candidate: (
                candidate["distance"],
                -candidate["location"]["priorityScore"],
            ),
        )

    else:
        candidates.sort(
            key=lambda candidate: compute_balanced_score(
                candidate["location"],
                candidate["distance"],
            ),
            reverse=True,
        )

    best = candidates[0]
    return best["location"], best["distance"], best["path"]


def compute_balanced_score(location, distance):
    return location["priorityScore"] - distance


def get_urgency_score(urgency):
    urgency = str(urgency).lower()
    return URGENCY_WEIGHTS.get(urgency, URGENCY_WEIGHTS["low"])


def get_location_needs(location):
    food_need = int(location.get("demandFood", 0))
    medicine_need = int(location.get("demandMedicine", 0))
    water_need = int(location.get("demandWater", 0))
    blankets_need = int(location.get("demandBlankets", 0))

    return food_need, medicine_need, water_need, blankets_need


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