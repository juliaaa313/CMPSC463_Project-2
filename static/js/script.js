let locations = [];
let roads = [];
let previousDistributionCenterName = "";

function normalize(value, fallback = "") {
  return String(value ?? fallback).toLowerCase();
}

document.addEventListener("DOMContentLoaded", async () => {
  initializeEmptyState();

  const runBtn = document.getElementById("run-btn");
  const resetBtn = document.getElementById("reset-btn");
  const loadSampleBtn = document.getElementById("load-sample-btn");
  const addLocationBtn = document.getElementById("add-location-btn");
  const addRoadBtn = document.getElementById("add-road-btn");
  const distributionCenterInput = document.getElementById(
    "distribution-center",
  );

  renderAllFrontendState();
  attachScenarioChangeListeners();
  await populateScenarioDropdown();

  if (distributionCenterInput) {
    distributionCenterInput.addEventListener(
      "input",
      handleDistributionCenterChange,
    );
  }

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "Running...";

      showLoadingState();

      try {
        const payload = buildPayloadFromState();

        if (typeof runOptimization === "function") {
          const result = await runOptimization(payload);

          if (typeof renderOptimizationResult === "function") {
            renderOptimizationResult(result, payload);
          }
        }
      } catch (error) {
        console.error(error);
        showErrorState();
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Run Optimization";
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      initializeEmptyState();
      renderAllFrontendState();
      resetResultsPanel();
      clearForms();

      const scenarioSelect = document.getElementById("scenario-select");
      if (scenarioSelect) {
        scenarioSelect.value = "";
      }
    });
  }

  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", async () => {
      const scenarioSelect = document.getElementById("scenario-select");
      const selectedScenario = scenarioSelect?.value || "";

      if (!selectedScenario) {
        alert("Please select a scenario first.");
        return;
      }

      try {
        const scenario = await loadScenarioFromBackend(selectedScenario);
        applyScenarioToState(scenario);
        renderAllFrontendState();
        resetResultsPanel();
        clearForms();
      } catch (error) {
        console.error(error);
        alert("Could not load the selected scenario.");
      }
    });
  }

  if (addLocationBtn) {
    addLocationBtn.addEventListener("click", handleAddLocation);
  }

  if (addRoadBtn) {
    addRoadBtn.addEventListener("click", handleAddRoad);
  }
});

function initializeEmptyState() {
  locations = [];
  roads = [];
  previousDistributionCenterName = "D.C.";

  setElementValue("distribution-center", "");
  setElementValue("food", "");
  setElementValue("medicine", "");
  setElementValue("water", "");
  setElementValue("blankets", "");

  const balancedMode = document.querySelector(
    'input[name="optimizationMode"][value="balanced"]',
  );
  if (balancedMode) {
    balancedMode.checked = true;
  }
}

function applyScenarioToState(scenario) {
  const distributionCenter = scenario.distributionCenter || "D.C.";
  const supplies = scenario.supplies || {};

  setElementValue("distribution-center", distributionCenter);
  setElementValue("food", supplies.food ?? "");
  setElementValue("medicine", supplies.medicine ?? "");
  setElementValue("water", supplies.water ?? "");
  setElementValue("blankets", supplies.blankets ?? "");

  locations = (scenario.locations || []).map((location, index) => ({
    id: location.id || `L${index + 1}`,
    name: location.name,
    type: formatLocationType(location.type || "Shelter"),
    demandFood: Number(location.demandFood || 0),
    demandMedicine: Number(location.demandMedicine || 0),
    demandWater: Number(location.demandWater || 0),
    demandBlankets: Number(location.demandBlankets || 0),
    urgency: location.urgency || "Low",
  }));

  roads = (scenario.roads || []).map((road, index) => ({
    id: road.id || `R${index + 1}`,
    from: road.from,
    to: road.to,
    distance: Number(road.distance || 0),
    status: normalize(road.status, "open"),
  }));

  previousDistributionCenterName = distributionCenter;
}

async function loadScenarioFromBackend(fileName) {
  const response = await fetch(
    `/load-scenario?name=${encodeURIComponent(fileName)}`,
  );

  if (!response.ok) {
    throw new Error("Failed to load scenario.");
  }

  return await response.json();
}

