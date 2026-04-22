function renderOptimizationResult(result, payload) {
  const container = document.getElementById("results-container");

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card small-card">
        <h4>Total Travel Distance</h4>
        <p>${result.summary?.totalTravelDistance ?? 0} miles</p>
      </div>
      <div class="summary-card small-card">
        <h4>Locations Served</h4>
        <p>${result.summary?.locationsServed ?? 0}</p>
      </div>
      <div class="summary-card small-card">
        <h4>Unreachable Locations</h4>
        <p>${result.summary?.unreachableCount ?? 0}</p>
      </div>
      <div class="summary-card small-card">
        <h4>Optimization Mode</h4>
        <p>${formatMode(payload.optimizationMode)}</p>
      </div>
    </div>

    <h3 class="subheading">Remaining Supplies</h3>
    <div class="remaining-grid">
      <div class="mini-summary-box">Food: ${result.summary?.remainingFood ?? 0}</div>
      <div class="mini-summary-box">Medicine: ${result.summary?.remainingMedicine ?? 0}</div>
      <div class="mini-summary-box">Water: ${payload.supplies?.water ?? 0}</div>
      <div class="mini-summary-box">Blankets: ${payload.supplies?.blankets ?? 0}</div>
    </div>

    <h3 class="subheading">Results Table</h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Location</th>
            <th>Priority</th>
            <th>Distance</th>
            <th>Food</th>
            <th>Medicine</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${(result.results || [])
            .map(
              (row) => `
            <tr>
              <td>${row.rank}</td>
              <td>${row.location}</td>
              <td>${row.priorityScore}</td>
              <td>${row.travelDistance}</td>
              <td>${row.deliveredFood}</td>
              <td>${row.deliveredMedicine}</td>
              <td>${row.status}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <h3 class="subheading">Optimal Route Graph</h3>
    <div class="graph-box optimal-graph-box">
      <svg id="optimal-route-graph" viewBox="0 0 700 360" class="graph-svg"></svg>
    </div>
  `;

  // render graph AFTER inserting HTML
  renderOptimalRouteGraph(
    payload.distributionCenter,
    payload.locations,
    result.optimalPaths || [],
  );
}

function renderSummary(result, payload) {
  document.getElementById("summary-distance").textContent =
    `${result.summary?.totalTravelDistance ?? 0} miles`;

  document.getElementById("summary-served").textContent =
    `${result.summary?.locationsServed ?? 0}`;

  document.getElementById("summary-unreachable").textContent =
    `${result.summary?.unreachableCount ?? 0}`;

  const prettyMode = formatMode(payload.optimizationMode || "balanced");
  document.getElementById("summary-mode").textContent = prettyMode;

  document.getElementById("remaining-food").textContent =
    `${result.summary?.remainingFood ?? 0}`;

  document.getElementById("remaining-medicine").textContent =
    `${result.summary?.remainingMedicine ?? 0}`;

  document.getElementById("remaining-water").textContent =
    `${payload.supplies?.water ?? 0}`;

  document.getElementById("remaining-blankets").textContent =
    `${payload.supplies?.blankets ?? 0}`;
}

function renderResultsTable(result) {
  const tbody = document.getElementById("results-table-body");
  const rows = result.results || [];

  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">No optimization results available.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (row) => `
    <tr>
      <td>${row.rank ?? "-"}</td>
      <td>${row.location ?? "-"}</td>
      <td>${inferLocationType(row.location)}</td>
      <td>${row.priorityScore ?? "-"}</td>
      <td>${row.route ?? "-"}</td>
      <td>${row.travelDistance ?? 0}</td>
      <td>${row.deliveredFood ?? 0}</td>
      <td>${row.deliveredMedicine ?? 0}</td>
      <td>${buildStatusBadge(row.status)}</td>
    </tr>
  `,
    )
    .join("");
}

function renderUnreachableBox(result) {
  const box = document.getElementById("unreachable-box");
  const unreachable = result.unreachableLocations || [];

  if (!box) return;

  if (!unreachable.length) {
    box.textContent = "All locations are reachable in this scenario.";
    return;
  }

  box.textContent = `Unreachable locations: ${unreachable.join(", ")}`;
}

function renderUnmetBox(result) {
  const box = document.getElementById("unmet-box");
  const rows = result.results || [];

  if (!box) return;

  const unmetRows = rows.filter(
    (row) =>
      (row.unmetFood && row.unmetFood > 0) ||
      (row.unmetMedicine && row.unmetMedicine > 0),
  );

  if (!unmetRows.length) {
    box.textContent = "No unmet demand in the current run.";
    return;
  }

  box.innerHTML = unmetRows
    .map((row) => {
      return `${row.location}: Unmet Food = ${row.unmetFood || 0}, Unmet Medicine = ${row.unmetMedicine || 0}`;
    })
    .join("<br>");
}

function renderSimulationLog(result, payload) {
  const logBox = document.getElementById("simulation-log");
  const rows = result.results || [];

  if (!logBox) return;

  const entries = [];
  entries.push(
    `Started optimization using ${formatMode(payload.optimizationMode)} mode.`,
  );

  rows.forEach((row) => {
    if (row.status === "Unreachable") {
      entries.push(`Skipped ${row.location} because it was unreachable.`);
    } else {
      entries.push(
        `Visited ${row.location} and delivered ${row.deliveredFood || 0} food, ${row.deliveredMedicine || 0} medicine.`,
      );
    }
  });

  logBox.innerHTML = entries
    .map((entry) => `<div class="log-entry">${entry}</div>`)
    .join("");
}

function renderAllRoutesGraph(distributionCenter, locations, roads) {
  const svg = document.getElementById("all-routes-graph");
  if (!svg) return;

  const allNames = [distributionCenter, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, distributionCenter);

  svg.innerHTML = "";

  if (!allNames.length) {
    svg.innerHTML = `<text x="350" y="180" class="graph-empty-text">No graph data</text>`;
    return;
  }

  roads.forEach((road) => {
    const fromPos = positions[road.from];
    const toPos = positions[road.to];
    if (!fromPos || !toPos) return;

    const status = (road.status || "open").toLowerCase();
    let edgeClass = "graph-edge graph-edge-open";

    if (status === "damaged") edgeClass = "graph-edge graph-edge-damaged";
    if (status === "blocked") edgeClass = "graph-edge graph-edge-blocked";

    svg.innerHTML += `
      <line x1="${fromPos.x}" y1="${fromPos.y}" x2="${toPos.x}" y2="${toPos.y}" class="${edgeClass}" />
      ${buildDistanceLabel(fromPos, toPos, road.distance)}
    `;
  });

  allNames.forEach((name) => {
    const node = buildNodeSvg(name, positions[name], distributionCenter);
    svg.innerHTML += node;
  });
}

function renderOptimalRouteGraph(distributionCenter, locations, optimalPaths) {
  const svg = document.getElementById("optimal-route-graph");
  if (!svg) return;

  const allNames = [distributionCenter, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, distributionCenter);

  svg.innerHTML = "";

  if (!allNames.length) {
    svg.innerHTML = `<text x="350" y="180" class="graph-empty-text">No graph data</text>`;
    return;
  }

  const uniqueEdges = new Set();

  optimalPaths.forEach((path) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      uniqueEdges.add(`${a}|||${b}`);
    }
  });

  uniqueEdges.forEach((edgeKey) => {
    const [from, to] = edgeKey.split("|||");
    const fromPos = positions[from];
    const toPos = positions[to];
    if (!fromPos || !toPos) return;

    svg.innerHTML += `
      <line x1="${fromPos.x}" y1="${fromPos.y}" x2="${toPos.x}" y2="${toPos.y}" class="graph-edge-optimal" />
    `;
  });

  allNames.forEach((name) => {
    const node = buildNodeSvg(name, positions[name], distributionCenter);
    svg.innerHTML += node;
  });
}

function generateNodePositions(names, distributionCenter) {
  const positions = {};

  const svgWidth = 700;
  const svgHeight = 360;

  const centerX = svgWidth / 2;
  const centerY = 85;

  positions[distributionCenter] = { x: centerX, y: centerY };

  const others = names.filter((name) => name !== distributionCenter);

  if (others.length === 1) {
    positions[others[0]] = { x: centerX, y: 250 };
    return positions;
  }

  if (others.length === 2) {
    positions[others[0]] = { x: 220, y: 250 };
    positions[others[1]] = { x: 480, y: 250 };
    return positions;
  }

  if (others.length === 3) {
    positions[others[0]] = { x: 160, y: 265 };
    positions[others[1]] = { x: 350, y: 240 };
    positions[others[2]] = { x: 540, y: 265 };
    return positions;
  }

  if (others.length === 4) {
    positions[others[0]] = { x: 120, y: 265 };
    positions[others[1]] = { x: 280, y: 230 };
    positions[others[2]] = { x: 420, y: 230 };
    positions[others[3]] = { x: 580, y: 265 };
    return positions;
  }

  const radiusX = 240;
  const radiusY = 105;

  others.forEach((name, index) => {
    const angle = (2 * Math.PI * index) / others.length;
    positions[name] = {
      x: centerX + radiusX * Math.cos(angle - Math.PI / 2),
      y: centerY + 155 + radiusY * Math.sin(angle - Math.PI / 2),
    };
  });

  return positions;
}

function buildDistanceLabel(fromPos, toPos, distance) {
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;

  return `
    <rect x="${midX - 20}" y="${midY - 13}" width="40" height="24" rx="8" class="graph-distance-box" />
    <text x="${midX}" y="${midY + 4}" class="graph-distance-text" text-anchor="middle">${distance}</text>
  `;
}

function buildNodeSvg(name, pos, distributionCenter) {
  const type = inferLocationType(name);
  let nodeClass = "graph-node graph-node-village";
  let icon = "📍";
  let radius = 26;

  if (name === distributionCenter) {
    nodeClass = "graph-node graph-node-dc";
    icon = "🏢";
    radius = 32;
  } else if (type === "Shelter") {
    nodeClass = "graph-node graph-node-shelter";
    icon = "🏠";
  } else if (type === "Clinic") {
    nodeClass = "graph-node graph-node-clinic";
    icon = "🩺";
  } else if (type === "Village") {
    nodeClass = "graph-node graph-node-village";
    icon = "🏘️";
  }

  const labelWidth = Math.max(90, name.length * 8);

  return `
    <circle cx="${pos.x}" cy="${pos.y}" r="${radius}" class="${nodeClass}" />
    <text x="${pos.x}" y="${pos.y}" class="graph-node-icon">${icon}</text>
    <rect x="${pos.x - labelWidth / 2}" y="${pos.y + 34}" width="${labelWidth}" height="28" rx="10" class="graph-node-label-box" />
    <text x="${pos.x}" y="${pos.y + 52}" text-anchor="middle" class="graph-node-label">${name}</text>
  `;
}

function buildStatusBadge(status) {
  const safeStatus = status || "Unknown";

  if (safeStatus === "Delivered") {
    return `<span class="result-badge delivered">Delivered</span>`;
  }

  if (safeStatus === "Partially Delivered") {
    return `<span class="result-badge partial">Partial</span>`;
  }

  if (safeStatus === "Unreachable") {
    return `<span class="result-badge unreachable">Unreachable</span>`;
  }

  return `<span class="result-badge">${safeStatus}</span>`;
}

function formatMode(mode) {
  if (mode === "urgency-first") return "Urgency First";
  if (mode === "distance-first") return "Distance First";
  return "Balanced";
}

function inferLocationType(locationName) {
  if (!locationName) return "-";
  const value = locationName.toLowerCase();
  if (value.includes("clinic")) return "Clinic";
  if (value.includes("shelter")) return "Shelter";
  if (value.includes("village")) return "Village";
  return "Location";
}
