function renderOptimizationResult(result, payload) {
  const container = document.getElementById("results-container");
  if (!container) return;

  const rows = result.results || [];
  const unreachable = result.unreachableLocations || [];
  const locationTypeMap = buildLocationTypeMap(payload.locations || []);
  const locationUrgencyMap = buildLocationUrgencyMap(payload.locations || []);

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card small-card">
        <h4>Total Travel Distance</h4>
        <p>${result.summary?.totalTravelDistance ?? 0} miles</p>
      </div>
        <div class="summary-card small-card">
            <h4>Locations Served</h4>
            <p>${countServedLocations(rows)} / ${payload.locations?.length ?? 0}</p>
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
      <div class="mini-summary-box">Water: ${result.summary?.remainingWater ?? payload.supplies?.water ?? 0}</div>
      <div class="mini-summary-box">Blankets: ${result.summary?.remainingBlankets ?? payload.supplies?.blankets ?? 0}</div>
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
            <th>Food</th>
            <th>Medicine</th>
            <th>Water</th>
            <th>Blankets</th>
            <th>Supply Plan Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => `
                      <tr class="${getResultRowClass(row.location, locationUrgencyMap)}">
                        <td>${row.rank ?? "-"}</td>
                        <td>${row.location ?? "-"}</td>
                        <td>${locationTypeMap[row.location] || "Location"}</td>
                        <td>${row.priorityScore ?? "-"}</td>
                        <td>${row.route ?? "-"}</td>
                        <td>${row.travelDistance ?? 0}</td>
                        <td>${formatDeliveredNeeded(row.deliveredFood, row.unmetFood)}</td>
                        <td>${formatDeliveredNeeded(row.deliveredMedicine, row.unmetMedicine)}</td>
                        <td>${formatDeliveredNeeded(row.deliveredWater, row.unmetWater)}</td>
                        <td>${formatDeliveredNeeded(row.deliveredBlankets, row.unmetBlankets)}</td>
                        <td>${buildStatusBadge(row.status)}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `
                  <tr>
                    <td colspan="11">No optimization results available.</td>
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
    payload.locations || [],
    result.optimalPaths || [],
  );
}

/* =========================
   Graph Rendering
========================= */

function renderAllRoutesGraph(distributionCenter, locations, roads) {
  const svg = document.getElementById("all-routes-graph");
  if (!svg) return;

  const dcName = distributionCenter || "D.C.";
  const locationTypeMap = buildLocationTypeMap(locations);
  const allNames = [dcName, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, dcName, locationTypeMap);

  prepareGraphSvg(svg, allNames.length);

  if (!allNames.length) {
    renderEmptyGraph(svg);
    return;
  }

  let markup = "";

  roads.forEach((road) => {
    const fromPos = positions[road.from];
    const toPos = positions[road.to];
    if (!fromPos || !toPos) return;

    const { x1, y1, x2, y2 } = getTrimmedLineCoordinates(
      fromPos,
      toPos,
      getNodeRadius(),
      getNodeRadius(),
    );

    markup += `
      <line
        x1="${x1}"
        y1="${y1}"
        x2="${x2}"
        y2="${y2}"
        class="${getRoadEdgeClass(road.status)}"
      />
      ${buildDistanceLabel({ x: x1, y: y1 }, { x: x2, y: y2 }, road.distance)}
    `;
  });

  allNames.forEach((name) => {
    markup += buildNodeSvg(name, positions[name], dcName, locationTypeMap);
  });

  svg.innerHTML = markup;
}

function renderOptimalRouteGraph(distributionCenter, locations, optimalPaths) {
  const svg = document.getElementById("optimal-route-graph");
  if (!svg) return;

  const dcName = distributionCenter || "D.C.";
  const locationTypeMap = buildLocationTypeMap(locations);
  const allNames = [dcName, ...locations.map((loc) => loc.name)];
  const positions = generateNodePositions(allNames, dcName, locationTypeMap);

  prepareGraphSvg(svg, allNames.length);

  if (!allNames.length) {
    renderEmptyGraph(svg);
    return;
  }

  const uniqueEdges = new Set();
  let markup = "";

  optimalPaths.forEach((path) => {
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i] || "";
      const to = path[i + 1] || "";
      if (from && to) uniqueEdges.add(`${from}|||${to}`);
    }
  });

  uniqueEdges.forEach((edgeKey) => {
    const [from, to] = edgeKey.split("|||");
    const fromPos = positions[from];
    const toPos = positions[to];
    if (!fromPos || !toPos) return;

    const { x1, y1, x2, y2 } = getTrimmedLineCoordinates(
      fromPos,
      toPos,
      getNodeRadius(),
      getNodeRadius(),
    );

    markup += `
      <line
        x1="${x1}"
        y1="${y1}"
        x2="${x2}"
        y2="${y2}"
        class="graph-edge-optimal"
      />
    `;
  });

  allNames.forEach((name) => {
    markup += buildNodeSvg(name, positions[name], dcName, locationTypeMap);
  });

  svg.innerHTML = markup;
}