async function populateScenarioDropdown() {
  const scenarioSelect = document.getElementById("scenario-select");
  if (!scenarioSelect) return;

  try {
    const response = await fetch("/list-scenarios");

    if (!response.ok) {
      throw new Error("Failed to fetch scenario list.");
    }

    const scenarioFiles = await response.json();

    scenarioSelect.innerHTML = `
      <option value="">Select a scenario</option>
      ${scenarioFiles
        .map(
          (fileName) =>
            `<option value="${fileName}">${formatScenarioName(fileName)}</option>`,
        )
        .join("")}
    `;
  } catch (error) {
    console.error(error);
    scenarioSelect.innerHTML = `<option value="">No scenarios available</option>`;
  }
}

function formatScenarioName(fileName) {
  return fileName
    .replace(".json", "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderAllFrontendState() {
  if (typeof renderLocationsTable === "function") {
    renderLocationsTable(locations);
  }

  if (typeof renderRoadsTable === "function") {
    renderRoadsTable(roads);
  }

  if (typeof updateRoadDropdowns === "function") {
    updateRoadDropdowns(locations);
  }

  if (typeof renderAllRoutesGraph === "function") {
    renderAllRoutesGraph(getDistributionCenter(), locations, roads);
  }
}

function buildPayloadFromState() {
  return {
    distributionCenter: getDistributionCenter(),
    optimizationMode: getOptimizationMode(),
    supplies: getSuppliesFromInputs(),
    locations,
    roads,
  };
}

function getDistributionCenter() {
  const input = document.getElementById("distribution-center");
  return input ? input.value.trim() || "D.C." : "D.C.";
}

function getOptimizationMode() {
  const selectedMode = document.querySelector(
    'input[name="optimizationMode"]:checked',
  );
  return selectedMode ? selectedMode.value : "balanced";
}

function getSuppliesFromInputs() {
  return {
    food: getNumberValue("food"),
    medicine: getNumberValue("medicine"),
    water: getNumberValue("water"),
    blankets: getNumberValue("blankets"),
  };
}

function handleAddLocation() {
  const nameInput = document.getElementById("location-name");
  const typeSelect = document.getElementById("location-type");
  const foodInput = document.getElementById("location-food-demand");
  const medicineInput = document.getElementById("location-medicine-demand");
  const waterInput = document.getElementById("location-water-demand");
  const blanketInput = document.getElementById("location-blanket-demand");
  const urgencySelect = document.getElementById("location-urgency");

  const name = nameInput?.value.trim() || "";
  const type = formatLocationType(typeSelect?.value || "Shelter");
  const demandFood = Number(foodInput?.value || 0);
  const demandMedicine = Number(medicineInput?.value || 0);
  const demandWater = Number(waterInput?.value || 0);
  const demandBlankets = Number(blanketInput?.value || 0);
  const urgency = urgencySelect?.value || "Low";

  if (!name) {
    alert("Please enter a location name.");
    return;
  }

  const duplicate = locations.some(
    (location) => location.name.toLowerCase() === name.toLowerCase(),
  );

  if (duplicate) {
    alert("A location with this name already exists.");
    return;
  }

  const newLocation = {
    id: generateLocationId(),
    name,
    type,
    demandFood,
    demandMedicine,
    demandWater,
    demandBlankets,
    urgency,
  };

  locations.push(newLocation);
  renderAllFrontendState();
  clearLocationForm();
  resetResultsPanel();
}

function handleAddRoad() {
  const fromSelect = document.getElementById("road-from");
  const toSelect = document.getElementById("road-to");
  const distanceInput = document.getElementById("road-distance");
  const statusSelect = document.getElementById("road-status");

  const from = fromSelect?.value || "";
  const to = toSelect?.value || "";
  const distance = Number(distanceInput?.value || 0);
  const status = normalize(statusSelect?.value, "open");

  if (!from || !to) {
    alert("Please select both road endpoints.");
    return;
  }

  if (from === to) {
    alert("A road must connect two different locations.");
    return;
  }

  if (distance <= 0) {
    alert("Please enter a valid road distance greater than 0.");
    return;
  }

  const duplicate = roads.some(
    (road) =>
      (road.from === from && road.to === to) ||
      (road.from === to && road.to === from),
  );

  if (duplicate) {
    alert("A road between these two locations already exists.");
    return;
  }

  const newRoad = {
    id: generateRoadId(),
    from,
    to,
    distance,
    status,
  };

  roads.push(newRoad);
  renderAllFrontendState();
  clearRoadForm();
  resetResultsPanel();
}

function deleteLocation(locationId) {
  const locationToDelete = locations.find(
    (location) => location.id === locationId,
  );

  if (!locationToDelete) return;

  const confirmed = confirm(
    `Delete ${locationToDelete.name}? Any connected roads will also be removed.`,
  );

  if (!confirmed) return;

  locations = locations.filter((location) => location.id !== locationId);

  roads = roads.filter(
    (road) =>
      road.from !== locationToDelete.name && road.to !== locationToDelete.name,
  );

  renderAllFrontendState();
  resetResultsPanel();
}

function deleteRoad(roadId) {
  const roadToDelete = roads.find((road) => road.id === roadId);

  if (!roadToDelete) return;

  const confirmed = confirm(
    `Delete road: ${roadToDelete.from} → ${roadToDelete.to}?`,
  );

  if (!confirmed) return;

  roads = roads.filter((road) => road.id !== roadId);

  renderAllFrontendState();
  resetResultsPanel();
}

function generateLocationId() {
  const maxNumber = locations.reduce((max, location) => {
    const match = String(location.id || "").match(/^L(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `L${maxNumber + 1}`;
}

function generateRoadId() {
  const maxNumber = roads.reduce((max, road) => {
    const match = String(road.id || "").match(/^R(\d+)$/);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `R${maxNumber + 1}`;
}

function formatLocationType(typeValue) {
  const value = normalize(typeValue);

  if (value === "clinic") return "Clinic";
  if (value === "village") return "Village";
  return "Shelter";
}

function attachScenarioChangeListeners() {
  const watchedIds = [
    "food",
    "medicine",
    "water",
    "blankets",
    "road-distance",
    "location-name",
    "location-food-demand",
    "location-medicine-demand",
    "location-water-demand",
    "location-blanket-demand",
  ];

  watchedIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener("input", () => {
      resetResultsPanel();
    });
  });

  const watchedSelects = [
    "location-type",
    "location-urgency",
    "road-from",
    "road-to",
    "road-status",
  ];

  watchedSelects.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener("change", () => {
      resetResultsPanel();
    });
  });

  const modeInputs = document.querySelectorAll(
    'input[name="optimizationMode"]',
  );

  modeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      resetResultsPanel();
    });
  });
}

