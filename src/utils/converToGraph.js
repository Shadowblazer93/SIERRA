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
const processWhereSubquery = (s, midState, repToElementMap, state) => {

  const op = ['=', '>', '>=', '<', '<=', '<>']
  const clauses = s.split("AND").map(s => s.trim())
  // console.log(clauses)

  for (const clause of clauses) {
      let operand;
      for (const o of op) {
          if (clause.includes(o)){
              operand = o
              // break;
          }
      }
      if(!operand){
          console.log('107')
          throw 'Unsupport Query by SIERRA'
      }

      let [arr1, value] = clause.split(operand)
      value = value.trim().replace(/^['"]|['"]$/g, '')
      const [rep, property] = arr1.split(".").map((s) => s.trim())

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
        // console.log('checking nodes', rep, property, label)
        // console.log(state.props[label])

        if(state.props[label].indexOf(property) === -1){
          console.log('118')
          throw `no such property in node ${label}`
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
}

export const convertToGraph = (query, state) => {
  const repToElementMap = {}
  const midState = {
      nodes:{},
      edges:{}
  }
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
        processWhereSubquery(arr2[0].trim(), midState, repToElementMap, state)
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
  return midState
}
