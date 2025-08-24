const _ = require('lodash');
const neo4j = require('neo4j-driver');
const Constants = require('./constants');

const neo4jUri = process.env.NEO4J_URI;
const neo4jVersion = process.env.NEO4J_VERSION;
let database = process.env.NEO4J_DATABASE;
if (!neo4jVersion.startsWith('4')) {
  database = null;
}

const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));

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
  entities.map(async (entity) => {
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
  });

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
        return { [result.records[0].get('labels(n)')]: merged };
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
  var returnVars = [];
  var allPredsArr = [];
  for (var i = 0; i < state.nodes.length; i++) {
    var curNode = state.nodes[i];
    if(curNode.data['rep'] && curNode.isBold) {
      returnVars.push(curNode.data.rep);
    } else if (curNode.isBold) {
      curNode.data['rep'] = (parseInt(curNode.id) + 10).toString(36);
      returnVars.push(curNode.data.rep);
    }
    if (!curNode.data.connected) {
      loneNodeQueries.push(`(${curNode.data.rep}:${curNode.data.label})`);
    }
    let nodePredsArr = ''
    if (curNode.data.predicates) {
      nodePredsArr = Object.keys(curNode.data.predicates).map(function (attr) {
        const preds = curNode.data.predicates[attr].data;
        var predsStringsArr = preds.map(function (pred) {
          const op = pred[0];
          const predVal = typeof pred[1] === 'string' ? `'${pred[1]}'` : pred[1];
          return `${curNode.data.rep}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
        });
        var predsQueryString = predsStringsArr.join(' AND ');

        return predsQueryString;
      });
    }
    allPredsArr = allPredsArr.concat(nodePredsArr);
  }
  var allRsQueries = [];
  for (var i = 0; i < state.edges.length; i++) {
    var srcNode = state.nodes.find((el) => el.id === state.edges[i].source);
    var destNode = state.nodes.find((el) => el.id === state.edges[i].target);
    var qString;
    // if directed
    if (state.edges[i].arrowHeadType !== '') {
      var rsLabel = 'r' + (i + 10).toString(36);
      // if rs type is specified
      if (state.edges[i].data.rs !== '') {
        qString = `(${srcNode.data.rep}:${srcNode.data.label})-[${rsLabel}:${state.edges[i].data.rs}]->`+
        `(${destNode.data.rep}:${destNode.data.label})`;
        var currEdge = state.edges[i];
        // process edge predicates
        if (Object.keys(currEdge.data.predicates).length > 0){
          var edgePredsArr = Object.keys(currEdge.data.predicates).map(function (attr) {
            const preds = currEdge.data.predicates[attr].data;
            var predsStringsArr = preds.map(function (pred) {
              const op = pred[0];
              const predVal = typeof pred[1] === 'string' ? `'${pred[1]}'` : pred[1];
              return `${rsLabel}.${attr} ${Constants.OPERATORS[op]} ${predVal}`;
            });
            var predsQueryString = predsStringsArr.join(' AND ');
            return predsQueryString;
          });
          allPredsArr = allPredsArr.concat(edgePredsArr);
        }
      } else {
        qString = `(${srcNode.data.rep}:${srcNode.data.label})-->(${destNode.data.rep}:${destNode.data.label})`;
      }
    }
    // if undirected
    else {
      qString = `(${srcNode.data.rep}:${srcNode.data.label})--(${destNode.data.rep}:${destNode.data.label})`;
    }
    allRsQueries.push(qString);
  }

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

  return allPredsQueryString ?
    `MATCH ${loneQueryString}${allRsQueriesString}
${allPredsQueryString}
RETURN ${returnVars.join(', ')}` :

    `MATCH ${loneQueryString}${allRsQueriesString}
RETURN ${returnVars.join(', ')}`


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