function handleDistributionCenterChange() {
  const currentDistributionCenterName = getDistributionCenter();

  roads = roads.map((road) => {
    const updatedRoad = { ...road };

    if (updatedRoad.from === previousDistributionCenterName) {
      updatedRoad.from = currentDistributionCenterName;
    }

    if (updatedRoad.to === previousDistributionCenterName) {
      updatedRoad.to = currentDistributionCenterName;
    }

    return updatedRoad;
  });

  previousDistributionCenterName = currentDistributionCenterName;

  renderAllFrontendState();
  resetResultsPanel();
}

function clearLocationForm() {
  setElementValue("location-name", "");
  setElementValue("location-type", "shelter");
  setElementValue("location-food-demand", "");
  setElementValue("location-medicine-demand", "");
  setElementValue("location-water-demand", "");
  setElementValue("location-blanket-demand", "");
  setElementValue("location-urgency", "Critical");
}

function clearRoadForm() {
  const fromSelect = document.getElementById("road-from");
  const toSelect = document.getElementById("road-to");
  const distanceInput = document.getElementById("road-distance");
  const statusSelect = document.getElementById("road-status");

  if (distanceInput) distanceInput.value = "";
  if (statusSelect) statusSelect.value = "open";

  if (fromSelect && fromSelect.options.length > 0) {
    fromSelect.selectedIndex = 0;
  }

  if (toSelect && toSelect.options.length > 0) {
    toSelect.selectedIndex = 0;
  }
}

function clearForms() {
  clearLocationForm();
  clearRoadForm();
}

function resetResultsPanel() {
  const container = document.getElementById("results-container");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <p>Run optimization to see results.</p>
    </div>
  `;
}

function showLoadingState() {
  const container = document.getElementById("results-container");
  if (!container) return;

  container.innerHTML = `
    <div class="loading-state">
      <p>Running optimization...</p>
    </div>
  `;
}

function showErrorState() {
  const container = document.getElementById("results-container");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <p>Optimization could not be completed.</p>
    </div>
  `;
}

function setElementValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function getNumberValue(id) {
  return Number(document.getElementById(id)?.value || 0);
}
