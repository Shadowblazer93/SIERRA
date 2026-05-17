const _ = require('lodash');
const neo4j = require('neo4j-driver');
const Constants = require('./constants');

const neo4jUri = process.env.NEO4J_URI;
const neo4jVersion = process.env.NEO4J_VERSION;
let database = 'northwind';
let user = database;
let password = database;
let currentUri = "bolt+s://demo.neo4jlabs.com:7687";

if (!neo4jVersion.startsWith('4')) {
  database = null;
}
function createDriver() {
  return neo4j.driver(currentUri, neo4j.auth.basic(user, password));
}
async function setDatabase(db) {
  let nextDatabase, nextUser, nextPassword, nextUri;

  if (typeof db === 'object' && db !== null) {
    // Custom database connection
    nextDatabase = db.database;
    nextUser = db.username;
    nextPassword = db.password;
    nextUri = db.uri;
  } else {
    // Demo database
    nextDatabase = db && db.length ? db : process.env.NEO4J_DATABASE;
    nextUser = nextDatabase;
    nextPassword = nextDatabase;
    nextUri = "bolt+s://demo.neo4jlabs.com:7687";
  }

  const nextDriver = neo4j.driver(nextUri, neo4j.auth.basic(nextUser, nextPassword));

  try {
    await nextDriver.verifyConnectivity();
  } catch (error) {
    console.error("Failed to connect to Neo4j:", error);
    await nextDriver.close();
    alert("Connection failed. Please check your neo4j credentials. Reverting to demo database.");
    window.location.reload();
    return;
  }

  await driver.close();
  driver = nextDriver;
  
  database = nextDatabase;
  user = nextUser;
  password = nextPassword;
  currentUri = nextUri;

  return database;
}
function getDatabase(db) {
  return database;
}

let driver = createDriver();

// fetch all node entities and list of neighbours for each node entity
async function setUp() {
  const session = driver.session({ database: database });
  const entities = await session
    .readTransaction((tx) => tx.run('MATCH (n) \
    RETURN distinct labels(n)'))
    .then((result) => {
      return result.records.map((record) => {
        return record.get('labels(n)')[0];
      });
    })
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      session.close();
    });
  const neighbours = await getNeighbours(entities);
  return { entities: entities, neighbours: neighbours };
}

// get neighbours of a list of nodes
async function getNeighbours(entities) {
  var finalResult = {};
  await Promise.all(entities.map(async (entity) => {
    var session = driver.session({ database: database });
    var neighbourObj = await session
      .readTransaction(
        async (tx) =>
          await tx.run(`MATCH (n:${entity})-[r]->(o)
        WITH labels(n) as Node,{label:labels(o)[0],type:type(r),props:keys(r)} as Neighbours
        RETURN distinct Node, Neighbours`),
      )
      .then((result) => {
        return result.records.map((record) => {
          return record.get('Neighbours');
        });
      })
      .finally(() => {
        return session.close();
      });
    Object.assign(finalResult, { [entity]: neighbourObj });
  }));

  return finalResult;
}

// get properties of a list of nodes
async function getProperties(entities) {
  var ret = {};
  const results = await Promise.all(entities.map(async (entity) => {
    var session = driver.session({ database: database });
    var retObj = await session
      .readTransaction(
        async (tx) =>
          await tx.run(`MATCH (n:${entity}) \
        RETURN labels(n), keys(n)`),
      )
      .then((result) => {
        var merged = [];
        result.records.forEach((record) => {
          merged = _.union(merged, record.get('keys(n)'));
        });
        return { [entity]: merged };
      })
      .finally(() => {
        return session.close();
      });
    return retObj

  }));
  results.forEach((values) => {
    Object.assign(ret, values);
  })
  return ret;
}

// run query string on underlying property graph
async function getResult(queryString) {
  const session = driver.session({ database: database });
  const result = await session
    .readTransaction((tx) => tx.run(queryString))
    .then((result) => {
      return result.records;
    })
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
  return result;
}

