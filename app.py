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


if __name__ == "__main__":
    app.run(debug=True)