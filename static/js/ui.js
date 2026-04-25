function normalize(value, defaultValue = "") {
  return String(value ?? defaultValue).toLowerCase();
}

function capitalize(value, fallback = "") {
  const text = String(value || fallback);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function renderOptimizationResult(result, payload) {
  const container = document.getElementById("results-container");
  if (!container) return;

  const rows = result.results || [];
  const unreachable = result.unreachableLocations || [];
  const locations = payload.locations || [];
  const supplies = payload.supplies || {};

  const locationTypeMap = buildLocationTypeMap(locations);
  const locationUrgencyMap = buildLocationUrgencyMap(locations);

  container.innerHTML = `
    <div class="summary-grid">
      <div class="summary-card small-card">
        <h4>Total Travel Distance</h4>
        <p>${result.summary?.totalTravelDistance ?? 0} miles</p>
      </div>
      <div class="summary-card small-card">
        <h4>Locations Served</h4>
        <p>${countServedLocations(rows)} / ${locations.length}</p>
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
      <div class="mini-summary-box">Water: ${result.summary?.remainingWater ?? supplies.water ?? 0}</div>
      <div class="mini-summary-box">Blankets: ${result.summary?.remainingBlankets ?? supplies.blankets ?? 0}</div>
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
          ${buildResultsTableRows(rows, locationTypeMap, locationUrgencyMap)}
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
    <div id="optimal-route-summary" class="info-box route-summary-box"></div>
  `;

  renderOptimalRouteGraph(
    payload.distributionCenter,
    locations,
    result.optimalPaths || [],
    rows,
  );
}

function buildResultsTableRows(rows, locationTypeMap, locationUrgencyMap) {
  if (!rows.length) {
    return `
      <tr>
        <td colspan="11">No optimization results available.</td>
      </tr>
    `;
  }

  return rows
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
    .join("");
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

function renderOptimalRouteGraph(
  distributionCenter,
  locations,
  optimalPaths,
  rows = [],
) {
  const svg = document.getElementById("optimal-route-graph");
  if (!svg) return;

  const dcName = distributionCenter || "D.C.";
  const locationTypeMap = buildLocationTypeMap(locations);
  const allNames = [dcName, ...locations.map((loc) => loc.name)];
  const deliveryOrder = buildDeliveryOrderMap(rows);
  const positions = generateNodePositions(allNames, dcName, locationTypeMap);

  prepareGraphSvg(svg, allNames.length);

  if (!allNames.length) {
    renderEmptyGraph(svg);
    return;
  }

  let edgeMarkup = "";
  let labelMarkup = "";
  let nodeMarkup = "";

  optimalPaths.forEach((path, segmentIndex) => {
    if (!path || path.length < 2) return;

    const isReturnSegment =
      path[path.length - 1] === dcName &&
      segmentIndex === optimalPaths.length - 1;

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];

      const fromPos = positions[from];
      const toPos = positions[to];
      if (!fromPos || !toPos) continue;

      const { x1, y1, x2, y2 } = getTrimmedLineCoordinates(
        fromPos,
        toPos,
        getNodeRadius(),
        getNodeRadius(),
      );

      edgeMarkup += `
        <line
          x1="${x1}"
          y1="${y1}"
          x2="${x2}"
          y2="${y2}"
          class="graph-edge-optimal"
        />
      `;

      if (isReturnSegment && i === path.length - 2) {
        labelMarkup += buildReturnEdgeLabel({ x: x1, y: y1 }, { x: x2, y: y2 });
      }
    }
  });

  allNames.forEach((name) => {
    nodeMarkup += buildNodeSvg(name, positions[name], dcName, locationTypeMap);

    if (name === dcName) {
      nodeMarkup += buildVisitOrderBadge(positions[name], "Start", true);
    } else if (deliveryOrder[name]) {
      nodeMarkup += buildVisitOrderBadge(
        positions[name],
        deliveryOrder[name],
        false,
      );
    }
  });

  svg.innerHTML = edgeMarkup + labelMarkup + nodeMarkup;

  renderOptimalRouteSummary(dcName, optimalPaths, rows);
}

function buildReturnEdgeLabel(fromPos, toPos) {
  const t = 0.7;
  const midX = fromPos.x + (toPos.x - fromPos.x) * t;
  const midY = fromPos.y + (toPos.y - fromPos.y) * t;

  const labelWidth = 84;
  const labelHeight = 24;

  return `
    <rect
      x="${midX - labelWidth / 2}"
      y="${midY - labelHeight / 2}"
      width="${labelWidth}"
      height="${labelHeight}"
      rx="10"
      class="route-step-box"
    />
    <text
      x="${midX}"
      y="${midY + 4}"
      text-anchor="middle"
      class="route-step-text"
    >Return to DC</text>
  `;
}

function renderOptimalRouteSummary(distributionCenter, optimalPaths, rows) {
  const summaryBox = document.getElementById("optimal-route-summary");
  if (!summaryBox) return;

  const deliveryOrder = rows
    .filter((row) => {
      const status = normalize(row.status);
      return status !== "unreachable" && row.route !== "Unreachable";
    })
    .map((row) => row.location);

  const actualTravelPath = buildActualTravelPath(optimalPaths);

  summaryBox.innerHTML = `
    <strong>Delivery Order:</strong>
    ${[distributionCenter, ...deliveryOrder, distributionCenter].join(" → ")}
    <br>
    <strong>Actual Travel Path:</strong>
    ${actualTravelPath.join(" → ")}
    <br>
    <span class="muted-small">
      Note: some locations may appear in the travel path before their delivery number because the route may pass through them to reach another location first.
    </span>
  `;
}

