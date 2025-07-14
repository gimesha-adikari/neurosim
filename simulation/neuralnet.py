import math
import random
from cs50 import SQL
from simulation.neurone import Neuron

db = SQL("sqlite:///neural_net.db")


class NeuralNet:
    def __init__(self):
        self.neurons = []

    def add_neuron(self, x, y, user_id):
        neuron = Neuron(x, y)
        neuron.user_id = user_id
        self.neurons.append(neuron)
        self.save_neuron_to_db(neuron, user_id)
        return neuron

    def connect_neurons(self, id1, id2, user_id):
        n1 = self.get_neuron(id1)
        n2 = self.get_neuron(id2)
        if n1 and n2:
            n1.connect(n2)
            self.save_connection_to_db(id1, id2, user_id)

    def get_neuron(self, neuron_id):
        return next((n for n in self.neurons if n.id == neuron_id), None)

    def stimulate_neuron(self, neuron):
        if neuron.stimulate(random.uniform(0.2, 0.5)):
            return neuron.fire(net=self)
        return []

    def get_random_neuron(self):
        return random.choice(self.neurons) if self.neurons else None

    def stimulate_random(self):
        neuron = self.get_random_neuron()
        if neuron:
            fired = self.stimulate_neuron(neuron)
            return neuron.id, fired
        return None, []

    def save_neuron_to_db(self, neuron, user_id):
        db.execute(
            "INSERT INTO neurons (id, threshold, x, y, user_id) VALUES (?, ?, ?, ?, ?)",
            neuron.id, neuron.threshold, neuron.x, neuron.y, user_id
        )

    def save_connection_to_db(self, from_id, to_id, user_id):
        existing = db.execute(
            "SELECT * FROM connections WHERE from_id = ? AND to_id = ? AND user_id = ?",
            from_id, to_id, user_id
        )
        if not existing:
            db.execute(
                "INSERT INTO connections (from_id, to_id, user_id) VALUES (?, ?, ?)",
                from_id, to_id, user_id
            )

    def load_from_db(self, user_id):
        self.neurons.clear()
        rows = db.execute("SELECT * FROM neurons WHERE user_id = ?", user_id)
        for row in rows:
            neuron = Neuron(
                x=row["x"], y=row["y"], id=row["id"], threshold=row["threshold"]
            )
            self.neurons.append(neuron)

        connections = db.execute("SELECT from_id, to_id FROM connections WHERE user_id = ?", user_id)
        for row in connections:
            from_neuron = self.get_neuron(row["from_id"])
            to_neuron = self.get_neuron(row["to_id"])
            if from_neuron and to_neuron:
                from_neuron.connect(to_neuron)

    @staticmethod
    def distance(n1, n2):
        return math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2)

    def auto_connect(self, max_distance=200, max_connections_per_neuron=5, base_prob=0.8, user_id=None):
        for neuron in self.neurons:
            candidates = [n for n in self.neurons if n.id != neuron.id and self.distance(neuron, n) <= max_distance]
            random.shuffle(candidates)

            connections_made = 0
            for target in candidates:
                if connections_made >= max_connections_per_neuron:
                    break
                dist = self.distance(neuron, target)
                prob = base_prob * (1 - dist / max_distance)
                if random.random() < prob:
                    neuron.connect(target)
                    connections_made += 1
                    if user_id:
                        self.save_connection_to_db(neuron.id, target.id, user_id)

    def clear_user_network(self, user_id):
        try:
            db.execute("BEGIN")

            db.execute("""
                       DELETE
                       FROM connections
                       WHERE from_id IN (SELECT id FROM neurons WHERE user_id = ?)
                          OR to_id IN (SELECT id FROM neurons WHERE user_id = ?)
                       """, user_id, user_id)

            db.execute("""
                       DELETE
                       FROM firing_events
                       WHERE neuron_id IN (SELECT id FROM neurons WHERE user_id = ?)
                       """, user_id)

            db.execute("DELETE FROM neurons WHERE user_id = ?", user_id)

            db.execute("COMMIT")

            self.neurons = []
            self.connections = []

        except Exception as e:
            db.execute("ROLLBACK")
            raise e

    def record_firing_event(self, neuron_id, user_id):
        db.execute(
            "INSERT INTO firing_events (neuron_id, user_id, fired_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            neuron_id, user_id
        )
