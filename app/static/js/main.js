
const namespace = joint.shapes;
const graph = new joint.dia.Graph({}, { cellNamespace: namespace });

const paper = new joint.dia.Paper({
    el: document.getElementById('paper-container'),
    model: graph,
    width: 800,
    height: 600,
    gridSize: 10,
    drawGrid: true,
    background: {
        color: 'rgba(240, 240, 240, 0.9)'
    },
    cellViewNamespace: namespace
});

paper.on('element:pointerdblclick', function(elementView) {
    const newName = prompt('Enter new name for the gate:', elementView.model.attr('label/text'));
    if (newName) {
        elementView.model.attr('label/text', newName);
    }
});

paper.el.addEventListener('drop', (event) => {
    event.preventDefault();
    const circuitData = JSON.parse(event.dataTransfer.getData('text/plain'));
    const x = event.clientX - paper.el.getBoundingClientRect().left;
    const y = event.clientY - paper.el.getBoundingClientRect().top;

    const subCircuit = new joint.shapes.standard.Rectangle({
        position: { x, y },
        size: { width: 100, height: 50 + circuitData.inputs.length * 15 },
        attrs: {
            body: {
                fill: 'lightblue'
            },
            label: {
                text: circuitData.name,
                fill: 'black'
            }
        },
        ports: {
            groups: {
                'in': {
                    position: 'left',
                    label: { position: 'left' }
                },
                'out': {
                    position: 'right',
                    label: { position: 'right' }
                }
            }
        }
    });

    circuitData.inputs.forEach((input, index) => {
        subCircuit.addPort({ group: 'in', args: { y: 40 + index * 20 }, attrs: { portLabel: { text: input } } });
    });

    circuitData.outputs.forEach((output, index) => {
        subCircuit.addPort({ group: 'out', args: { y: 40 + index * 20 }, attrs: { portLabel: { text: output } } });
    });

    subCircuit.addTo(graph);
});

paper.el.addEventListener('dragover', (event) => {
    event.preventDefault();
});


const andGate = new joint.shapes.logic.And({
    position: { x: 100, y: 100 }
});

const orGate = new joint.shapes.logic.Or({
    position: { x: 300, y: 100 }
});

const notGate = new joint.shapes.logic.Not({
    position: { x: 500, y: 100 }
});

graph.addCells([andGate, orGate, notGate]);


// Testing and Validation Logic

document.getElementById('add-input').addEventListener('click', () => {
    const inputsContainer = document.getElementById('inputs-container');
    const inputDiv = document.createElement('div');
    inputDiv.innerHTML = `
        <input type="text" placeholder="Input Name">
        <select>
            <option value="0">0</option>
            <option value="1">1</option>
        </select>
    `;
    inputsContainer.appendChild(inputDiv);
});

document.getElementById('run-test').addEventListener('click', runTest);
document.getElementById('generate-truth-table').addEventListener('click', generateTruthTable);

document.getElementById('search-button').addEventListener('click', searchCircuits);
document.getElementById('save-button').addEventListener('click', saveCircuit);
document.getElementById('add-input-gate').addEventListener('click', addInputGate);
document.getElementById('create-from-equation').addEventListener('click', createFromEquation);


window.addEventListener('load', loadSubCircuits);

function loadSubCircuits() {
    fetch('/api/circuits')
        .then(response => response.json())
        .then(data => {
            const subCircuitsList = document.getElementById('sub-circuits-list');
            subCircuitsList.innerHTML = '';
            data.forEach(circuit => {
                const listItem = document.createElement('li');
                listItem.textContent = circuit.name;
                listItem.setAttribute('data-circuit', JSON.stringify(circuit));
                makeDraggable(listItem);
                subCircuitsList.appendChild(listItem);
            });
        });
}

function makeDraggable(element) {
    element.setAttribute('draggable', true);
    element.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', element.getAttribute('data-circuit'));
    });
}

