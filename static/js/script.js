document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("run-btn");
  const resetBtn = document.getElementById("reset-btn");
  const loadSampleBtn = document.getElementById("load-sample-btn");
  const addLocationBtn = document.getElementById("add-location-btn");
  const addRoadBtn = document.getElementById("add-road-btn");

  const initialPayload = buildSamplePayloadFromForm();

  if (typeof renderAllRoutesGraph === "function") {
    renderAllRoutesGraph(
      initialPayload.distributionCenter,
      initialPayload.locations,
      initialPayload.roads,
    );
  }

  if (runBtn) {
    runBtn.addEventListener("click", async () => {
      runBtn.disabled = true;
      runBtn.textContent = "Running...";

      try {
        const payload = buildSamplePayloadFromForm();

        if (typeof runOptimization === "function") {
          const result = await runOptimization(payload);

          if (typeof renderOptimizationResult === "function") {
            renderOptimizationResult(result, payload);
          }
        }
      } catch (error) {
        console.error(error);
        alert("Optimization could not be completed.");
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "Run Optimization";
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

  if (loadSampleBtn) {
    loadSampleBtn.addEventListener("click", () => {
      window.location.reload();
    });
  }

  if (addLocationBtn) {
    addLocationBtn.addEventListener("click", () => {
      alert("Dynamic add-location behavior will be connected next.");
    });
  }

  if (addRoadBtn) {
    addRoadBtn.addEventListener("click", () => {
      alert("Dynamic add-road behavior will be connected next.");
    });
  }
});

function buildSamplePayloadFromForm() {
  const food = Number(document.getElementById("food").value || 0);
  const medicine = Number(document.getElementById("medicine").value || 0);
  const water = Number(document.getElementById("water").value || 0);
  const blankets = Number(document.getElementById("blankets").value || 0);
  const distributionCenter =
    document.getElementById("distribution-center").value || "Supply D.C.";

  const selectedMode = document.querySelector(
    'input[name="optimizationMode"]:checked',
  );
  const optimizationMode = selectedMode ? selectedMode.value : "balanced";

  return {
    distributionCenter,
    optimizationMode,
    supplies: {
      food,
      medicine,
      water,
      blankets,
    },
    locations: [
      {
        id: "L1",
        name: "Shelter 1",
        type: "Shelter",
        demandFood: 30,
        demandMedicine: 10,
        urgency: "High",
      },
      {
        id: "L2",
        name: "Clinic 1",
        type: "Clinic",
        demandFood: 20,
        demandMedicine: 40,
        urgency: "Critical",
      },
      {
        id: "L3",
        name: "Village 1",
        type: "Village",
        demandFood: 50,
        demandMedicine: 15,
        urgency: "Medium",
      },
    ],
    roads: [
      { from: "Supply D.C.", to: "Shelter 1", distance: 6, status: "open" },
      { from: "Supply D.C.", to: "Clinic 1", distance: 10, status: "damaged" },
      { from: "Supply D.C.", to: "Village 1", distance: 9, status: "open" },
      { from: "Shelter 1", to: "Clinic 1", distance: 4, status: "open" },
      { from: "Clinic 1", to: "Village 1", distance: 5, status: "blocked" },
    ],
  };
}
