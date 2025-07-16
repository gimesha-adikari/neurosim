import random
import uuid
import time

class Neuron:
    def __init__(self, x=None, y=None, id=None, threshold=None):
        # Unique ID for each neuron
        self.id = id if id else str(uuid.uuid4())

        # Random or provided firing threshold
        self.threshold = threshold if threshold else random.uniform(0.3, 1.0)

        # Initial internal potential
        self.potential = 0.0

        # List of connected neuron IDs
        self.connected_to = []

        # Position on canvas (used for UI)
        self.x = x
        self.y = y

        # Cooldown period to prevent constant firing
        self.refractory_period = 1.0
        self.last_fired_time = 0.0

    def is_refractory(self):
        # Check if the neuron is still in its cooldown period
        return (time.time() - self.last_fired_time) < self.refractory_period

    def stimulate(self, amount):
        # Increase internal potential, return True if neuron should fire
        if self.is_refractory():
            return False
        self.potential += amount
        return self.potential >= self.threshold

    def fire(self, net=None):
        # Reset potential and propagate to connected neurons
        if self.is_refractory():
            return []

        self.potential = 0.0
        self.last_fired_time = time.time()
        print(f"[Neuron {self.id[:6]}] Fired!")

        fired = [self.id]

        if net:
            for conn_id in self.connected_to:
                target = net.get_neuron(conn_id)
                if target and target.stimulate(random.uniform(0.2, 0.5)):
                    fired += target.fire(net)

        return fired

    def connect(self, neuron):
        # Add connection if not already connected
        if neuron.id not in self.connected_to:
            self.connected_to.append(neuron.id)
