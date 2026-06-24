#!/usr/bin/env node
// Build the architecture-analysis input JSON from the assembled graph.
const fs = require('fs');

const inPath = process.argv[2];
const outPath = process.argv[3];

try {
  const raw = fs.readFileSync(inPath, 'utf8');
  const graph = JSON.parse(raw);
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  // File-level node types per dispatch: file, document (function excluded).
  const FILE_LEVEL_TYPES = new Set([
    'file', 'document', 'config', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint'
  ]);

  const fileNodes = nodes.filter(n => FILE_LEVEL_TYPES.has(n.type));
  const fileNodeIds = new Set(fileNodes.map(n => n.id));

  // Edges where both endpoints are file-level nodes (exclude contains to functions).
  const allEdges = edges.filter(e => fileNodeIds.has(e.source) && fileNodeIds.has(e.target));

  // Import-like edges (dependency direction between code-ish nodes).
  const IMPORT_TYPES = new Set(['imports', 'depends_on']);
  const importEdges = allEdges.filter(e => IMPORT_TYPES.has(e.type));

  const payload = {
    fileNodes: fileNodes.map(n => ({
      id: n.id,
      type: n.type,
      name: n.name,
      filePath: n.filePath,
      summary: n.summary || '',
      tags: n.tags || []
    })),
    importEdges,
    allEdges
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.error(`fileNodes=${fileNodes.length} importEdges=${importEdges.length} allEdges=${allEdges.length}`);
  process.exit(0);
} catch (err) {
  console.error('PREP ERROR:', err && err.stack ? err.stack : err);
  process.exit(1);
}
