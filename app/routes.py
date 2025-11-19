import json
from flask import current_app as app, render_template, request, jsonify
from .models import Circuit, Gate, Connection
from .equation_parser import parse_equation
from .simulation import simulate_circuit

circuits = {}
CIRCUITS_FILE = 'circuits.json'

def load_circuits():
    global circuits
    try:
        with open(CIRCUITS_FILE, 'r') as f:
            circuits_data = json.load(f)
            for name, data in circuits_data.items():
                circuits[name] = Circuit(
                    name=data['name'],
                    gates=[Gate(**g) for g in data['gates']],
                    connections=[Connection(**c) for c in data['connections']],
                    inputs=data.get('inputs', []),
                    outputs=data.get('outputs', [])
                )
    except FileNotFoundError:
        circuits = {}

def save_circuits():
    with open(CIRCUITS_FILE, 'w') as f:
        json.dump({name: json.loads(c.to_json()) for name, c in circuits.items()}, f, indent=4)

@app.route('/')
def index():
    load_circuits()
    return render_template('index.html')

@app.route('/api/circuits', methods=['GET', 'POST'])
def handle_circuits():
    if request.method == 'GET':
        return jsonify([json.loads(c.to_json()) for c in circuits.values()])

    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Circuit name is required'}), 400
    if name in circuits:
        return jsonify({'error': 'Circuit with this name already exists'}), 400

    circuit = Circuit(
        name,
        data.get('gates'),
        data.get('connections'),
        data.get('inputs'),
        data.get('outputs')
    )
    circuits[name] = circuit
    save_circuits()
    return jsonify(circuit.to_json()), 201

@app.route('/api/circuits/<string:name>', methods=['GET'])
def get_circuit(name):
    circuit = circuits.get(name)
    if not circuit:
        return jsonify({'error': 'Circuit not found'}), 404
    return jsonify(circuit.to_json())

@app.route('/api/circuits/<string:name>', methods=['PUT'])
def update_circuit(name):
    circuit = circuits.get(name)
    if not circuit:
        return jsonify({'error': 'Circuit not found'}), 404

    data = request.get_json()
    circuit.gates = data.get('gates', circuit.gates)
    circuit.connections = data.get('connections', circuit.connections)
    circuit.inputs = data.get('inputs', circuit.inputs)
    circuit.outputs = data.get('outputs', circuit.outputs)
    save_circuits()
    return jsonify(circuit.to_json())

@app.route('/api/circuits/<string:name>', methods=['DELETE'])
def delete_circuit(name):
    if name not in circuits:
        return jsonify({'error': 'Circuit not found'}), 404

    del circuits[name]
    save_circuits()
    return '', 204

@app.route('/api/circuits/from_equation', methods=['POST'])
def create_circuit_from_equation():
    data = request.get_json()
    equation = data.get('equation')
    if not equation:
        return jsonify({'error': 'Equation is required'}), 400

    try:
        circuit = parse_equation(equation)
        return jsonify(circuit.to_json())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/circuits/search', methods=['GET'])
def search_circuits():
    query = request.args.get('q', '').lower()
    results = []
    for name, circuit in circuits.items():
        if query in name.lower() or query in circuit.name.lower():
            results.append(circuit.to_json())
    return jsonify(results)

@app.route('/api/circuits/simulate', methods=['POST'])
def simulate():
    data = request.get_json()
    circuit_data = data.get('circuit')
    inputs = data.get('inputs')

    if not circuit_data or not inputs:
        return jsonify({'error': 'Circuit and inputs are required'}), 400

    try:
        circuit = Circuit(
            name=circuit_data.get('name'),
            gates=[Gate(**g) for g in circuit_data.get('gates')],
            connections=[Connection(**c) for c in circuit_data.get('connections')]
        )
        output = simulate_circuit(circuit, inputs)
        return jsonify({'output': output})
    except Exception as e:
        return jsonify({'error': str(e)}), 400
