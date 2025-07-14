import random
import uuid
import time


class Neuron:
    def __init__(self, x=None, y=None, id=None, threshold=None):
        self.id = id if id else str(uuid.uuid4())
        self.threshold = threshold if threshold else random.uniform(0.3, 1.0)
        self.potential = 0.0
        self.connected_to = []
        self.x = x
        self.y = y

        self.refractory_period = 1.0
        self.last_fired_time = 0.0

    def is_refractory(self):
        return (time.time() - self.last_fired_time) < self.refractory_period

    def stimulate(self, amount):
        if self.is_refractory():
            return False
        self.potential += amount
        if self.potential >= self.threshold:
            return True
        return False

    def fire(self, net=None):
        if self.is_refractory():
            return []

        self.potential = 0.0
        self.last_fired_time = time.time()
        print(f"[Neuron {self.id[:6]}] Fired!")

        fired = [self.id]
        if net:
            for conn_id in self.connected_to:
                target = net.get_neuron(conn_id)
                if target:
                    if target.stimulate(random.uniform(0.2, 0.5)):
                        fired += target.fire(net)
        return fired

    def connect(self, neuron):
        if neuron.id not in self.connected_to:
            self.connected_to.append(neuron.id)
