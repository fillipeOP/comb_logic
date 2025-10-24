from .models import Circuit

def simulate_circuit(circuit: Circuit, inputs: dict):
    gate_outputs = {}

    def get_gate_output(gate_id):
        if gate_id in gate_outputs:
            return gate_outputs[gate_id]

        gate = next((g for g in circuit.gates if g.id == gate_id), None)
        if not gate:
            raise ValueError(f"Gate with id {gate_id} not found")

        if gate.type == 'INPUT':
            output = inputs.get(gate.output)
            if output is None:
                raise ValueError(f"Input value for {gate.output} not provided")
            gate_outputs[gate_id] = output
            return output

        gate_inputs = []
        for connection in circuit.connections:
            if connection.to_gate == gate_id:
                from_gate_output = get_gate_output(connection.from_gate)
                gate_inputs.append(from_gate_output)

        if gate.type == 'AND':
            output = all(gate_inputs)
        elif gate.type == 'OR':
            output = any(gate_inputs)
        elif gate.type == 'NOT':
            output = not gate_inputs[0]
        else:
            raise ValueError(f"Unknown gate type: {gate.type}")

        gate_outputs[gate_id] = output
        return output

    output_gate_ids = [g.id for g in circuit.gates if g.type not in ['INPUT']]

    # find final output gate
    for g_id in output_gate_ids:
        is_output = True
        for c in circuit.connections:
            if c.from_gate == g_id:
                is_output = False
                break
        if is_output:
            final_output_gate_id = g_id
            break

    return get_gate_output(final_output_gate_id)
