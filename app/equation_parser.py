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
            return gate_id, gate_id

        elif isinstance(sub_expression, boolean.NOT):
            gate = Gate(id=str(gate_id), type='NOT')
            from_gate_id, _ = build_circuit(sub_expression.args[0])
            connection = Connection(from_gate=str(from_gate_id), to_gate=str(gate_id), to_input='in')
            circuit.gates.append(gate)
            circuit.connections.append(connection)
            return gate_id, gate_id

        elif isinstance(sub_expression, boolean.AND) or isinstance(sub_expression, boolean.OR):
            gate_type = 'AND' if isinstance(sub_expression, boolean.AND) else 'OR'
            gate = Gate(id=str(gate_id), type=gate_type)
            circuit.gates.append(gate)

            for i, arg in enumerate(sub_expression.args):
                from_gate_id, _ = build_circuit(arg)
                connection = Connection(from_gate=str(from_gate_id), to_gate=str(gate_id), to_input=f'in{i+1}')
                circuit.connections.append(connection)

            return gate_id, gate_id

        return None, None


    build_circuit(expression)
    return circuit
