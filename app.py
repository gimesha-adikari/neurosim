from flask import Flask, render_template, jsonify, request, session
from flask_session import Session
from datetime import datetime
from simulation import NeuralNet, initialize_db
from auth import auth
from cs50 import SQL
from datetime import datetime, timedelta

app = Flask(__name__)
app.secret_key = "your_secret_key"
app.config["SESSION_TYPE"] = "filesystem"
Session(app)
app.register_blueprint(auth)
net = NeuralNet()

db = SQL("sqlite:///neural_net.db")


@app.context_processor
def inject_user():
    return {"current_user": session.get("user_id")}


@app.context_processor
def inject_now():
    return {'current_year': datetime.now().year}


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")


@app.route("/simulate", methods=["GET"])
def simulate():
    user_id = session.get("user_id")
    if not user_id:
        return render_template("unauthorized.html"), 403

    net.load_from_db(user_id)
    return render_template("simulate.html")


@app.route("/report", methods=["GET"])
def report():
    return render_template("report.html")


@app.route("/api/add_neuron", methods=["POST"])
def add_neuron():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    x, y = data.get("x"), data.get("y")
    neuron = net.add_neuron(x, y, user_id)
    return jsonify({
        "id": neuron.id,
        "threshold": neuron.threshold,
        "x": neuron.x,
        "y": neuron.y
    })


@app.route("/api/connect_neurons", methods=["POST"])
def connect_neurons():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json
    id1 = data.get("id1")
    id2 = data.get("id2")
    if not id1 or not id2:
        return jsonify({"error": "Both neuron IDs are required"}), 400

    net.connect_neurons(id1, id2, user_id)
    return jsonify({"message": f"Connected neuron {id1} to {id2}."})


@app.route("/api/stimulate", methods=["POST"])
def stimulate():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.json or {}
    neuron_id = data.get("neuron_id")

    if neuron_id:
        neuron = net.get_neuron(neuron_id)
        if not neuron:
            return jsonify({"error": "Neuron ID not found"}), 404
        fired_neurons = net.stimulate_neuron(neuron)
    else:
        neuron = net.get_random_neuron()
        if not neuron:
            return jsonify({"error": "No neurons in network"}), 400
        fired_neurons = net.stimulate_neuron(neuron)

    for fired_id in fired_neurons:
        net.record_firing_event(fired_id, user_id)

    return jsonify({"fired_neurons": fired_neurons, "stimulated_neuron_id": neuron.id})


@app.route("/api/get_network")
def get_network():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    net.load_from_db(user_id)

    neurons_data = [{
        "id": n.id,
        "threshold": n.threshold,
        "x": n.x,
        "y": n.y
    } for n in net.neurons]

    connections_data = []
    for n in net.neurons:
        for conn_id in n.connected_to:
            connections_data.append({"from": n.id, "to": conn_id})

    return jsonify({
        "neurons": neurons_data,
        "connections": connections_data
    })


@app.route("/api/auto_connect", methods=["POST"])
def api_auto_connect():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 403

    net.load_from_db(user_id)
    net.auto_connect(user_id=user_id)
    return jsonify({"message": "Auto connection completed"})


@app.route("/api/clear_network", methods=["POST"])
def clear_network():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 403

    net.clear_user_network(user_id)
    return jsonify({"message": "User network cleared."})


@app.route("/api/report")
def generate_report():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    neurons = db.execute("SELECT * FROM neurons WHERE user_id = ?", user_id)
    connections = db.execute("""
                             SELECT from_id AS 'from', to_id AS 'to'
                             FROM connections
                             WHERE from_id IN (SELECT id FROM neurons WHERE user_id = ?)
                             """, user_id)

    # Fetch firing counts grouped by second
    firing_rows = db.execute("""
                             SELECT strftime('%Y-%m-%d %H:%M:%S', fired_at) AS time_bin, COUNT(*) AS count
                             FROM firing_events
                             WHERE user_id = ?
                             GROUP BY time_bin
                             ORDER BY time_bin ASC
                             """, user_id)

    # Convert to simple time offsets and counts for chart
    if firing_rows:
        first_time = datetime.strptime(firing_rows[0]['time_bin'], "%Y-%m-%d %H:%M:%S")
        firing_activity = []
        for row in firing_rows:
            current_time = datetime.strptime(row['time_bin'], "%Y-%m-%d %H:%M:%S")
            delta_sec = int((current_time - first_time).total_seconds())
            # Extend list length if needed
            while len(firing_activity) <= delta_sec:
                firing_activity.append(0)
            firing_activity[delta_sec] = row['count']
    else:
        firing_activity = []

    # Calculate average firing rate (total firings / total time in seconds)
    total_firings = sum(row['count'] for row in firing_rows)
    duration = (datetime.strptime(firing_rows[-1]['time_bin'],
                                  "%Y-%m-%d %H:%M:%S") - first_time).total_seconds() if firing_rows else 0
    avg_firing_rate = total_firings / duration if duration > 0 else 0

    return jsonify({
        "neurons": neurons,
        "connections": connections,
        "firing_activity": firing_activity,
        "avg_firing_rate": avg_firing_rate,
        "duration": duration
    })


if __name__ == "__main__":
    initialize_db()
    app.run(debug=True)
