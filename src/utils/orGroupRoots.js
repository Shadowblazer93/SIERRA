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

    // Create pairs for OR connections at the same nesting level
    for (let i = 1; i < order.length; i += 1) {
      const currentAttr = order[i];
      const prevAttr = order[i - 1];
      // Connector semantics are on the current item (linking prev -> current).
      // The first item's mode is non-semantic and must not break OR grouping.
      const currentMode = normalizePredicateMode(modes[currentAttr]);
      if (currentMode !== 'OR') continue;

      const currentLevel = Number.parseInt(levels[currentAttr], 10) || 0;
      const prevLevel = Number.parseInt(levels[prevAttr], 10) || 0;

      // Connect same-level siblings
      if (currentLevel === prevLevel) {
        pairs.push([
          `${nodeId}_${prevAttr}`,
          `${nodeId}_${currentAttr}`
        ]);
      }
      // Connect parent level to child level when parent has OR mode
      else if (prevLevel < currentLevel && currentLevel === prevLevel + 1) {
        pairs.push([
          `${nodeId}_${prevAttr}`,
          `${nodeId}_${currentAttr}`
        ]);
      }
    }

    // Also handle the case where a parent OR connects to multiple children at the next level
    // by creating pairs between the first and last child at each level
    for (let level = 0; level < Math.max(...Object.values(levels)); level++) {
      const itemsAtLevel = order.filter(attr => (Number.parseInt(levels[attr], 10) || 0) === level);
      const itemsAtNextLevel = order.filter(attr => (Number.parseInt(levels[attr], 10) || 0) === level + 1);
      
      if (itemsAtLevel.length > 0 && itemsAtNextLevel.length > 1) {
        // If the last item at the current level has OR mode, connect its children
        const lastAtLevel = itemsAtLevel[itemsAtLevel.length - 1];
        const lastAtLevelMode = normalizePredicateMode(modes[lastAtLevel]);
        
        if (lastAtLevelMode === 'OR' && itemsAtNextLevel.length > 1) {
          // Connect all children at the next level to form a group
          for (let j = 1; j < itemsAtNextLevel.length; j++) {
            const prevChild = itemsAtNextLevel[j - 1];
            const currChild = itemsAtNextLevel[j];
            const currChildMode = normalizePredicateMode(modes[currChild]);
            
            if (currChildMode === 'OR') {
              pairs.push([
                `${nodeId}_${prevChild}`,
                `${nodeId}_${currChild}`
              ]);
            }
          }
        }
      }
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
