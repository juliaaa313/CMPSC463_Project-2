import heapq


def dijkstra(graph, start, goal):
    """
    Returns the shortest path distance and path from start to goal.
    If unreachable, returns (float('inf'), []).
    """
    if start not in graph or goal not in graph:
        return float("inf"), []

    pq = [(0, start, [start])]
    visited = set()

    while pq:
        current_dist, node, path = heapq.heappop(pq)

        if node in visited:
            continue
        visited.add(node)

        if node == goal:
            return current_dist, path

        for neighbor, weight in graph.get(node, []):
            if neighbor not in visited:
                heapq.heappush(pq, (current_dist + weight, neighbor, path + [neighbor]))

    return float("inf"), []