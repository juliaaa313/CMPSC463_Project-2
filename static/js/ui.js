function renderOptimizationResult(result, payload) {
  const container = document.getElementById("results-container");
  if (!container) return;

  const rows = result.results || [];
  const unreachable = result.unreachableLocations || [];

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
      <table id="results-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Location</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Route</th>
            <th>Distance</th>
            <th>Food Delivered</th>
            <th>Medicine Delivered</th>
            <th>Allocation Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
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
                  .join("")
              : `
            <tr>
              <td colspan="9">No optimization results available.</td>
            </tr>
          `
          }
        </tbody>
      </table>
    </div>

    <h3 class="subheading">Unreachable Locations</h3>
    <div id="unreachable-box" class="info-box">
      ${
        unreachable.length
          ? `Unreachable locations: ${unreachable.join(", ")}`
          : "All locations are reachable in this scenario."
      }
    </div>

    <h3 class="subheading">Unmet Demand</h3>
    <div id="unmet-box" class="info-box">
      ${buildUnmetDemandHtml(rows)}
    </div>

    <h3 class="subheading">Simulation Log</h3>
    <div id="simulation-log" class="log-box">
      ${buildSimulationLogHtml(rows, payload)}
    </div>

    <h3 class="subheading">Optimal Route Graph</h3>
    <div class="graph-box optimal-graph-box">
      <svg id="optimal-route-graph" viewBox="0 0 700 360" class="graph-svg"></svg>
    </div>
  `;

  renderOptimalRouteGraph(
    payload.distributionCenter,
    payload.locations,
    result.optimalPaths || [],
  );
}

function renderAllRoutesGraph(distributionCenter, locations, roads) {
  const svg = document.getElementById("all-routes-graph");
  if (!svg) return;

  const dcName = distributionCenter || "D.C.";
  const allNames = [dcName, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, dcName);

  svg.innerHTML = "";

  if (!allNames.length) {
    svg.innerHTML = `<text x="350" y="180" class="graph-empty-text">No graph data</text>`;
    return;
  }

  roads.forEach((road) => {
    const fromName = road.from || "";
    const toName = road.to || "";
    const fromPos = positions[fromName];
    const toPos = positions[toName];
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
    const node = buildNodeSvg(name, positions[name], dcName);
    svg.innerHTML += node;
  });
}

function renderOptimalRouteGraph(distributionCenter, locations, optimalPaths) {
  const svg = document.getElementById("optimal-route-graph");
  if (!svg) return;

  const dcName = distributionCenter || "D.C.";
  const allNames = [dcName, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, dcName);

  svg.innerHTML = "";

  if (!allNames.length) {
    svg.innerHTML = `<text x="350" y="180" class="graph-empty-text">No graph data</text>`;
    return;
  }

  const uniqueEdges = new Set();

  optimalPaths.forEach((path) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i] || "";
      const b = path[i + 1] || "";
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
    const node = buildNodeSvg(name, positions[name], dcName);
    svg.innerHTML += node;
  });
}

function generateNodePositions(names, distributionCenter) {
  const positions = {};

  const svgWidth = 700;
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
    const angle = (2 * Math.PI * index) / Math.max(others.length, 1);
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

function renderLocationsTable(locations) {
  const tbody = document.getElementById("locations-table-body");
  if (!tbody) return;

  if (!locations.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">No locations added.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = locations
    .map(
      (location) => `
    <tr>
      <td>${location.name}</td>
      <td>${location.type}</td>
      <td>${location.demandFood}</td>
      <td>${location.demandMedicine}</td>
      <td>${buildUrgencyBadge(location.urgency)}</td>
      <td>
        <button class="table-btn" onclick="deleteLocation('${location.id}')">Delete</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function renderRoadsTable(roads) {
  const tbody = document.getElementById("roads-table-body");
  if (!tbody) return;

  if (!roads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">No roads added.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = roads
    .map(
      (road) => `
    <tr>
      <td>${road.from}</td>
      <td>${road.to}</td>
      <td>${road.distance}</td>
      <td>${buildRoadStatusBadge(road.status)}</td>
      <td>
        <button class="table-btn" onclick="deleteRoad('${road.id}')">Delete</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

function updateRoadDropdowns(locations) {
  const fromSelect = document.getElementById("road-from");
  const toSelect = document.getElementById("road-to");
  const distributionCenter =
    document.getElementById("distribution-center")?.value?.trim() || "D.C.";

  if (!fromSelect || !toSelect) return;

  const previousFrom = fromSelect.value;
  const previousTo = toSelect.value;

  const locationNames = locations.map((location) => location.name);

  const fromOptions = [distributionCenter, ...locationNames];
  const toOptions = [...locationNames];

  fromSelect.innerHTML = fromOptions.length
    ? fromOptions
        .map((name) => `<option value="${name}">${name}</option>`)
        .join("")
    : `<option value="" selected disabled>No locations available</option>`;

  toSelect.innerHTML = toOptions.length
    ? toOptions
        .map((name) => `<option value="${name}">${name}</option>`)
        .join("")
    : `<option value="" selected disabled>No locations available</option>`;

  if (fromOptions.includes(previousFrom)) {
    fromSelect.value = previousFrom;
  } else if (fromOptions.length > 0) {
    fromSelect.selectedIndex = 0;
  }

  if (toOptions.includes(previousTo)) {
    toSelect.value = previousTo;
  } else if (toOptions.length > 0) {
    toSelect.selectedIndex = 0;
  }
}

function buildUrgencyBadge(urgency) {
  const value = (urgency || "").toLowerCase();

  if (value === "critical") {
    return `<span class="urgency-badge urgency-critical">Critical</span>`;
  }

  if (value === "high") {
    return `<span class="urgency-badge urgency-high">High</span>`;
  }

  if (value === "medium") {
    return `<span class="urgency-badge urgency-medium">Medium</span>`;
  }

  return `<span class="urgency-badge urgency-low">Low</span>`;
}

function buildRoadStatusBadge(status) {
  const value = (status || "").toLowerCase();

  if (value === "open") {
    return `<span class="status-badge status-open">Open</span>`;
  }

  if (value === "damaged") {
    return `<span class="status-badge status-damaged">Damaged</span>`;
  }

  return `<span class="status-badge status-blocked">Blocked</span>`;
}

function buildStatusBadge(status) {
  const value = (status || "").toLowerCase();

  if (value === "delivered") {
    return `<span class="result-badge delivered">Fully Allocated</span>`;
  }

  if (value === "partial") {
    return `<span class="result-badge partial">Partially Allocated</span>`;
  }

  return `<span class="result-badge unreachable">Unreachable</span>`;
}

function buildUnmetDemandHtml(rows) {
  const unmetRows = rows.filter(
    (row) =>
      (row.unmetFood && row.unmetFood > 0) ||
      (row.unmetMedicine && row.unmetMedicine > 0),
  );

  if (!unmetRows.length) {
    return "All demands were fully allocated in this plan.";
  }

  return unmetRows
    .map(
      (row) =>
        `${row.location}: Unmet Food = ${row.unmetFood || 0}, Unmet Medicine = ${row.unmetMedicine || 0}`,
    )
    .join("<br>");
}

function buildSimulationLogHtml(rows, payload) {
  const entries = [];
  entries.push(
    `Started optimization using ${formatMode(payload.optimizationMode)} mode.`,
  );

  rows.forEach((row) => {
    if (row.status === "Unreachable") {
      entries.push(
        `Could not allocate resources to ${row.location} because it is unreachable.`,
      );
    } else {
      entries.push(
        `Allocated ${row.deliveredFood || 0} food and ${row.deliveredMedicine || 0} medicine to ${row.location}.`,
      );
    }
  });

  return entries
    .map((entry) => `<div class="log-entry">${entry}</div>`)
    .join("");
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