function buildActualTravelPath(optimalPaths) {
  const fullPath = [];

  optimalPaths.forEach((path) => {
    if (!path || !path.length) return;

    path.forEach((node, index) => {
      const isDuplicateStart =
        fullPath.length > 0 &&
        index === 0 &&
        fullPath[fullPath.length - 1] === node;

      if (!isDuplicateStart) {
        fullPath.push(node);
      }
    });
  });

  return fullPath;
}

function buildDeliveryOrderMap(rows) {
  const orderMap = {};
  let order = 1;

  rows.forEach((row) => {
    const status = normalize(row.status);

    if (
      status !== "unreachable" &&
      row.location &&
      row.route !== "Unreachable"
    ) {
      orderMap[row.location] = order;
      order += 1;
    }
  });

  return orderMap;
}

function buildVisitOrderBadge(pos, order, isDistributionCenter) {
  const badgeText = String(order);
  const badgeWidth = badgeText.length > 2 ? 54 : 30;
  const badgeX = pos.x - 20;
  const badgeY = pos.y - 25;

  return `
    <rect
      x="${badgeX - badgeWidth / 2}"
      y="${badgeY - 14}"
      width="${badgeWidth}"
      height="26"
      rx="13"
      class="${isDistributionCenter ? "visit-badge visit-badge-start" : "visit-badge"}"
    />
    <text
      x="${badgeX}"
      y="${badgeY + 4}"
      text-anchor="middle"
      class="visit-badge-text"
    >${badgeText}</text>
  `;
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

// Custom graph layout:
// DC on top, shelters/clinics/villages in spaced rows.
// Clinics are pushed outward to reduce edge overlap.
function generateNodePositions(
  names,
  distributionCenter,
  locationTypeMap = {},
) {
  const positions = {};
  const centerX = 350;

  positions[distributionCenter] = { x: centerX, y: 80 };

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

  placeOffsetRow(shelters, 220, positions, 140, 560);
  placeOffsetRow(clinics, 420, positions, 60, 640);
  placeOffsetRow(villages, 620, positions, 140, 560);
  placeOffsetRow(others, 740, positions, 120, 580);

  return positions;
}

function placeOffsetRow(nodeNames, y, positions, leftX, rightX) {
  if (!nodeNames.length) return;

  if (nodeNames.length === 1) {
    positions[nodeNames[0]] = { x: leftX, y };
    return;
  }

  const rowWidth = rightX - leftX;
  const step = rowWidth / (nodeNames.length - 1);

  nodeNames.forEach((name, index) => {
    positions[name] = {
      x: leftX + step * index,
      y,
    };
  });
}

function getGraphHeight(nodeCount) {
  if (nodeCount <= 2) return 420;
  if (nodeCount <= 4) return 560;
  if (nodeCount <= 6) return 680;
  return 780;
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
  const t = 0.4;

  const midX = fromPos.x + (toPos.x - fromPos.x) * t;
  const midY = fromPos.y + (toPos.y - fromPos.y) * t;

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
  const value = normalize(status, "open");

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
  const value = normalize(urgency, "low");

  const classes = {
    critical: "urgency-critical",
    high: "urgency-high",
    medium: "urgency-medium",
    low: "urgency-low",
  };

  const className = classes[value] || classes.low;
  const label = classes[value] ? capitalize(value) : "Low";

  return `<span class="urgency-badge ${className}">${label}</span>`;
}

function buildRoadStatusBadge(status) {
  const value = normalize(status, "blocked");

  const classes = {
    open: "status-open",
    damaged: "status-damaged",
    blocked: "status-blocked",
  };

  const className = classes[value] || classes.blocked;
  const label = classes[value] ? capitalize(value) : "Blocked";

  return `<span class="status-badge ${className}">${label}</span>`;
}

function buildStatusBadge(status) {
  const value = normalize(status);

  const statusMap = {
    "planned full supply": {
      className: "delivered",
      label: "Planned Full Supply",
    },
    "planned partial supply": {
      className: "partial",
      label: "Planned Partial Supply",
    },
    "no supplies available": {
      className: "partial",
      label: "Reachable, No Supplies Left",
    },
    unreachable: {
      className: "unreachable",
      label: "Unreachable",
    },
  };

  const badge = statusMap[value] || {
    className: "partial",
    label: status || "Pending",
  };

  return `<span class="result-badge ${badge.className}">${badge.label}</span>`;
}

function buildUnmetDemandHtml(rows) {
  const unmetRows = rows.filter((row) =>
    ["Food", "Medicine", "Water", "Blankets"].some(
      (resource) => (row[`unmet${resource}`] ?? 0) > 0,
    ),
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
    const status = normalize(row.status);

    if (status === "unreachable") {
      entries.push(
        `${row.location} is unreachable because no available route was found.`,
      );
    } else if (status === "no supplies available") {
      entries.push(
        `${row.location} is reachable, but no supplies were left by this point in the plan.`,
      );
    } else if (status === "planned partial supply") {
      entries.push(buildSupplyLogEntry("Planned partial supply", row));
    } else {
      entries.push(buildSupplyLogEntry("Planned full supply", row));
    }
  });

  return entries
    .map((entry) => `<div class="log-entry">${entry}</div>`)
    .join("");
}

function buildSupplyLogEntry(prefix, row) {
  return (
    `${prefix} for ${row.location}: ` +
    `${row.deliveredFood || 0} food, ` +
    `${row.deliveredMedicine || 0} medicine, ` +
    `${row.deliveredWater || 0} water, and ` +
    `${row.deliveredBlankets || 0} blankets.`
  );
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
  const urgency = normalize(locationUrgencyMap[locationName]);

  return urgency === "critical" ? "critical-result-row" : "";
}
