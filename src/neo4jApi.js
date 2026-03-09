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

const convertToQuery = (state) => {
  var loneNodeQueries = [];
  var simpleReturnVars = []; // For nodes and edge paths (non-aggregated)
  var aggregationEntries = []; // Objects: { expr, alias, operator, value, hasCondition, isLegacy }
  var allPredsArr = [];
  var predQueriesMap = {};
  
  for (var i = 0; i < state.nodes.length; i++) {
    var curNode = state.nodes[i];
    if (!curNode.data['rep']) {
      curNode.data['rep'] = (parseInt(curNode.id) + 10).toString(36);
    }

    if (curNode.isBold) {
      simpleReturnVars.push(curNode.data.rep);
    }

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
                        const val = isNum ? agg.value : `'${agg.value}'`;
                        condition = `${alias} ${agg.operator} ${val}`;
                    }

                    aggregationEntries.push({ expr: aggStr, alias: alias, condition: condition, hasCondition: agg.hasCondition });
                }
            });
        } else if (typeof curNode.data.aggregations === 'object') {
             // Backward compatibility
            Object.keys(curNode.data.aggregations).forEach(attr => {
                const aggFunc = curNode.data.aggregations[attr];
                if (aggFunc) {
                  const aggStr = `${aggFunc}(${curNode.data.rep}.${attr})`;
                  aggregationEntries.push({ expr: aggStr, isLegacy: true });
                }
            });
        }
    }

    if (!curNode.data.connected) {
      loneNodeQueries.push(`(${curNode.data.rep}:${curNode.data.label})`);
    }
    if (curNode.data.predicates) {
      Object.keys(curNode.data.predicates).forEach(function (attr) {
        const preds = curNode.data.predicates[attr].data;
        var predsStringsArr = preds
          .filter(pred => pred[1] !== '' && pred[1] !== undefined && pred[1] !== null)
          .map(function (pred) {
            const op = pred[0];
            const predVal = typeof pred[1] === 'string' ? `'${pred[1]}'` : pred[1];
            return `${curNode.data.rep}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
          });
        if (predsStringsArr.length > 0) {
          predQueriesMap[`${curNode.id}_${attr}`] = predsStringsArr.join(' AND ');
        }
      });
    }

    // DNF Predicates
    if (curNode.data.dnf && curNode.data.dnf.length > 0) {
        const dnfGroups = curNode.data.dnf.map(row => {
            const rowPreds = row.predicates
                .filter(p => p.attr && p.val !== undefined && p.val !== null && p.val !== '')
                .map(p => {
                    const val = typeof p.val === 'string' ? `'${p.val}'` : p.val;
                    return `${curNode.data.rep}.${p.attr} ${Constants.OPERATORS[p.op] || p.op} ${val}`;
                });
            return rowPreds.length > 0 ? `(${rowPreds.join(' AND ')})` : null;
        }).filter(Boolean);

        if (dnfGroups.length > 0) {
            allPredsArr.push(`(${dnfGroups.join(' OR ')})`);
        }
    }
  }
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

  if (state.orLinks && state.orLinks.length > 0) {
    state.orLinks.forEach(function (link) {
      unionOR(`${link.from.nodeId}_${link.from.attr}`, `${link.to.nodeId}_${link.to.attr}`);
    });
  }

  var orGroups = {};
  Object.keys(predQueriesMap).forEach(function (key) {
    var root = findOR(key) || key;
    if (!orGroups[root]) orGroups[root] = [];
    orGroups[root].push(predQueriesMap[key]);
  });

  Object.keys(orGroups).forEach(function (root) {
    var group = orGroups[root];
    if (group.length === 1) {
      allPredsArr.push(group[0]);
    } else if (group.length > 1) {
      allPredsArr.push(`(${group.join(' OR ')})`);
    }
  });
  var allRsQueries = [];
  var joinNodes = state.nodes.filter(n => n.data.isJoin);
  console.log("HHH",state.predicateLinks)
  

  for (var i = 0; i < state.edges.length; i++) {
    var srcNode = state.nodes.find((el) => el.id === state.edges[i].source);
    var destNode = state.nodes.find((el) => el.id === state.edges[i].target);

    // If either node is missing (e.g. deleted), skip this edge
    if (!srcNode || !destNode) continue;

    var qString;
    var currEdge = state.edges[i];

    // Check for hops (cardinality)
    let hops = '';
    let isVarLength = false;
    if (currEdge.data.cardinality) {
        const {min, max} = currEdge.data.cardinality;
        const op = currEdge.data.cardinality.op || '=';

        if (op === '=') {
             if (max !== 1) {
                 hops = `*${max}`;
                 isVarLength = true;
             }
        } else {
            // range
            if (min !== 1 || max !== 1) {
                hops = `*${min}..${max}`;
                isVarLength = true;
            }
        }
    }

    // if directed
    if (currEdge.arrowHeadType !== '') {
      var rsLabel = 'r' + (i + 10).toString(36);
      // if rs type is specified
      if (currEdge.data.rs !== '') {
        qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${rsLabel}:${currEdge.data.rs}${hops}]->`+
        `(${destNode.data.rep}:${destNode.data.label})`;
        
        // process edge predicates
        if (Object.keys(currEdge.data.predicates).length > 0){
          var edgePredsArr = Object.keys(currEdge.data.predicates).map(function (attr) {
            const preds = currEdge.data.predicates[attr].data;
            var predsStringsArr = preds
              .filter(pred => pred[1] !== '' && pred[1] !== undefined && pred[1] !== null)
              .map(function (pred) {
                const op = pred[0];
                const predVal = typeof pred[1] === 'string' ? `'${pred[1]}'` : pred[1];
                if (isVarLength) {
                    return `ALL(rel in ${rsLabel} WHERE rel.${attr} ${Constants.OPERATORS[op]} ${predVal})`;
                }
                return `${rsLabel}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
              });
            var predsQueryString = predsStringsArr.join(' AND ');
            return predsQueryString;
          });
          allPredsArr = allPredsArr.concat(edgePredsArr);
        }
        if (Array.isArray(currEdge.data.cardinalityProps) && currEdge.data.cardinalityProps.length > 0) {
          currEdge.data.cardinalityProps.forEach(prop => {
            if (prop.key && prop.value !== undefined && prop.value !== null && prop.value !== '') {
              const val = typeof prop.value === 'string' ? `'${prop.value}'` : prop.value;
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
      } else {
        if (isVarLength) {
             qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${hops}]->(${destNode.data.rep}:${destNode.data.label})`;
        } else {
             qString = `(${srcNode.data.rep}:${srcNode.data.label})-->(${destNode.data.rep}:${destNode.data.label})`;
        }
      }
    }
    // if undirected
    else {
      if (isVarLength) {
          qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${hops}]-(${destNode.data.rep}:${destNode.data.label})`;
      } else {
          qString = `(${srcNode.data.rep}:${srcNode.data.label})--(${destNode.data.rep}:${destNode.data.label})`;
      }
    }
    
    // Handle Return Path
    if (currEdge.data.isPath) {
        const pathVar = `p${i}`;
        qString = `${pathVar} = ${qString}`;
        simpleReturnVars.push(pathVar);
    }

    allRsQueries.push(qString);
  }

  if (state.predicateLinks && state.predicateLinks.length > 0) {
    state.predicateLinks.forEach(link => {
      // Find the node reps for both ends
      const fromNode = state.nodes.find(n => n.id === link.from.nodeId);
      const toNode = state.nodes.find(n => n.id === link.to.nodeId);
      if (fromNode && toNode && fromNode.data.rep && toNode.data.rep) {
        let op = '=';
        if (link.joinType === 'Theta Join') {
          op = link.operator || '=';
        }
        allPredsArr.push(`${fromNode.data.rep}.${link.from.attr} ${op} ${toNode.data.rep}.${link.to.attr}`);
      }
    });
  }

  allPredsArr = allPredsArr.filter(Boolean); // Remove falsy (empty) strings
  allPredsArr = Array.from(new Set(allPredsArr)); // Remove duplicates

  var allPredsQueryString = allPredsArr.length > 0 ? 'WHERE ' + allPredsArr.join(' AND ') : '';

  var loneQueryString = '';
  if (loneNodeQueries.length > 0 && allRsQueries.length > 0) {
    loneQueryString = loneNodeQueries.join(', ') + ', ';
  } else {
    if (loneNodeQueries.length > 0) {
      loneQueryString = loneNodeQueries.join(', ');
    }
  }

  var allRsQueriesString = allRsQueries.join(', ');

  if (joinNodes.length > 0) {
    var jSymbol = joinNodes[0].data.rep;
    // Join logic with aggregations is complex, assuming basic aggregation return for now or disabling with Join
    return `MATCH ${loneQueryString}${allRsQueriesString}
${allPredsQueryString}
OPTIONAL MATCH (${jSymbol})--(o)
RETURN ${jSymbol}, COLLECT(o) AS others`;
  }
  
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
      
      const finalReturnVars = [
          ...simpleReturnVars,
          ...aggregationEntries.map(a => a.finalAlias)
      ];

      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `WITH ${withClauseVars.join(', ')}`,
        whereStr,
        `RETURN ${finalReturnVars.join(', ')}`
      ].filter(val => val && val.trim() !== '').join('\n');

  } else {
      // Standard return
      const finalReturnVars = [
          ...simpleReturnVars, 
          ...aggregationEntries.map(a => a.alias ? `${a.expr} AS ${a.alias}` : a.expr)
      ];
      
      return [
        `MATCH ${loneQueryString}${allRsQueriesString}`,
        allPredsQueryString,
        `RETURN ${finalReturnVars.join(', ')}`
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