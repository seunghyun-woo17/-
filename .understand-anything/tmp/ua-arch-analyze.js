#!/usr/bin/env node
// Structural analysis for architecture layer identification.
const fs = require('fs');

const inPath = process.argv[2];
const outPath = process.argv[3];

function dirSegments(p) {
  return p.split('/').filter(Boolean);
}

try {
  const data = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  const fileNodes = data.fileNodes || [];
  const importEdges = data.importEdges || [];
  const allEdges = data.allEdges || [];

  const idToNode = new Map(fileNodes.map(n => [n.id, n]));
  const paths = fileNodes.map(n => n.filePath);

  // ---- Common prefix (by path segment) ----
  function commonPrefixSegments(allPaths) {
    if (allPaths.length === 0) return [];
    const splits = allPaths.map(dirSegments);
    // only consider directory portion (drop file name -> last segment)
    const dirSplits = splits.map(s => s.slice(0, -1));
    let prefix = dirSplits[0].slice();
    for (const s of dirSplits.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
      prefix = prefix.slice(0, i);
    }
    return prefix;
  }
  const prefix = commonPrefixSegments(paths);
  const prefixLen = prefix.length;

  // ---- A. Directory grouping ----
  const directoryGroups = {};
  const fileToGroup = new Map();
  for (const n of fileNodes) {
    const segs = dirSegments(n.filePath);
    const dirOnly = segs.slice(0, -1); // remove filename
    const rel = dirOnly.slice(prefixLen);
    let group;
    if (rel.length === 0) {
      group = '(root)';
    } else {
      group = rel[0];
    }
    if (!directoryGroups[group]) directoryGroups[group] = [];
    directoryGroups[group].push(n.id);
    fileToGroup.set(n.id, group);
  }

  // ---- B. Node type grouping ----
  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
    nodeTypeGroups[n.type].push(n.id);
  }

  // ---- C. Adjacency (fan-in / fan-out) from importEdges ----
  const fileFanOut = {};
  const fileFanIn = {};
  for (const n of fileNodes) { fileFanOut[n.id] = 0; fileFanIn[n.id] = 0; }
  for (const e of importEdges) {
    if (fileFanOut[e.source] !== undefined) fileFanOut[e.source]++;
    if (fileFanIn[e.target] !== undefined) fileFanIn[e.target]++;
  }

  // ---- D. Cross-category dependency analysis (allEdges by node-type pair + edge type) ----
  const crossMap = new Map();
  for (const e of allEdges) {
    const s = idToNode.get(e.source);
    const t = idToNode.get(e.target);
    if (!s || !t) continue;
    if (s.type === t.type) continue; // cross-category only
    const key = `${s.type}|${t.type}|${e.type}`;
    crossMap.set(key, (crossMap.get(key) || 0) + 1);
  }
  const crossCategoryEdges = [...crossMap.entries()].map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('|');
    return { fromType, toType, edgeType, count };
  }).sort((a, b) => b.count - a.count);

  // ---- E. Inter-group import frequency (importEdges) ----
  const interMap = new Map();
  for (const e of importEdges) {
    const g1 = fileToGroup.get(e.source);
    const g2 = fileToGroup.get(e.target);
    if (g1 === undefined || g2 === undefined) continue;
    if (g1 === g2) continue;
    const key = `${g1}|${g2}`;
    interMap.set(key, (interMap.get(key) || 0) + 1);
  }
  const interGroupImports = [...interMap.entries()].map(([k, count]) => {
    const [from, to] = k.split('|');
    return { from, to, count };
  }).sort((a, b) => b.count - a.count);

  // ---- F. Intra-group import density ----
  const intraGroupDensity = {};
  for (const group of Object.keys(directoryGroups)) {
    let internal = 0, total = 0;
    for (const e of importEdges) {
      const g1 = fileToGroup.get(e.source);
      const g2 = fileToGroup.get(e.target);
      const involves = (g1 === group || g2 === group);
      if (involves) {
        total++;
        if (g1 === group && g2 === group) internal++;
      }
    }
    intraGroupDensity[group] = {
      internalEdges: internal,
      totalEdges: total,
      density: total > 0 ? +(internal / total).toFixed(3) : 0
    };
  }

  // ---- G. Directory + file pattern matching ----
  const DIR_PATTERNS = [
    [['routes','api','controllers','endpoints','handlers'], 'api'],
    [['services','core','lib','domain','logic'], 'service'],
    [['models','db','data','persistence','repository','entities'], 'data'],
    [['components','views','pages','ui','layouts','screens'], 'ui'],
    [['middleware','plugins','interceptors','guards'], 'middleware'],
    [['utils','helpers','common','shared','tools'], 'utility'],
    [['config','constants','env','settings'], 'config'],
    [['__tests__','test','tests','spec','specs'], 'test'],
    [['types','interfaces','schemas','contracts','dtos'], 'types'],
    [['hooks'], 'hooks'],
    [['store','state','reducers','actions','slices'], 'state'],
    [['assets','static','public'], 'assets'],
    [['migrations'], 'data'],
    [['docs','documentation','wiki'], 'documentation'],
    [['deploy','deployment','infra','infrastructure'], 'infrastructure'],
    [['css','styles','scss','sass'], 'ui'],
    [['js','scripts','src'], 'service']
  ];
  function matchDir(name) {
    const lower = name.toLowerCase();
    for (const [keys, label] of DIR_PATTERNS) {
      if (keys.includes(lower)) return label;
    }
    return null;
  }
  function matchFile(node) {
    const fp = node.filePath;
    const base = fp.split('/').pop();
    const lower = base.toLowerCase();
    if (/\.(test|spec)\.[a-z]+$/.test(lower) || /^test_.*\.py$/.test(lower) ||
        /_test\.go$/.test(lower) || /test\.java$/.test(lower) || /_spec\.rb$/.test(lower)) return 'test';
    if (/\.d\.ts$/.test(lower)) return 'types';
    if (/\.sql$/.test(lower)) return 'data';
    if (/\.(graphql|gql|proto)$/.test(lower)) return 'types';
    if (/\.(md|rst)$/.test(lower)) return 'documentation';
    if (lower === 'dockerfile' || /^docker-compose/.test(lower)) return 'infrastructure';
    if (/\.(tf|tfvars)$/.test(lower)) return 'infrastructure';
    if (/\.css$/.test(lower)) return 'ui';
    if (/\.html?$/.test(lower)) return 'entry-markup';
    if (lower === 'index.ts' || lower === 'index.js') return 'entry';
    return null;
  }
  const patternMatches = {};
  for (const group of Object.keys(directoryGroups)) {
    const dm = matchDir(group);
    if (dm) patternMatches[group] = dm;
  }
  // file-level pattern hints (per node)
  const filePatternHints = {};
  for (const n of fileNodes) {
    const fm = matchFile(n);
    if (fm) filePatternHints[n.id] = fm;
  }

  // ---- H. Deployment topology ----
  const lowerPaths = paths.map(p => p.toLowerCase());
  const infraFiles = [];
  const hasDockerfile = lowerPaths.some(p => /(^|\/)dockerfile$/.test(p));
  const hasCompose = lowerPaths.some(p => /docker-compose/.test(p));
  const hasK8s = lowerPaths.some(p => /(k8s|kubernetes|helm|charts)\//.test(p));
  const hasTerraform = lowerPaths.some(p => /\.tf$/.test(p));
  const hasCI = lowerPaths.some(p => /\.github\/workflows\//.test(p) || /gitlab-ci/.test(p) || /jenkinsfile/.test(p));
  paths.forEach((p) => {
    const lp = p.toLowerCase();
    if (/(^|\/)dockerfile$/.test(lp) || /docker-compose/.test(lp) || /\.tf$/.test(lp) ||
        /\.github\/workflows\//.test(lp) || /(k8s|kubernetes|helm)\//.test(lp)) {
      infraFiles.push(p);
    }
  });
  const deploymentTopology = { hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI, infraFiles };

  // ---- I. Data pipeline detection ----
  const schemaFiles = paths.filter(p => /\.(sql|graphql|gql|proto|prisma)$/i.test(p));
  const migrationFiles = paths.filter(p => /migrations?\//i.test(p));
  const dataModelFiles = fileNodes.filter(n => (n.tags || []).some(t => /data-model|persistence|schema|orm/i.test(t))).map(n => n.filePath);
  const apiHandlerFiles = fileNodes.filter(n => (n.tags || []).some(t => /api-handler|api-schema|endpoint|route/i.test(t))).map(n => n.filePath);
  const dataPipeline = { schemaFiles, migrationFiles, dataModelFiles, apiHandlerFiles };

  // ---- J. Documentation coverage ----
  const docNodes = fileNodes.filter(n => n.type === 'document' || /\.(md|rst)$/i.test(n.filePath));
  const docGroups = new Set(docNodes.map(n => fileToGroup.get(n.id)));
  const allGroups = Object.keys(directoryGroups);
  const undocumentedGroups = allGroups.filter(g => !docGroups.has(g));
  const docCoverage = {
    groupsWithDocs: docGroups.size,
    totalGroups: allGroups.length,
    coverageRatio: allGroups.length ? +(docGroups.size / allGroups.length).toFixed(2) : 0,
    undocumentedGroups
  };

  // ---- K. Dependency direction ----
  const pairNet = new Map();
  for (const { from, to, count } of interGroupImports) {
    const key = [from, to].sort().join('||');
    if (!pairNet.has(key)) pairNet.set(key, {});
    const obj = pairNet.get(key);
    obj[`${from}>${to}`] = count;
  }
  const dependencyDirection = [];
  for (const [key, obj] of pairNet.entries()) {
    const [a, b] = key.split('||');
    const ab = obj[`${a}>${b}`] || 0;
    const ba = obj[`${b}>${a}`] || 0;
    if (ab === ba) continue;
    if (ab > ba) dependencyDirection.push({ dependent: a, dependsOn: b });
    else dependencyDirection.push({ dependent: b, dependsOn: a });
  }

  // ---- file stats ----
  const filesPerGroup = {};
  for (const g of Object.keys(directoryGroups)) filesPerGroup[g] = directoryGroups[g].length;
  const nodeTypeCounts = {};
  for (const t of Object.keys(nodeTypeGroups)) nodeTypeCounts[t] = nodeTypeGroups[t].length;

  const result = {
    scriptCompleted: true,
    commonPrefix: prefix.join('/'),
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    filePatternHints,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts
    },
    fileFanIn,
    fileFanOut
  };

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  process.exit(0);
} catch (err) {
  console.error('ANALYZE ERROR:', err && err.stack ? err.stack : err);
  process.exit(1);
}
