import { getNodeId } from "./getNodeId";

const processMatchSubquery = (s, midState, repToElementMap, state) => {
  //* split into nodes and edges, identify rep
  const queries = s.split(',').map(s => s.trim())
  queries.sort((a, b) => {
    if (b.includes("--") && !a.includes("--")) {
      return -1;
    } else {
      return 1
    }
  })
  .forEach(q => {
      const reps = []
      //* identify (rep:Property) nodes
      let pt = 0
      let cur = 0
      for(let i = 0; i < q.length; i++){
          if (q[i] === '('){
              cur = i
          } else if (q[i] === ')') {
              let node = q.slice(cur+1, i)
              node = node.split(":")
              if(node.length !== 2){
                  // console.log('16')
                  throw 'Query unsupported by SIERRA';
              }
              reps.push(node)
          }
      }

      for(const r of reps) {
        if(!r[1] in state.entities) {
          console.log('26')
          throw 'no such entity'
        }

        const key = r[0]
        if (!midState.nodes[key]) {
            midState.nodes[key] = {
                nodeId: getNodeId(r[0]),
                label: r[1],
                connected: false
            }
            repToElementMap[key] = midState.nodes[key]
        }
        if(reps.length > 1){
            midState.nodes[key].connected = true
        }
      }

      // (b)-->(a)-[/*]->(c)--(d)
      //* use regexp.matchAll [-- or -[.*]-> or --> ]
      const rsMatches = q.matchAll(/(--(?!>))|(-->)|(-\[.*\]->)/g)
      let i = 0
      for (const match of rsMatches){

          //* check for match type (ie. --, --> or -[rx:PROPERTY]->)
          // (source -> target)
          const source = midState.nodes[reps[i][0]].nodeId
          const target = midState.nodes[reps[i+1][0]].nodeId
          const dSource = reps[i][1]
          const dTarget = reps[i+1][1]

          const key = `${source}->${target}`
          if (match[0].match(/(--(?!>))/g)) {
              //* add a undirected node
              midState.edges[key] = {
                  source,
                  target,
                  dSource,
                  dTarget,
                  arrowHeadType: "",
                  rs: ""
              }
          } else if (match[0].match(/(-->)/g)) {
              midState.edges[key] = {
                  source,
                  target,
                  dSource,
                  dTarget,
                  arrowHeadType: "arrowclosed",
                  rs: ""
              }
              //* add a directed node with no rs name
          } else {
              let copy = match[0].slice(2, match[0].length - 3)
              const [edgeRep, rs] = copy.split(":")
              //! need to check if rs is in the neighbor
              midState.edges[key] = {
                  source,
                  target,
                  dSource,
                  dTarget,
                  arrowHeadType: "arrowclosed",
                  rs,
                  rep: edgeRep
              }
              repToElementMap[edgeRep] = midState.edges[key]
              //* add a direct node with rs, keep a map of rs to this edge's Id
          }
          i++;
      }

  });
}
const processWhereSubquery = (s, midState, repToElementMap, state, predicateLinks, orLinks) => {

  const op = ['=', '>', '>=', '<', '<=', '<>']

  //* Strip outer parentheses from the whole WHERE string
  let whereStr = s.trim();
  while (whereStr.startsWith('(') && whereStr.endsWith(')')) {
    whereStr = whereStr.slice(1, -1).trim();
  }

  const clauses = whereStr.split("AND").map(s => s.trim())

  for (const clause of clauses) {
      //* Strip outer parentheses from this clause
      let cleanClause = clause;
      while (cleanClause.startsWith('(') && cleanClause.endsWith(')')) {
        cleanClause = cleanClause.slice(1, -1).trim();
      }

      //* Check if this clause contains OR conditions
      const orParts = cleanClause.split(/\s+OR\s+/i).map(s => s.trim());
      const isOrGroup = orParts.length > 1;

      //* Track predicates in this OR group so we can create OR links
      const orGroupPreds = [];

      for (const part of orParts) {
        //* Strip outer parentheses from this OR part and track whether it had them
        let cleanPart = part;
        let hadParens = false;
        while (cleanPart.startsWith('(') && cleanPart.endsWith(')')) {
          cleanPart = cleanPart.slice(1, -1).trim();
          hadParens = true;
        }

        let operand;
        for (const o of op) {
            if (cleanPart.includes(o)){
                operand = o
                // break;
            }
        }
        if(!operand){
            console.log('107')
            throw 'Unsupport Query by SIERRA'
        }

        let [arr1, value] = cleanPart.split(operand)
        const rawTrimmed = value.trim()
        value = rawTrimmed.replace(/^['"]|['"]$/g, '')
        const [rep, property] = arr1.split(".").map((s) => s.trim())

        //* Check for cross-node join: a.x = b.y (where b is a known node rep)
        const joinMatch = rawTrimmed.match(/^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/);
        if (joinMatch && joinMatch[1] in midState.nodes && rep in midState.nodes && joinMatch[1] !== rep) {
          const valueRep = joinMatch[1];
          const valueProperty = joinMatch[2];

          // Validate both properties exist on their respective nodes
          const fromLabel = midState.nodes[rep].label;
          if (state.props[fromLabel].indexOf(property) === -1) {
            throw `no such property in node ${fromLabel}`;
          }
          const toLabel = midState.nodes[valueRep].label;
          if (state.props[toLabel].indexOf(valueProperty) === -1) {
            throw `no such property in node ${toLabel}`;
          }

          // Create empty predicates on both sides so predicate circles appear in the graph
          const fromNode = midState.nodes[rep];
          const toNode = midState.nodes[valueRep];
          const opIndex = op.indexOf(operand);

          if (!fromNode.predicates) fromNode.predicates = {};
          if (!fromNode.predicates[property]) fromNode.predicates[property] = [];
          fromNode.predicates[property].push([opIndex, '']);

          if (!toNode.predicates) toNode.predicates = {};
          if (!toNode.predicates[valueProperty]) toNode.predicates[valueProperty] = [];
          toNode.predicates[valueProperty].push([opIndex, '']);

          // Add predicate link for the join
          predicateLinks.push({
            from: { nodeId: fromNode.nodeId, attr: property },
            to: { nodeId: toNode.nodeId, attr: valueProperty },
            joinType: operand === '=' ? 'Equi Join' : 'Theta Join',
            operator: operand
          });

          if (isOrGroup) {
            orGroupPreds.push({ nodeId: fromNode.nodeId, attr: property, level: hadParens ? 1 : 0 });
          }

          continue; // Skip regular predicate creation
        }

        //* check if property is in node
        let obj = repToElementMap[rep]
        //! need to distinguish between node or edgeå
        const edgesRepSet = new Set()
        for (let k in midState.edges) {
          console.log('k', k)
          if (midState.edges[k].rep){
            edgesRepSet.add(midState.edges[k].rep)
          }

        }
        if (rep in midState.nodes){
          const label = midState.nodes[rep].label

          if(state.props[label].indexOf(property) === -1){
            console.log('118')
            throw `no such property in node ${label}`
          }
          //* Track this predicate for OR link creation
          if (isOrGroup) {
            orGroupPreds.push({ nodeId: midState.nodes[rep].nodeId, attr: property, level: hadParens ? 1 : 0 });
          }
        } else if (edgesRepSet.has(rep)){
          const propsList = state.neighbours[obj.dSource].filter(v => {
            return (v.label === obj.dTarget)
          })
          if(propsList.length !== 1 || propsList[0].props.indexOf(property) === -1){
            throw `incorrect rs between ${obj.dSource} and ${obj.dTarget}`
          }

        } else {
          throw `rep ${rep} doesn't match any nodes or edges`
        }


        if(!obj.predicates) {
            obj.predicates = {
                [property]:[[op.indexOf(operand), value]]
            }
        } else if (!obj.predicates[property]) {
            obj.predicates[property] = [[op.indexOf(operand), value]]
        } else {
            obj.predicates[property].push([op.indexOf(operand), value])
        }
      }

      //* Create OR links between consecutive predicates in this OR group
      if (isOrGroup && orGroupPreds.length > 1) {
        for (let i = 0; i < orGroupPreds.length - 1; i++) {
          const from = orGroupPreds[i];
          const to = orGroupPreds[i + 1];
          if (from.nodeId && to.nodeId) {
            orLinks.push({
              from: { nodeId: from.nodeId, attr: from.attr },
              to: { nodeId: to.nodeId, attr: to.attr }
            });
          }
        }

        //* Set predicateNesting on nodes involved in this OR group
        //* to preserve the original parenthesization when re-translating to Cypher
        var nodePredsMap = {};
        orGroupPreds.forEach(function (p) {
          if (!nodePredsMap[p.nodeId]) nodePredsMap[p.nodeId] = [];
          nodePredsMap[p.nodeId].push(p);
        });
        Object.keys(nodePredsMap).forEach(function (nId) {
          var preds = nodePredsMap[nId];
          if (preds.length < 2) return;
          // Check if there are mixed levels within this node's predicates
          var levels = {};
          var modes = {};
          var order = [];
          preds.forEach(function (p, idx) {
            order.push(p.attr);
            levels[p.attr] = p.level || 0;
            if (idx > 0) modes[p.attr] = 'OR';
          });
          // Find the node in midState and set its predicateNesting
          for (var repKey in midState.nodes) {
            if (midState.nodes[repKey].nodeId === nId) {
              midState.nodes[repKey].predicateNesting = { order: order, levels: levels, modes: modes };
              break;
            }
          }
        });
      }
  }
}

export const convertToGraph = (query, state) => {
  const repToElementMap = {}
  const midState = {
      nodes:{},
      edges:{}
  }
  const predicateLinks = [];
  const orLinks = [];
  //* remove surrounding whitespaces
  let queryCopy = query.trim()

  //* check if starts with MATCH, else throw error
  if (!queryCopy.startsWith('MATCH')) {
    console.log('146')
    throw 'Query unsupported by SIERRA';
  }

  //* split MATCH, WHERE, RETURN Clause
  if (queryCopy.includes("WHERE")){
      const arr = queryCopy.split("WHERE")
      if(arr.length !== 2){
        console.log('154')
          throw 'Query unsupported by SIERRA';
      }
      const arr2 = arr[1].split("RETURN")
      if(arr.length !== 2){
        console.log('159')
          throw 'Query unsupported by SIERRA';
      }
      try {
        processMatchSubquery(arr[0].replace("MATCH", "").trim(), midState, repToElementMap, state)
        processWhereSubquery(arr2[0].trim(), midState, repToElementMap, state, predicateLinks, orLinks)
        // processMidState(midState, state)
      } catch (e) {
        throw e
        }

  } else {
      try {
        const arr = queryCopy.split("RETURN")
        if(arr.length !== 2){
          console.log('187')
            throw 'Query unsupported by SIERRA';
        }
        processMatchSubquery(arr[0].replace("MATCH", "").trim(), midState, repToElementMap, state)
      } catch (e) {
        throw e
      }
  }
  return { ...midState, predicateLinks, orLinks }
}