function prepareGraphSvg(svg, nodeCount) {
  const graphHeight = getGraphHeight(nodeCount);
  svg.setAttribute("viewBox", `0 0 700 ${graphHeight}`);

  const graphBox = svg.closest(".graph-box");
  if (graphBox) {
    graphBox.style.height = `${graphHeight}px`;
  }

  svg.innerHTML = "";
}

function renderEmptyGraph(svg) {
  svg.innerHTML = `
    <text x="350" y="180" class="graph-empty-text">
      No graph data
    </text>
  `;
}

function generateNodePositions(
  names,
  distributionCenter,
  locationTypeMap = {},
) {
  const positions = {};
  const centerX = 350;
  const topY = 70;

  positions[distributionCenter] = { x: centerX, y: topY };

  const shelters = [];
  const clinics = [];
  const villages = [];
  const others = [];

  names.forEach((name) => {
    if (name === distributionCenter) return;

    const type = locationTypeMap[name] || "Location";

    if (type === "Shelter") {
      shelters.push(name);
    } else if (type === "Clinic") {
      clinics.push(name);
    } else if (type === "Village") {
      villages.push(name);
    } else {
      others.push(name);
    }
  });

  placeRow(shelters, 180, positions);
  placeRow(clinics, 300, positions);
  placeRow(villages, 420, positions);
  placeRow(others, 520, positions);

  return positions;
}

function placeRow(nodeNames, y, positions) {
  if (!nodeNames.length) return;

  const centerX = 350;

  if (nodeNames.length === 1) {
    positions[nodeNames[0]] = { x: centerX, y };
    return;
  }

  const rowWidth = Math.min(500, 160 + (nodeNames.length - 1) * 140);
  const startX = centerX - rowWidth / 2;
  const step = rowWidth / (nodeNames.length - 1);

  nodeNames.forEach((name, index) => {
    positions[name] = {
      x: startX + step * index,
      y,
    };
  });
}

function getGraphHeight(nodeCount) {
  if (nodeCount <= 2) return 380;
  if (nodeCount === 3) return 430;
  if (nodeCount === 4) return 470;
  return 520;
}

function getNodeRadius() {
  return 33;
}

function getTrimmedLineCoordinates(
  fromPos,
  toPos,
  fromRadius = 33,
  toRadius = 33,
) {
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length === 0) {
    return {
      x1: fromPos.x,
      y1: fromPos.y,
      x2: toPos.x,
      y2: toPos.y,
    };
  }

  const ux = dx / length;
  const uy = dy / length;

  return {
    x1: fromPos.x + ux * fromRadius,
    y1: fromPos.y + uy * fromRadius,
    x2: toPos.x - ux * toRadius,
    y2: toPos.y - uy * toRadius,
  };
}

function buildDistanceLabel(fromPos, toPos, distance) {
  const midX = (fromPos.x + toPos.x) / 2;
  const midY = (fromPos.y + toPos.y) / 2;

  return `
    <rect
      x="${midX - 18}"
      y="${midY - 11}"
      width="36"
      height="22"
      rx="8"
      class="graph-distance-box"
    />
    <text
      x="${midX}"
      y="${midY + 4}"
      class="graph-distance-text"
      text-anchor="middle"
    >${distance ?? 0}</text>
  `;
}