function searchCircuits() {
    const query = document.getElementById('search-input').value;
    fetch(`/api/circuits/search?q=${query}`)
        .then(response => response.json())
        .then(data => {
            // Display search results
            console.log(data);
        });
}

function saveCircuit() {
    const name = prompt('Enter a name for the circuit:');
    if (!name) return;

    const circuit = getCircuitData();
    circuit.name = name;

    const inputs = circuit.gates.filter(g => g.type === 'INPUT').map(g => g.output);
    const outputs = []; // TBD: How to define outputs

    circuit.inputs = inputs;
    circuit.outputs = outputs;

    fetch('/api/circuits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(circuit)
    })
    .then(response => {
        if (response.ok) {
            loadSubCircuits();
        } else {
            alert('Error saving circuit');
        }
    });
}

function addInputGate() {
    const name = prompt('Enter a name for the input gate:');
    if (!name) return;

    const inputGate = new joint.shapes.logic.Input({
        position: { x: 50, y: 50 },
        attrs: {
            label: {
                text: name
            }
        }
    });
    graph.addCell(inputGate);
}

function createFromEquation() {
    const equation = document.getElementById('equation-input').value;
    if (!equation) return;

    fetch('/api/circuits/from_equation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equation })
    })
    .then(response => response.json())
    .then(data => {
        graph.fromJSON(JSON.parse(data));
    });
}

function searchCircuits() {
    const query = document.getElementById('search-input').value;
    fetch(`/api/circuits/search?q=${query}`)
        .then(response => response.json())
        .then(data => {
            // Display search results
            console.log(data);
        });
}

function getCircuitData() {
    const cells = graph.getCells();
    const gates = [];
    const connections = [];

    cells.forEach(cell => {
        if (cell.isElement()) {
            gates.push({
                id: cell.id,
                type: cell.attributes.type.split('.')[1].toUpperCase(),
                output: cell.attr('label/text')
            });
        } else if (cell.isLink()) {
            connections.push({
                from_gate: cell.source().id,
                to_gate: cell.target().id,
                to_input: cell.target().port
            });
        }
    });

    return { name: 'test_circuit', gates, connections };
}

function runTest() {
    const inputsContainer = document.getElementById('inputs-container');
    const inputs = {};
    inputsContainer.querySelectorAll('div').forEach(inputDiv => {
        const name = inputDiv.querySelector('input').value;
        const value = parseInt(inputDiv.querySelector('select').value);
        if (name) {
            inputs[name] = value;
        }
    });

    const circuit = getCircuitData();

    fetch('/api/circuits/simulate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ circuit, inputs })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('test-output').textContent = data.output;
    });
}

function generateTruthTable() {
    const circuit = getCircuitData();
    const inputGates = circuit.gates.filter(g => g.type === 'INPUT');

    if (inputGates.length > 6) {
        alert('Truth table can only be generated for circuits with up to 6 inputs.');
        return;
    }

    const table = document.getElementById('truth-table');
    table.innerHTML = ''; // Clear previous table

    const header = table.createTHead();
    const headerRow = header.insertRow(0);
    inputGates.forEach(gate => {
        const cell = headerRow.insertCell(-1);
        cell.textContent = gate.output;
    });
    const outputCell = headerRow.insertCell(-1);
    outputCell.textContent = 'Output';

    const numRows = 2 ** inputGates.length;
    for (let i = 0; i < numRows; i++) {
        const inputs = {};
        const row = table.insertRow(-1);
        for (let j = 0; j < inputGates.length; j++) {
            const inputName = inputGates[j].output;
            const inputValue = (i >> (inputGates.length - 1 - j)) & 1;
            inputs[inputName] = inputValue;

            const cell = row.insertCell(-1);
            cell.textContent = inputValue;
        }

        fetch('/api/circuits/simulate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ circuit, inputs })
        })
        .then(response => response.json())
        .then(data => {
            const outputCell = row.insertCell(-1);
            outputCell.textContent = data.output ? 1 : 0;
        });
    }
}
