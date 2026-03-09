const DEFAULT_AND_COLORS = [
  '#6eae15',
  '#19b4cc',
  '#d4146e',
  '#1b5ac7',
  '#19c962',
  '#ed7417',
  '#a41111',
  '#b99c0c'
];

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const makeSeededRandom = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleColors = (colors, seed) => {
  const copy = [...colors];
  const rand = makeSeededRandom(seed);
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

export const extractWhereClause = (query) => {
  if (!query) return null;
  const upper = query.toUpperCase();
  const whereIndex = upper.indexOf('WHERE');
  if (whereIndex === -1) return null;
  const afterWhere = whereIndex + 5;
  const remainder = upper.slice(afterWhere);
  const clauseTokens = ['RETURN', 'WITH', 'ORDER BY', 'SKIP', 'LIMIT'];
  let nextIndex = -1;
  clauseTokens.forEach((token) => {
    const idx = remainder.indexOf(token);
    if (idx !== -1) {
      const absoluteIdx = afterWhere + idx;
      if (nextIndex === -1 || absoluteIdx < nextIndex) {
        nextIndex = absoluteIdx;
      }
    }
  });
  const endIndex = nextIndex === -1 ? query.length : nextIndex;
  return query.slice(afterWhere, endIndex).trim();
};

export const tokenizeBooleanExpr = (expr) => {
  const tokens = [];
  let buffer = '';
  let quoteChar = null;

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed) tokens.push(trimmed);
    buffer = '';
  };

  const isBoundary = (char) => !char || /\s|\(|\)/.test(char);

  for (let i = 0; i < expr.length; i += 1) {
    const char = expr[i];

    if (quoteChar) {
      buffer += char;
      if (char === quoteChar && expr[i - 1] !== '\\') {
        quoteChar = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quoteChar = char;
      buffer += char;
      continue;
    }

    if (char === '(' || char === ')') {
      flushBuffer();
      tokens.push(char);
      continue;
    }

    const upperSlice = expr.slice(i).toUpperCase();
    if (upperSlice.startsWith('AND') && isBoundary(expr[i - 1]) && isBoundary(expr[i + 3])) {
      flushBuffer();
      tokens.push('AND');
      i += 2;
      continue;
    }

    if (upperSlice.startsWith('OR') && isBoundary(expr[i - 1]) && isBoundary(expr[i + 2])) {
      flushBuffer();
      tokens.push('OR');
      i += 1;
      continue;
    }

    buffer += char;
  }

  flushBuffer();
  return tokens;
};

export const parseBooleanExpr = (tokens) => {
  let position = 0;

  const peek = () => tokens[position];
  const next = () => tokens[position++];

  const parseFactor = () => {
    const token = next();
    if (!token) return null;
    if (token === '(') {
      const node = parseOr();
      if (next() !== ')') {
        throw new Error('Unmatched parenthesis in WHERE clause.');
      }
      return node;
    }
    return { type: 'PRED', value: token };
  };

  const parseAnd = () => {
    let left = parseFactor();
    if (!left) return null;
    while (peek() === 'AND') {
      next();
      const right = parseFactor();
      left = { type: 'AND', terms: [left, right] };
    }
    return left;
  };

  const parseOr = () => {
    let left = parseAnd();
    if (!left) return null;
    while (peek() === 'OR') {
      next();
      const right = parseAnd();
      left = { type: 'OR', terms: [left, right] };
    }
    return left;
  };

  const root = parseOr();
  if (position < tokens.length) {
    throw new Error('Could not parse entire WHERE clause.');
  }
  return root;
};

export const toDNF = (node) => {
  if (!node) return [];
  if (node.type === 'PRED') return [[node.value]];
  if (node.type === 'OR') {
    return node.terms.flatMap(toDNF);
  }
  if (node.type === 'AND') {
    const left = toDNF(node.terms[0]);
    const right = toDNF(node.terms[1]);
    const merged = [];
    left.forEach((lTerm) => {
      right.forEach((rTerm) => {
        merged.push([...lTerm, ...rTerm]);
      });
    });
    return merged;
  }
  return [];
};

export const formatDNF = (dnfTerms) => {
  return dnfTerms
    .map((term) => (term.length > 1 ? `(${term.join(' AND ')})` : term[0]))
    .join(' OR ');
};

const parsePredicateRef = (predicate) => {
  if (!predicate) return null;
  const match = predicate.trim().match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*(=|<>|!=|<=|>=|<|>)/);
  if (!match) return null;
  return { rep: match[1], attr: match[2] };
};

export const buildDnfAndLinksFromQuery = (query, nodes, colors = DEFAULT_AND_COLORS) => {
  const whereClause = extractWhereClause(query);
  if (!whereClause) {
    return {
      andLinks: [],
      participatingNodeIds: new Set(),
      dnfTermsCount: 0,
      hasMixedBoolean: false
    };
  }

  const hasMixedBoolean = /\bAND\b/i.test(whereClause) && /\bOR\b/i.test(whereClause);
  if (!hasMixedBoolean) {
    return {
      andLinks: [],
      participatingNodeIds: new Set(),
      dnfTermsCount: 0,
      hasMixedBoolean: false
    };
  }

  const tokens = tokenizeBooleanExpr(whereClause);
  const ast = parseBooleanExpr(tokens);
  const dnfTerms = toDNF(ast);
  const repToNodeId = {};
  (nodes || []).forEach((node) => {
    if (node?.data?.rep) {
      repToNodeId[node.data.rep] = node.id;
    }
  });

  const paletteSeed = hashString(`${whereClause}-${dnfTerms.length}`);
  const palette = shuffleColors(colors, paletteSeed);

  const andLinks = [];
  const participatingNodeIds = new Set();

  dnfTerms.forEach((term, termIndex) => {
    const clausePreds = term
      .map(parsePredicateRef)
      .filter(Boolean)
      .map((pred) => ({
        ...pred,
        nodeId: repToNodeId[pred.rep]
      }))
      .filter((pred) => pred.nodeId !== undefined && pred.nodeId !== null);

    const uniqueKeys = new Set();
    const orderedPreds = [];
    clausePreds.forEach((pred) => {
      const key = `${pred.nodeId}_${pred.attr}`;
      if (uniqueKeys.has(key)) return;
      uniqueKeys.add(key);
      orderedPreds.push(pred);
    });

    orderedPreds.forEach((pred) => participatingNodeIds.add(pred.nodeId));

    const color = palette[termIndex % palette.length];
    for (let i = 0; i < orderedPreds.length - 1; i += 1) {
      const a = orderedPreds[i];
      const b = orderedPreds[i + 1];
      andLinks.push({
        from: { nodeId: a.nodeId, attr: a.attr },
        to: { nodeId: b.nodeId, attr: b.attr },
        groupId: termIndex,
        color
      });
    }
  });

  return {
    andLinks,
    participatingNodeIds,
    dnfTermsCount: dnfTerms.length,
    hasMixedBoolean
  };
};
