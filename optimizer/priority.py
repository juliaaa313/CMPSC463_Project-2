URGENCY_WEIGHTS = {
    "critical": 100,
    "high": 70,
    "medium": 40,
    "low": 20,
}

RESOURCE_WEIGHTS = {
    "food": 1.0,
    "medicine": 1.2,
    "water": 1.1,
    "blankets": 0.8,
}


def compute_priority(location):
    urgency = str(location.get("urgency", "low")).lower()
    urgency_score = URGENCY_WEIGHTS.get(urgency, URGENCY_WEIGHTS["low"])

    demand_score = 0

    for resource, weight in RESOURCE_WEIGHTS.items():
        key = f"demand{resource.capitalize()}"
        demand = location.get(key, 0)
        demand_score += demand * weight

    return urgency_score + demand_score