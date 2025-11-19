import boolean
from .models import Circuit, Gate, Connection

def parse_equation(equation_string):
    algebra = boolean.BooleanAlgebra()
    expression = algebra.parse(equation_string, simplify=True)

    circuit = Circuit(name=equation_string)
    gate_id_counter = 0

    def build_circuit(sub_expression):
        nonlocal gate_id_counter
        gate_id = gate_id_counter
        gate_id_counter += 1

        if isinstance(sub_expression, boolean.Symbol):
            gate = Gate(id=str(gate_id), type='INPUT', output=sub_expression.obj)
            circuit.gates.append(gate)
            circuit.inputs.append(sub_expression.obj)
            return gate_id, gate_id

        elif isinstance(sub_expression, boolean.NOT):
            gate = Gate(id=str(gate_id), type='NOT')
            from_gate_id, _ = build_circuit(sub_expression.args[0])
            connection = Connection(from_gate=str(from_gate_id), to_gate=str(gate_id), to_input='in')
            circuit.gates.append(gate)
            circuit.connections.append(connection)
            return gate_id, gate_id

        elif isinstance(sub_expression, (boolean.AND, boolean.OR, boolean.XOR, boolean.NAND, boolean.NOR, boolean.XNOR)):
            gate_type_map = {
                boolean.AND: 'AND',
                boolean.OR: 'OR',
                boolean.XOR: 'XOR',
                boolean.NAND: 'NAND',
                boolean.NOR: 'NOR',
                boolean.XNOR: 'XNOR'
            }
            gate_type = gate_type_map[type(sub_expression)]
            gate = Gate(id=str(gate_id), type=gate_type)
            circuit.gates.append(gate)

            for i, arg in enumerate(sub_expression.args):
                from_gate_id, _ = build_circuit(arg)
                connection = Connection(from_gate=str(from_gate_id), to_gate=str(gate_id), to_input=f'in{i+1}')
                circuit.connections.append(connection)

            return gate_id, gate_id

        return None, None

    # Build the main circuit
    final_gate_id, _ = build_circuit(expression)

    # Add an output gate
    output_gate_id = gate_id_counter
    output_gate = Gate(id=str(output_gate_id), type='OUTPUT', output='Y')
    circuit.gates.append(output_gate)
    circuit.outputs.append('Y')

    # Connect the final gate to the output gate
    connection = Connection(from_gate=str(final_gate_id), to_gate=str(output_gate_id), to_input='in')
    circuit.connections.append(connection)

    return circuit
