async function runOptimization(payload) {
  try {
    const response = await fetch("/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Optimization error:", error);
    throw error;
  }
}