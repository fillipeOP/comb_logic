from collections import deque
from .models import Circuit

def simulate_circuit(circuit: Circuit, inputs: dict):
    gate_outputs = {}


    # Initialize a dictionary to store the in-degree of each gate
    in_degree = {gate.id: 0 for gate in circuit.gates}

    # Create an adjacency list representation of the circuit graph
    adj = {gate.id: [] for gate in circuit.gates}

    # Populate the in-degree and adjacency list
    for conn in circuit.connections:
        adj[conn.from_gate].append(conn.to_gate)
        in_degree[conn.to_gate] += 1

    # Initialize a queue for topological sorting with all gates that have an in-degree of 0
    queue = deque([gate.id for gate in circuit.gates if in_degree[gate.id] == 0])

    # List to store the topologically sorted gates
    sorted_gates = []

    # Perform topological sorting
    while queue:
        gate_id = queue.popleft()
        sorted_gates.append(gate_id)

        # For each neighbor of the current gate, decrement its in-degree
        for neighbor_id in adj.get(gate_id, []):
            in_degree[neighbor_id] -= 1
            # If the in-degree becomes 0, add it to the queue
            if in_degree[neighbor_id] == 0:
                queue.append(neighbor_id)

    # Check for cycles in the circuit
    if len(sorted_gates) != len(circuit.gates):
        raise ValueError("Circuit contains a cycle")

    # Evaluate gates in the topologically sorted order
    for gate_id in sorted_gates:
        gate = next((g for g in circuit.gates if g.id == gate_id), None)
        if not gate:
            raise ValueError(f"Gate with id {gate_id} not found")

        # Handle INPUT gates
        if gate.type == 'INPUT':
            output = inputs.get(gate.output)
            if output is None:
                raise ValueError(f"Input value for {gate.output} not provided")
            gate_outputs[gate_id] = output
            continue

        # Collect inputs for the current gate from its predecessors' outputs
        gate_inputs = []
        for connection in circuit.connections:
            if connection.to_gate == gate_id:
                from_gate_output = gate_outputs.get(connection.from_gate)
                if from_gate_output is None:
                    raise ValueError(f"Output of gate {connection.from_gate} not yet computed")
                gate_inputs.append(from_gate_output)

        # Compute the output of the current gate based on its type and inputs
        output = 0
        if gate.type == 'AND':
            output = all(gate_inputs)
        elif gate.type == 'OR':
            output = any(gate_inputs)
        elif gate.type == 'NOT':
            output = not gate_inputs[0]
        elif gate.type == 'NAND':
            output = not all(gate_inputs)
        elif gate.type == 'NOR':
            output = not any(gate_inputs)
        elif gate.type == 'XOR':
            output = sum(gate_inputs) % 2
        elif gate.type == 'XNOR':
            output = not (sum(gate_inputs) % 2)
        elif gate.type == 'BUFFER':
            output = gate_inputs[0]

        # Store the computed output
        gate_outputs[gate_id] = output

    # Determine the final output of the circuit
    final_output = {}
    output_gates = [g for g in circuit.gates if g.type == 'OUTPUT']
    for out_gate in output_gates:
        # Find the gate connected to this output gate
        for conn in circuit.connections:
            if conn.to_gate == out_gate.id:
                final_output[out_gate.output] = gate_outputs.get(conn.from_gate)
                break

    return final_output
