# Emergency Aid Distribution and Route Optimization System

## Project Description
This project is a web-based humanitarian response simulation that helps an emergency aid distribution center allocate limited supplies and determine efficient delivery routes to affected locations.

The system models locations as graph nodes and roads as weighted edges. It prioritizes locations based on urgency and demand, and applies shortest-path and greedy decision-making strategies to produce an optimized delivery plan under crisis constraints.

This project is inspired by real-world challenges in conflict or post-conflict environments, where infrastructure may be damaged, resources are limited, and decisions must be made quickly.

---

## Features
- Add and manage affected locations
- Define road connections with distance and condition
- Set supply availability (food, medicine, etc.)
- Assign urgency levels to locations
- Compute priority scores
- Generate optimized delivery routes
- Visualize all routes and optimal routes
- Display delivery results and summary statistics

---

## Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Python (Flask)
- Algorithms:
  - Graph Representation
  - Dijkstra’s Algorithm
  - Priority Queue
  - Greedy Allocation Strategy

---
## How to Run the Project

1. Install dependencies (open terminal inside project folder):

```bash
pip install -r requirements.txt
```

2. Run the Flask app:

```bash
python app.py
```

Mac users may need:

```bash
python3 app.py
```

3. Open in browser:

```text
http://127.0.0.1:5000
```
---

## Project Structure
```text
emergency-aid-optimizer/
|
|--- app.py
|--- requirements.txt
|--- README.md
|
|--- optimizer/
| |--- __init__.py
| |--- graph.py
| |--- dijkstra.py
| |--- priority.py
| |--- simulation.py
| 
|---templates/
| |---index.html
|
|---static/
| |---css/
| | |---style.css
| |
| |---js/
| | |--- script.js
| | |--- api.js
| | |--- ui.js
|
|--- data/
| |--- sample_scenarios.json
```
---

## File Descriptions

### Backend Files

**app.py**
- Main Flask application
- Handles routing between frontend and backend
- Receives user input and returns optimization results

---

### optimizer/ (Algorithm Module)

**graph.py**
- Builds the graph structure from user input
- Applies road conditions (open, damaged, blocked)

**dijkstra.py**
- Implements Dijkstra’s algorithm
- Finds the shortest path between locations

**priority.py**
- Calculates priority scores based on urgency and demand

**simulation.py**
- Runs the full delivery simulation
- Uses priority queue, shortest path, and greedy allocation
- Generates final results

---

### Frontend Files

**templates/index.html**
- Main user interface
- Contains forms, tables, and graph containers

---

### static/css/

**style.css**
- Handles layout and styling of the application

---

### static/js/

**script.js**
- Main frontend logic
- Handles button clicks and user interactions

**api.js**
- Sends data from frontend to backend (Flask)
- Receives results as JSON

**ui.js**
- Updates tables, graphs, and summary sections dynamically

---

### Data

**data/sample_scenarios.json**
- Stores sample scenarios for testing and demonstrations
