import json
import os
from flask import Flask, jsonify, render_template, request
from optimizer.simulation import run_simulation

app = Flask(__name__)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/optimize", methods=["POST"])
def optimize():
    data = request.get_json() or {}
    result = run_simulation(data)
    return jsonify(result)


@app.route("/load-scenario", methods=["GET"])
def load_scenario():
    scenario_name = request.args.get("name", "sample_scenarios.json")
    data_path = os.path.join(app.root_path, "data", scenario_name)

    if not os.path.exists(data_path):
        return jsonify({"error": f"Scenario file '{scenario_name}' not found."}), 404

    with open(data_path, "r", encoding="utf-8") as file:
        scenario_data = json.load(file)

    return jsonify(scenario_data)


if __name__ == "__main__":
    app.run(debug=True)