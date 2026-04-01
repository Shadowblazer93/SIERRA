const normalizePredicateMode = (mode) => (String(mode || '').toUpperCase() === 'OR' ? 'OR' : 'AND');

const normalizePredicateNesting = (predicateNesting, predicateKeys) => {
  const source = (predicateNesting && typeof predicateNesting === 'object') ? predicateNesting : {};
  const sourceOrder = Array.isArray(source.order) ? source.order : [];
  const sourceLevels = (source.levels && typeof source.levels === 'object') ? source.levels : {};
  const sourceModes = (source.modes && typeof source.modes === 'object') ? source.modes : {};

  const keySet = new Set(predicateKeys);
  const seen = new Set();
  const normalizedOrder = [];

  sourceOrder.forEach((attr) => {
    if (!keySet.has(attr) || seen.has(attr)) return;
    seen.add(attr);
    normalizedOrder.push(attr);
  });

  predicateKeys.forEach((attr) => {
    if (seen.has(attr)) return;
    seen.add(attr);
    normalizedOrder.push(attr);
  });

  const normalizedLevels = {};
  const normalizedModes = {};
  normalizedOrder.forEach((attr, index) => {
    const raw = Number.parseInt(sourceLevels[attr], 10);
    const safeLevel = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const maxLevel = index === 0 ? safeLevel : (normalizedLevels[normalizedOrder[index - 1]] + 1);
    normalizedLevels[attr] = Math.min(safeLevel, maxLevel);
    normalizedModes[attr] = normalizePredicateMode(sourceModes[attr]);
  });

  return {
    order: normalizedOrder,
    levels: normalizedLevels,
    modes: normalizedModes
  };
};

const getNestingOrPairs = (nodes = []) => {
  const pairs = [];

  (nodes || []).forEach((node) => {
    const nodeId = node?.id;
    const predicates = node?.data?.predicates || {};
    const attrs = Object.keys(predicates);
    if (!nodeId || attrs.length < 2) return;

    const normalized = normalizePredicateNesting(node?.data?.predicateNesting, attrs);
    const order = normalized.order || [];
    const levels = normalized.levels || {};
    const modes = normalized.modes || {};

    for (let i = 1; i < order.length; i += 1) {
      const currentAttr = order[i];
      const prevAttr = order[i - 1];
      const connector = normalizePredicateMode(modes[currentAttr]);
      if (connector !== 'OR') continue;

      const currentLevel = Number.parseInt(levels[currentAttr], 10) || 0;
      const prevLevel = Number.parseInt(levels[prevAttr], 10) || 0;

      // Keep OR unions local to sibling items in the same bracket level.
      if (currentLevel !== prevLevel) continue;

      pairs.push([
        `${nodeId}_${prevAttr}`,
        `${nodeId}_${currentAttr}`
      ]);
    }
  });

  return pairs;
};

export const buildOrGroupRoots = (nodes = [], orLinks = []) => {
  const parents = {};

  const ensure = (key) => {
    if (!key) return;
    if (!parents[key]) parents[key] = key;
  };

  const find = (key) => {
    if (!parents[key]) return undefined;
    if (parents[key] === key) return key;
    parents[key] = find(parents[key]);
    return parents[key];
  };

  const union = (a, b) => {
    ensure(a);
    ensure(b);
    const rootA = find(a);
    const rootB = find(b);
    if (rootA && rootB && rootA !== rootB) {
      parents[rootA] = rootB;
    }
  };

  (orLinks || []).forEach((link) => {
    const fromKey = `${link.from.nodeId}_${link.from.attr}`;
    const toKey = `${link.to.nodeId}_${link.to.attr}`;
    union(fromKey, toKey);
  });

  getNestingOrPairs(nodes).forEach(([a, b]) => {
    union(a, b);
  });

  const rootByKey = {};
  Object.keys(parents).forEach((key) => {
    rootByKey[key] = find(key) || key;
  });

  return rootByKey;
};
