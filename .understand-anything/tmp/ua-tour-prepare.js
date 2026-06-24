const fs = require('fs');
const graph = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const layers = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = { nodes: graph.nodes, edges: graph.edges, layers: layers };
fs.writeFileSync(process.argv[4], JSON.stringify(out));
console.log('input nodes', graph.nodes.length, 'edges', graph.edges.length, 'layers', layers.length);
