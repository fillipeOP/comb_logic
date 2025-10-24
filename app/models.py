import json

class Circuit:
    def __init__(self, name, gates=None, connections=None, inputs=None, outputs=None):
        self.name = name
        self.gates = gates if gates is not None else []
        self.connections = connections if connections is not None else []
        self.inputs = inputs if inputs is not None else []
        self.outputs = outputs if outputs is not None else []

    def to_json(self):
        return json.dumps(self, default=lambda o: o.__dict__,
            sort_keys=True, indent=4)

class Gate:
    def __init__(self, id, type, inputs=None, output=None):
        self.id = id
        self.type = type
        self.inputs = inputs if inputs is not None else []
        self.output = output

class Connection:
    def __init__(self, from_gate, to_gate, to_input):
        self.from_gate = from_gate
        self.to_gate = to_gate
        self.to_input = to_input