const normalizePredicateNesting = (predicateNesting, attrs) => {
  const source = (predicateNesting && typeof predicateNesting === 'object') ? predicateNesting : {};
  const sourceOrder = Array.isArray(source.order) ? source.order : [];
  const sourceLevels = (source.levels && typeof source.levels === 'object') ? source.levels : {};
  const sourceModes = (source.modes && typeof source.modes === 'object') ? source.modes : {};

  const attrSet = new Set(attrs);
  const seen = new Set();
  const order = [];

  sourceOrder.forEach((attr) => {
    if (!attrSet.has(attr) || seen.has(attr)) return;
    seen.add(attr);
    order.push(attr);
  });

  attrs.forEach((attr) => {
    if (seen.has(attr)) return;
    seen.add(attr);
    order.push(attr);
  });

  const levels = {};
  const modes = {};
  order.forEach((attr, index) => {
    const raw = Number.parseInt(sourceLevels[attr], 10);
    const safeLevel = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const maxLevel = index === 0 ? safeLevel : levels[order[index - 1]] + 1;
    levels[attr] = Math.min(safeLevel, maxLevel);
    modes[attr] = String(sourceModes[attr] || '').toUpperCase() === 'OR' ? 'OR' : 'AND';
  });

  return { order, levels, modes };
};

const normalizeLogicalConnector = (value) => (String(value || '').toUpperCase() === 'OR' ? 'OR' : 'AND');

const renderLogicalTokens = (tokens, omitFirstConnector = true) => {
  if (!tokens || tokens.length === 0) return '';

  return tokens
    .map((token, index) => {
      const connector = normalizeLogicalConnector(token.connector);
      if (index === 0 && omitFirstConnector) {
        return token.expression;
      }
      return `${connector} ${token.expression}`;
    })
    .join(' ');
};

const buildNestedAndExpression = (orderedItems) => {
  if (!orderedItems || orderedItems.length === 0) return '';

  const stack = [[]];

  orderedItems.forEach((item) => {
    let targetLevel = item.level;

    if (targetLevel > stack.length - 1) {
      targetLevel = stack.length;
    }

    while (stack.length - 1 > targetLevel) {
      const finished = stack.pop();
      if (finished.length > 0) {
        const collapsedExpression = `(${renderLogicalTokens(finished, true)})`;
        const collapsedConnector = finished[0]?.connector || 'AND';
        stack[stack.length - 1].push({
          connector: collapsedConnector,
          expression: collapsedExpression
        });
      }
    }

    while (stack.length - 1 < targetLevel) {
      stack.push([]);
    }

    stack[stack.length - 1].push({
      connector: normalizeLogicalConnector(item.connector),
      expression: item.expression
    });
  });

  while (stack.length > 1) {
    const finished = stack.pop();
    if (finished.length > 0) {
      const collapsedExpression = `(${renderLogicalTokens(finished, true)})`;
      const collapsedConnector = finished[0]?.connector || 'AND';
      stack[stack.length - 1].push({
        connector: collapsedConnector,
        expression: collapsedExpression
      });
    }
  }

  return renderLogicalTokens(stack[0], true);
};

const formatCypherValue = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;

  const escapedBackslashes = value.replace(/\\/g, '\\\\');

  if (value.includes("'")) {
    return `"${escapedBackslashes.replace(/"/g, '\\"')}"`;
  }

  return `'${escapedBackslashes.replace(/'/g, "\\'")}'`;
};

