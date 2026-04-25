import heapq


def dijkstra(graph, start, goal):
    """
    Returns the shortest path distance and path from start to goal.
    If a direct edge has the same distance as a multi-node path,
    the direct edge is preferred.
    If unreachable, returns (float('inf'), []).
    """
    if start not in graph or goal not in graph:
        return float("inf"), []

    direct_distance = get_direct_edge_distance(graph, start, goal)

    pq = [(0, 0, start, [start])]
    visited = set()

    while pq:
        current_dist, stops, node, path = heapq.heappop(pq)

        if node in visited:
            continue

        visited.add(node)

        if node == goal:
            if direct_distance is not None and direct_distance == current_dist:
                return direct_distance, [start, goal]

            return current_dist, path

        for neighbor, weight in graph.get(node, []):
            if neighbor not in visited:
                heapq.heappush(
                    pq,
                    (
                        current_dist + weight,
                        stops + 1,
                        neighbor,
                        path + [neighbor],
                    ),
                )

    return float("inf"), []


def get_direct_edge_distance(graph, start, goal):
    for neighbor, weight in graph.get(start, []):
        if neighbor == goal:
            return weight

    return None