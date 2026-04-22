async function runOptimization(payload) {
  const response = await fetch("/optimize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to run optimization.");
  }

  return await response.json();
}
