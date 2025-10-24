joint.shapes.logic = {};

joint.shapes.logic.Gate = joint.shapes.standard.Rectangle.extend({
    defaults: joint.util.deepSupplement({
        type: 'logic.Gate',
        attrs: {
            body: {
                strokeWidth: 2
            },
            label: {
                fontSize: 14,
                fontWeight: 'bold'
            }
        },
        ports: {
            groups: {
                'in': {
                    position: 'left',
                    label: {
                        position: 'left'
                    },
                    attrs: {
                        portBody: {
                            magnet: 'passive',
                            r: 5,
                            fill: '#023047',
                            stroke: '#023047'
                        }
                    }
                },
                'out': {
                    position: 'right',
                    label: {
                        position: 'right'
                    },
                    attrs: {
                        portBody: {
                            magnet: true,
                            r: 5,
                            fill: '#E6A502',
                            stroke: '#000000'
                        }
                    }
                }
            }
        }
    }, joint.shapes.standard.Rectangle.prototype.defaults)
});

joint.shapes.logic.And = joint.shapes.logic.Gate.extend({
    defaults: joint.util.deepSupplement({
        type: 'logic.And',
        attrs: {
            label: {
                text: 'AND'
            }
        },
        ports: {
            items: [
                { group: 'in', args: { y: 10 } },
                { group: 'in', args: { y: 30 } },
                { group: 'out' }
            ]
        }
    }, joint.shapes.logic.Gate.prototype.defaults)
});

joint.shapes.logic.Or = joint.shapes.logic.Gate.extend({
    defaults: joint.util.deepSupplement({
        type: 'logic.Or',
        attrs: {
            label: {
                text: 'OR'
            }
        },
        ports: {
            items: [
                { group: 'in', args: { y: 10 } },
                { group: 'in', args: { y: 30 } },
                { group: 'out' }
            ]
        }
    }, joint.shapes.logic.Gate.prototype.defaults)
});

joint.shapes.logic.Not = joint.shapes.logic.Gate.extend({
    defaults: joint.util.deepSupplement({
        type: 'logic.Not',
        attrs: {
            label: {
                text: 'NOT'
            }
        },
        ports: {
            items: [
                { group: 'in' },
                { group: 'out' }
            ]
        }
    }, joint.shapes.logic.Gate.prototype.defaults)
});

joint.shapes.logic.Input = joint.shapes.logic.Gate.extend({
    defaults: joint.util.deepSupplement({
        type: 'logic.Input',
        attrs: {
            label: {
                text: 'INPUT'
            }
        },
        ports: {
            items: [
                { group: 'out' }
            ]
        }
    }, joint.shapes.logic.Gate.prototype.defaults)
});