const convertToQuery = (state) => {
  var loneNodeQueries = [];
  var simpleReturnVars = []; // For nodes and edge paths (non-aggregated)
  var aggregationEntries = []; // Objects: { expr, alias, operator, value, hasCondition, isLegacy }
  var allPredsArr = [];
  var predQueriesMap = {};
  var predQueriesByNode = {};
  var predicateNestingByNode = {};
  var pathVariables = []; // Track path variables for proper ordering
  
  for (var i = 0; i < state.nodes.length; i++) {
    var curNode = state.nodes[i];
    if (!curNode.data['rep']) {
      curNode.data['rep'] = (parseInt(curNode.id) + 10).toString(36);
    }

    if (curNode.isBold) {
      simpleReturnVars.push(curNode.data.rep);
    }

    // Process node aggregations
    if (curNode.data.aggregations) {
        if (Array.isArray(curNode.data.aggregations)) {
            curNode.data.aggregations.forEach((agg, idx) => {
                const { attribute, function: func } = agg;
                if (attribute && func) {
                    const aggStr = `${func}(${curNode.data.rep}.${attribute})`;
                    
                    let alias = agg.alias;
                    let condition = null;
                    
                    if (agg.hasCondition && agg.operator && agg.value !== undefined && agg.value !== '') {
                        if (!alias) alias = `agg_node${curNode.id}_${idx}`;
                        // Simple check if value is numeric string
                        const isNum = !isNaN(parseFloat(agg.value)) && isFinite(agg.value);
                        const val = isNum ? agg.value : formatCypherValue(agg.value);
                        condition = `${alias} ${agg.operator} ${val}`;
                    }

                    aggregationEntries.push({ 
                        expr: aggStr, 
                        alias: alias, 
                        condition: condition, 
                        hasCondition: agg.hasCondition,
                        nodeId: curNode.id 
                    });
                }
            });
        } else if (typeof curNode.data.aggregations === 'object') {
             // Backward compatibility
            Object.keys(curNode.data.aggregations).forEach(attr => {
                const aggFunc = curNode.data.aggregations[attr];
                if (aggFunc) {
                  const aggStr = `${aggFunc}(${curNode.data.rep}.${attr})`;
                  aggregationEntries.push({ 
                      expr: aggStr, 
                      isLegacy: true,
                      nodeId: curNode.id 
                  });
                }
            });
        }
    }

    if (!curNode.data.connected) {
      loneNodeQueries.push(`(${curNode.data.rep}:${curNode.data.label})`);
    }
    
    // Process node predicates
    if (curNode.data.predicates) {
      var nodePredQueries = {};
      Object.keys(curNode.data.predicates).forEach(function (attr) {
        const preds = curNode.data.predicates[attr].data;
        var predsStringsArr = preds
          .filter(pred => pred[1] !== '' && pred[1] !== undefined && pred[1] !== null)
          .map(function (pred) {
            const op = pred[0];
            const predVal = formatCypherValue(pred[1]);
            return `${curNode.data.rep}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
          });
        if (predsStringsArr.length > 0) {
          const predQuery = predsStringsArr.join(' AND ');
          predQueriesMap[`${curNode.id}_${attr}`] = predQuery;
          nodePredQueries[attr] = predQuery;
        }
      });

      if (Object.keys(nodePredQueries).length > 0) {
        predQueriesByNode[curNode.id] = nodePredQueries;
        predicateNestingByNode[curNode.id] = normalizePredicateNesting(curNode.data.predicateNesting, Object.keys(nodePredQueries));
      }
    }

    // DNF Predicates (Disjunctive Normal Form - OR groups with AND within)
    if (curNode.data.dnf && curNode.data.dnf.length > 0) {
        const dnfGroups = curNode.data.dnf.map(row => {
            const rowPreds = row.predicates
                .filter(p => p.attr && p.val !== undefined && p.val !== null && p.val !== '')
                .map(p => {
              const val = formatCypherValue(p.val);
                    return `${curNode.data.rep}.${p.attr} ${Constants.OPERATORS[p.op] || p.op} ${val}`;
                });
            return rowPreds.length > 0 ? `(${rowPreds.join(' AND ')})` : null;
        }).filter(Boolean);

        if (dnfGroups.length > 0) {
            allPredsArr.push(`(${dnfGroups.join(' OR ')})`);
        }
    }
  }
  // OR Links: Union-find implementation for grouping predicates with OR
  var orParents = {};
  Object.keys(predQueriesMap).forEach(function (key) {
    orParents[key] = key;
  });

  var findOR = function (i) {
    if (!orParents[i]) return undefined;
    if (orParents[i] === i) return i;
    orParents[i] = findOR(orParents[i]);
    return orParents[i];
  };

  var unionOR = function (i, j) {
    var rootI = findOR(i);
    var rootJ = findOR(j);
    if (rootI && rootJ) {
      orParents[rootI] = rootJ;
    }
  };

  // Process OR links from the UI
  if (state.orLinks && state.orLinks.length > 0) {
    state.orLinks.forEach(function (link) {
      unionOR(`${link.from.nodeId}_${link.from.attr}`, `${link.to.nodeId}_${link.to.attr}`);
    });
  }

  var orGroups = {};
  Object.keys(predQueriesMap).forEach(function (key) {
    var root = findOR(key) || key;
    if (!orGroups[root]) orGroups[root] = [];
    orGroups[root].push(key);
  });

  var groupedExpressionByKey = {};
  Object.keys(orGroups).forEach(function (root) {
    var keys = orGroups[root];
    var expressions = keys
      .map(function (key) {
        return predQueriesMap[key];
      })
      .filter(Boolean);

    if (expressions.length === 0) return;

    var groupedExpression = expressions.length === 1
      ? expressions[0]
      : `(${expressions.join(' OR ')})`;

    keys.forEach(function (key) {
      groupedExpressionByKey[key] = groupedExpression;
    });
  });

  // Build nested AND expressions with proper nesting levels
  var emittedGroupRoots = {};
  state.nodes.forEach(function (node) {
    var nodePredQueries = predQueriesByNode[node.id];
    if (!nodePredQueries) return;

    var nesting = predicateNestingByNode[node.id] || normalizePredicateNesting({}, Object.keys(nodePredQueries));
    var orderedItems = [];

    nesting.order.forEach(function (attr) {
      var key = `${node.id}_${attr}`;
      var root = findOR(key) || key;
      if (emittedGroupRoots[root]) return;

      var expression = groupedExpressionByKey[key] || nodePredQueries[attr];
      if (!expression) return;

      emittedGroupRoots[root] = true;
      orderedItems.push({
        expression,
        level: nesting.levels[attr] || 0,
        connector: nesting.modes[attr] || 'AND'
      });
    });

    var nodeExpression = buildNestedAndExpression(orderedItems);
    if (nodeExpression) {
      allPredsArr.push(nodeExpression);
    }
  });

  var allRsQueries = [];
  var joinNodes = state.nodes.filter(n => n.data.isJoin);

  for (var i = 0; i < state.edges.length; i++) {
    var srcNode = state.nodes.find((el) => el.id === state.edges[i].source);
    var destNode = state.nodes.find((el) => el.id === state.edges[i].target);

    // If either node is missing (e.g. deleted), skip this edge
    if (!srcNode || !destNode) continue;

    var qString;
    var currEdge = state.edges[i];
    var rsLabel = 'r' + (i + 10).toString(36);

    // ========== FEATURE: Hops (Variable Length Paths) ==========
    // Supports: -[*x]-> (exact), -[*x..y]-> (range)
    let hops = '';
    let isVarLength = false;
    if (currEdge.data.cardinality) {
        const {min, max} = currEdge.data.cardinality;
        const op = currEdge.data.cardinality.op || '=';

        if (op === '=') {
             // Exact hop count
             if (max !== 1) {
                 hops = `*${max}`;
                 isVarLength = true;
             }
        } else {
            // Range of hops
            if (min !== 1 || max !== 1) {
                hops = `*${min}..${max}`;
                isVarLength = true;
            }
        }
    }

    // ========== FEATURE: Edge Types (Relationship Types) ==========
    // Build relationship type specification
    let edgeTypeSpec = '';
    if (currEdge.data.rs && currEdge.data.rs !== '') {
        // Single edge type or multiple types (can be specified comma-separated)
        edgeTypeSpec = currEdge.data.rs;
    }

    // Construct the edge pattern
    if (currEdge.arrowHeadType !== '') {
      // DIRECTED EDGE: -->
      if (edgeTypeSpec) {
        qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${rsLabel}:${edgeTypeSpec}${hops}]->`+
        `(${destNode.data.rep}:${destNode.data.label})`;
      } else {
        // No edge type specified
        if (isVarLength) {
             qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${hops}]->(${destNode.data.rep}:${destNode.data.label})`;
        } else {
             qString = `(${srcNode.data.rep}:${srcNode.data.label})-->(${destNode.data.rep}:${destNode.data.label})`;
        }
      }
    } else {
      // UNDIRECTED EDGE: --
      if (edgeTypeSpec) {
        qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${rsLabel}:${edgeTypeSpec}${hops}]-`+
        `(${destNode.data.rep}:${destNode.data.label})`;
      } else {
        if (isVarLength) {
            qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${hops}]-(${destNode.data.rep}:${destNode.data.label})`;
        } else {
            qString = `(${srcNode.data.rep}:${srcNode.data.label})--(${destNode.data.rep}:${destNode.data.label})`;
        }
      }
    }
    
    // ========== FEATURE: Edge Predicates (Cardinality Properties) ==========
    // Process predicates on relationship properties
    if (currEdge.data.predicates && Object.keys(currEdge.data.predicates).length > 0){
      var edgePredsArr = Object.keys(currEdge.data.predicates).map(function (attr) {
        const preds = currEdge.data.predicates[attr].data;
        var predsStringsArr = preds
          .filter(pred => pred[1] !== '' && pred[1] !== undefined && pred[1] !== null)
          .map(function (pred) {
            const op = pred[0];
            const predVal = formatCypherValue(pred[1]);
            if (isVarLength) {
                // For variable length paths, use ALL to check all relationships
                return `ALL(rel in ${rsLabel} WHERE rel.${attr} ${Constants.OPERATORS[op]} ${predVal})`;
            }
            return `${rsLabel}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
          });
        var predsQueryString = predsStringsArr.join(' AND ');
        return predsQueryString;
      });
      allPredsArr = allPredsArr.concat(edgePredsArr.filter(Boolean));
    }
    
    // Process cardinality properties (properties with constraints on the cardinality)
    if (Array.isArray(currEdge.data.cardinalityProps) && currEdge.data.cardinalityProps.length > 0) {
      currEdge.data.cardinalityProps.forEach(prop => {
        if (prop.key && prop.value !== undefined && prop.value !== null && prop.value !== '') {
          const val = formatCypherValue(prop.value);
          const op = prop.operator || '=';
          let pred;
          if (isVarLength) {
              pred = `ALL(rel in ${rsLabel} WHERE rel.${prop.key} ${op} ${val})`;
          } else {
              pred = `${rsLabel}.${prop.key} ${op} ${val}`;
          }
          allPredsArr.push(pred);
        }
      });
    }
    
    // ========== FEATURE: Path Variables ==========
    // Track paths that should be returned (e.g., p = (a:Node1)-->(b:Node2))
    if (currEdge.data.isPath) {
        const pathVar = `p${i}`;
        qString = `${pathVar} = ${qString}`;
        simpleReturnVars.push(pathVar);
        pathVariables.push(pathVar);
    }

    allRsQueries.push(qString);
  }

  // ========== FEATURE: Joins (Equi and Theta) ==========
  // Process join predicates that link attributes from different nodes
  if (state.predicateLinks && state.predicateLinks.length > 0) {
    state.predicateLinks.forEach(link => {
      const fromNode = state.nodes.find(n => n.id === link.from.nodeId);
      const toNode = state.nodes.find(n => n.id === link.to.nodeId);
      
      if (fromNode && toNode && fromNode.data.rep && toNode.data.rep) {
        let op = '=';
        let joinType = link.joinType || 'Equi Join';
        
        // Theta Join: use custom operator
        if (joinType === 'Theta Join' && link.operator) {
          op = link.operator;
        }
        // Equi Join: always use '='
        
        const joinPredicate = `${fromNode.data.rep}.${link.from.attr} ${op} ${toNode.data.rep}.${link.to.attr}`;
        allPredsArr.push(joinPredicate);
      }
    });
  }

  allPredsArr = allPredsArr.filter(Boolean); // Remove falsy (empty) strings
  allPredsArr = Array.from(new Set(allPredsArr)); // Remove duplicates

  var allPredsQueryString = allPredsArr.length > 0 ? 'WHERE ' + allPredsArr.join(' AND ') : '';

  // Build MATCH clause with both lone nodes and edges
  var loneQueryString = '';
  if (loneNodeQueries.length > 0 && allRsQueries.length > 0) {
    loneQueryString = loneNodeQueries.join(', ') + ', ';
  } else {
    if (loneNodeQueries.length > 0) {
      loneQueryString = loneNodeQueries.join(', ');
    }
  }

  var allRsQueriesString = allRsQueries.join(', ');

  // ========== HANDLE JOIN NODES ==========
  // Join nodes represent multi-way joins that collect connected nodes
  if (joinNodes.length > 0) {
    var jSymbol = joinNodes[0].data.rep;
    
    // If we have aggregations, integrate them with join
    if (aggregationEntries.length > 0) {
      const withClauseVars = [jSymbol, ...aggregationEntries.map((a, idx) => {
        const alias = a.alias || `agg_${idx}`;
        a.finalAlias = alias;
        return `${a.expr} AS ${alias}`;
      })];
      
      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `WITH ${withClauseVars.join(', ')}`,
        `OPTIONAL MATCH (${jSymbol})--(o)`,
        `RETURN ${jSymbol}, COLLECT(o) AS others, ${aggregationEntries.map(a => a.finalAlias).join(', ')}`
      ].filter(val => val && val.trim() !== '').join('\n');
    }
    
    // Standard join without aggregations
    return `MATCH ${loneQueryString}${allRsQueriesString}
${allPredsQueryString}
OPTIONAL MATCH (${jSymbol})--(o)
RETURN ${jSymbol}, COLLECT(o) AS others`;
  }
  
  // ========== FEATURE: Aggregations with Conditions ==========
  // When aggregations have conditions, use WITH clause to filter aggregation results (HAVING-like)
  const hasAggConditions = aggregationEntries.some(a => a.hasCondition);
  
  if (hasAggConditions) {
      const withClauseAggs = aggregationEntries.map((a, idx) => {
          const alias = a.alias || `agg_${idx}`; 
          a.finalAlias = alias; 
          return `${a.expr} AS ${alias}`;
      });
      
      const withClauseVars = [
          ...simpleReturnVars,
          ...withClauseAggs
      ];
      
      const whereClauses = aggregationEntries
          .filter(a => a.hasCondition && a.condition)
          .map(a => a.condition);

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      
      // Order return variables: simple vars first, then aggregations, then path variables
      const finalReturnVars = [
          ...simpleReturnVars,
          ...aggregationEntries.map(a => a.finalAlias ? a.finalAlias : (a.alias ? a.alias : a.expr))
      ];

      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `WITH ${withClauseVars.join(', ')}`,
        whereStr,
        `RETURN ${finalReturnVars.join(', ')}`
      ].filter(val => val && val.trim() !== '').join('\n');

  } else if (aggregationEntries.length > 0) {
      // ========== FEATURE: Simple Aggregations (No Conditions) ==========
      // Standard return with aggregations
      const finalReturnVars = [
          ...simpleReturnVars, 
          ...aggregationEntries.map(a => {
              if (a.alias) return `${a.expr} AS ${a.alias}`;
              if (a.isLegacy) return a.expr;
              return `${a.expr} AS agg_${state.nodes.find(n => n.id === a.nodeId)?.id}`;
          })
      ];
      
      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `RETURN ${finalReturnVars.join(', ')}`
      ].filter(val => val && val.trim() !== '').join('\n');
  } else {
      // ========== STANDARD QUERY (No Aggregations, No Joins) ==========
      // Simple MATCH WHERE RETURN query
      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `RETURN ${simpleReturnVars.join(', ')}`
      ].filter(val => val && val.trim() !== '').join('\n');
  }


}
// get query string based on query graph and execute it
async function runQuery(query) {
  const result = await getResult(query);
  return { result: result, query: query };
}

// fetch all key value pairs of properties of a node
async function fetchPropertyValues(node) {
  const session = driver.session({ database: database });
  const res = await session
    .readTransaction((tx) =>
      tx.run(`MATCH (a:${node}) \
    RETURN properties(a)`),
    )
    .then((result) => {
      return result.records.map(function (result) {
        return result.get('properties(a)');
      });
    })
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      session.close();
    });
  return res;
}

// fetch all key value pairs of properties of an edge
async function fetchEdgePropertyValues (edge){
  const session = driver.session({ database: database });
  const res = await session
    .readTransaction((tx) =>
      tx.run(`MATCH (a)-[r:${edge}]-(b) \
    RETURN properties(r)`),
    )
    .then((result) => {
      return result.records.map(function (result) {
        return result.get('properties(r)');
      });
    })
    .catch((error) => {
      throw error;
    })
    .finally(() => {
      session.close();
    });
  return res;
}

exports.getProperties = getProperties;
exports.setUp = setUp;
exports.runQuery = runQuery;
exports.fetchPropertyValues = fetchPropertyValues;
exports.fetchEdgePropertyValues = fetchEdgePropertyValues;
exports.convertToQuery = convertToQuery;
exports.setDatabase = setDatabase;
exports.getDatabase = getDatabase;