def build_graph(roads):
    """
    Build an undirected weighted graph as an adjacency list.
    Blocked roads are ignored.
    Damaged roads get a higher travel cost.
    """
    graph = {}

    for road in roads:
        status = road.get("status", "open").lower()
        if status == "blocked":
            continue

        start = road["from"]
        end = road["to"]
        distance = float(road["distance"])

        if status == "damaged":
            cost = distance * 1.5
        else:
            cost = distance

        graph.setdefault(start, []).append((end, cost))
        graph.setdefault(end, []).append((start, cost))

    return graph