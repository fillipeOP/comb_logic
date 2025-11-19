const logicGate = {
    fill: '#f4f4f4',
    stroke: '#333',
    'stroke-width': 2
};

const inputPort = {
    position: 'left',
    attrs: {
        portBody: {
            magnet: 'passive',
            r: 5,
            fill: '#023047',
            stroke: '#023047'
        }
    }
};

const outputPort = {
    position: 'right',
    attrs: {
        portBody: {
            magnet: true,
            r: 5,
            fill: '#E6A502',
            stroke: '#000000'
        }
    }
};

joint.shapes.standard.Image.define('logic.Gate', {
    attrs: {
        root: {
            magnet: false
        },
        body: {
            stroke: '#333',
            strokeWidth: 2,
            fill: 'transparent'
        }
    },
    ports: {
        groups: {
            'in': inputPort,
            'out': outputPort
        }
    }
});

const gateImage = (gateName) => ({
    attrs: {
        image: {
            'xlink:href': `/static/img/${gateName}.png`,
            width: 80,
            height: 50
        }
    }
});

const gateWithPorts = (portItems) => ({ ports: { items: portItems } });

const createLogicGate = (name, portItems) =>
    joint.shapes.logic.Gate.extend(
        _.defaultsDeep(
            { type: `logic.${name}` },
            gateImage(name.toUpperCase()),
            gateWithPorts(portItems)
        )
    );

joint.shapes.logic.AND = createLogicGate('And', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.OR = createLogicGate('Or', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.NOT = createLogicGate('Not', [
    { group: 'in', args: { y: 25 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.NAND = createLogicGate('Nand', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.NOR = createLogicGate('Nor', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.XOR = createLogicGate('Xor', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.XNOR = createLogicGate('Xnor', [
    { group: 'in', args: { y: 15 } },
    { group: 'in', args: { y: 35 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.BUFFER = createLogicGate('Buffer', [
    { group: 'in', args: { y: 25 } },
    { group: 'out', args: { y: 25 } }
]);

joint.shapes.logic.Input = joint.shapes.standard.Rectangle.extend({
    defaults: _.defaultsDeep({
        type: 'logic.Input',
        attrs: {
            rect: logicGate,
            label: {
                text: 'INPUT',
                'font-size': 14,
                'font-weight': 'bold'
            }
        },
        ports: {
            items: [{ group: 'out' }]
        }
    }, joint.shapes.standard.Rectangle.prototype.defaults)
});

joint.shapes.logic.Output = joint.shapes.standard.Rectangle.extend({
    defaults: _.defaultsDeep({
        type: 'logic.Output',
        attrs: {
            rect: logicGate,
            label: {
                text: 'OUTPUT',
                'font-size': 14,
                'font-weight': 'bold'
            }
        },
        ports: {
            items: [{ group: 'in' }]
        }
    }, joint.shapes.standard.Rectangle.prototype.defaults)
});
