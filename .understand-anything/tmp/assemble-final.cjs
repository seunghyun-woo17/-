#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
const INTER = path.join(ROOT, '.understand-anything', 'intermediate');
const COMMIT = process.argv[3] || '';
const rd = (f) => JSON.parse(fs.readFileSync(path.join(INTER, f), 'utf8'));

const scan = rd('scan-result.json');
const g = rd('assembled-graph.json');
let layers = rd('layers.json');
let tour = rd('tour.json');

// unwrap envelopes
if (!Array.isArray(layers)) layers = layers.layers || [];
if (!Array.isArray(tour)) tour = tour.tour || tour.steps || [];

const nodeIds = new Set(g.nodes.map(n => n.id));

// normalize layers
layers = layers.map(l => ({
  id: l.id || ('layer:' + String(l.name || 'layer').toLowerCase().replace(/\s+/g, '-')),
  name: l.name,
  description: l.description,
  nodeIds: (l.nodeIds || l.nodes || []).map(x => (typeof x === 'string' ? x : x.id)).filter(id => nodeIds.has(id)),
}));

// normalize tour
tour = tour.map(s => ({
  order: s.order,
  title: s.title,
  description: s.description || s.whyItMatters,
  nodeIds: (s.nodeIds || s.nodesToInspect || []).filter(id => nodeIds.has(id)),
  ...(s.languageLesson ? { languageLesson: s.languageLesson } : {}),
})).sort((a, b) => a.order - b.order);

const full = {
  version: '1.0.0',
  project: {
    name: scan.name,
    languages: scan.languages || [],
    frameworks: scan.frameworks || [],
    description: scan.description,
    analyzedAt: new Date().toISOString(),
    gitCommitHash: COMMIT,
  },
  nodes: g.nodes,
  edges: g.edges,
  layers,
  tour,
};

fs.writeFileSync(path.join(INTER, 'assembled-graph.json'), JSON.stringify(full, null, 2));
console.log('assembled: nodes=%d edges=%d layers=%d tour=%d', full.nodes.length, full.edges.length, full.layers.length, full.tour.length);
console.log('project:', full.project.name);