function buildNodeSvg(name, pos, distributionCenter, locationTypeMap = {}) {
  const type =
    name === distributionCenter
      ? "Distribution Center"
      : locationTypeMap[name] || "Location";

  let nodeClass = "graph-node graph-node-village";
  let icon = "📍";
  const radius = getNodeRadius();

  if (name === distributionCenter) {
    nodeClass = "graph-node graph-node-dc";
    icon = "🏢";
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

  const labelWidth = Math.max(82, name.length * 7);
  const labelHeight = 24;
  const labelY = pos.y + radius - 10;

  return `
    <circle cx="${pos.x}" cy="${pos.y}" r="${radius}" class="${nodeClass}" />
    <text x="${pos.x}" y="${pos.y}" class="graph-node-icon">${icon}</text>

    <rect
      x="${pos.x - labelWidth / 2}"
      y="${labelY}"
      width="${labelWidth}"
      height="${labelHeight}"
      rx="10"
      class="graph-node-label-box"
    />

    <text
      x="${pos.x}"
      y="${labelY + 16}"
      text-anchor="middle"
      class="graph-node-label"
    >${name}</text>
  `;
}

function getRoadEdgeClass(status) {
  const value = String(status || "open").toLowerCase();

  if (value === "damaged") return "graph-edge graph-edge-damaged";
  if (value === "blocked") return "graph-edge graph-edge-blocked";
  return "graph-edge graph-edge-open";
}

/* =========================
   Table Rendering
========================= */

function renderLocationsTable(locations) {
  const tbody = document.getElementById("locations-table-body");
  if (!tbody) return;

  if (!locations.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">No locations added.</td>
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
          <td>${location.demandFood ?? 0}</td>
          <td>${location.demandMedicine ?? 0}</td>
          <td>${location.demandWater ?? 0}</td>
          <td>${location.demandBlankets ?? 0}</td>
          <td>${buildUrgencyBadge(location.urgency)}</td>
          <td>
            <button class="table-btn" onclick="deleteLocation('${location.id}')">
              Delete
            </button>
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
            <button class="table-btn" onclick="deleteRoad('${road.id}')">
              Delete
            </button>
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

/* =========================
   Badge / Text Helpers
========================= */

function buildUrgencyBadge(urgency) {
  const value = String(urgency || "").toLowerCase();

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
  const value = String(status || "").toLowerCase();

  if (value === "open") {
    return `<span class="status-badge status-open">Open</span>`;
  }

  if (value === "damaged") {
    return `<span class="status-badge status-damaged">Damaged</span>`;
  }

  return `<span class="status-badge status-blocked">Blocked</span>`;
}

function buildStatusBadge(status) {
  const value = String(status || "").toLowerCase();

  if (value === "planned full supply") {
    return `<span class="result-badge delivered">Planned Full Supply</span>`;
  }

  if (value === "planned partial supply") {
    return `<span class="result-badge partial">Planned Partial Supply</span>`;
  }

  if (value === "no supplies available") {
    return `<span class="result-badge partial">Reachable, No Supplies Left</span>`;
  }

  if (value === "unreachable") {
    return `<span class="result-badge unreachable">Unreachable</span>`;
  }

  return `<span class="result-badge partial">${status || "Pending"}</span>`;
}

function buildUnmetDemandHtml(rows) {
  const unmetRows = rows.filter(
    (row) =>
      (row.unmetFood ?? 0) > 0 ||
      (row.unmetMedicine ?? 0) > 0 ||
      (row.unmetWater ?? 0) > 0 ||
      (row.unmetBlankets ?? 0) > 0,
  );

  if (!unmetRows.length) {
    return "All listed demands are covered in this supply plan.";
  }

  return unmetRows
    .map(
      (row) =>
        `${row.location}: Unmet Food = ${row.unmetFood || 0}, ` +
        `Unmet Medicine = ${row.unmetMedicine || 0}, ` +
        `Unmet Water = ${row.unmetWater || 0}, ` +
        `Unmet Blankets = ${row.unmetBlankets || 0}`,
    )
    .join("<br>");
}

function buildSimulationLogHtml(rows, payload) {
  const entries = [
    `Started optimization using ${formatMode(payload.optimizationMode)} mode.`,
  ];

  rows.forEach((row) => {
    const status = String(row.status || "").toLowerCase();

    if (status === "unreachable") {
      entries.push(
        `${row.location} is unreachable because no available route was found.`,
      );
    } else if (status === "no supplies available") {
      entries.push(
        `${row.location} is reachable, but no supplies were left by this point in the plan.`,
      );
    } else if (status === "planned partial supply") {
      entries.push(
        `Planned partial supply for ${row.location}: ` +
          `${row.deliveredFood || 0} food, ` +
          `${row.deliveredMedicine || 0} medicine, ` +
          `${row.deliveredWater || 0} water, and ` +
          `${row.deliveredBlankets || 0} blankets.`,
      );
    } else {
      entries.push(
        `Planned full supply for ${row.location}: ` +
          `${row.deliveredFood || 0} food, ` +
          `${row.deliveredMedicine || 0} medicine, ` +
          `${row.deliveredWater || 0} water, and ` +
          `${row.deliveredBlankets || 0} blankets.`,
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

function countServedLocations(rows) {
  return rows.filter((row) => {
    const totalDelivered =
      (row.deliveredFood ?? 0) +
      (row.deliveredMedicine ?? 0) +
      (row.deliveredWater ?? 0) +
      (row.deliveredBlankets ?? 0);

    return totalDelivered > 0;
  }).length;
}

function formatDeliveredNeeded(delivered, unmet) {
  const deliveredAmount = delivered ?? 0;
  const unmetAmount = unmet ?? 0;
  const neededAmount = deliveredAmount + unmetAmount;

  return `${deliveredAmount} / ${neededAmount}`;
}

function buildLocationTypeMap(locations) {
  const map = {};

  locations.forEach((location) => {
    if (location?.name) {
      map[location.name] = location.type || "Location";
    }
  });

  return map;
}

function buildLocationUrgencyMap(locations) {
  const map = {};

  locations.forEach((location) => {
    if (location?.name) {
      map[location.name] = location.urgency || "Low";
    }
  });

  return map;
}

function getResultRowClass(locationName, locationUrgencyMap) {
  const urgency = String(locationUrgencyMap[locationName] || "").toLowerCase();

  if (urgency === "critical") {
    return "critical-result-row";
  }

  return "";
}
