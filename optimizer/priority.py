URGENCY_WEIGHTS = {
    "critical": 100,
    "high": 70,
    "medium": 40,
    "low": 20,
}


def compute_priority(location):
    urgency = location.get("urgency", "low").lower()
    food_demand = location.get("demandFood", 0)
    medicine_demand = location.get("demandMedicine", 0)

    urgency_score = URGENCY_WEIGHTS.get(urgency, 20)
    demand_bonus = food_demand + medicine_demand

    return urgency_score + demand_bonus