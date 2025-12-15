const Reducer = (state, action) => {

  const nodeExists = (nodes, nodeId) => nodes.some(n => String(n.id) === String(nodeId));
  const predicateExistsOnNode = (nodes, nodeId, attr) => {
    const n = nodes.find(n => String(n.id) === String(nodeId));
    return !!(n && n.data && n.data.predicates && n.data.predicates[attr]);
  };

  const cleanupPredicateLinks = (nodes, predicateLinks) => {
    return (predicateLinks || []).filter(link => {
      return nodeExists(nodes, link.from.nodeId)
        && nodeExists(nodes, link.to.nodeId)
        && predicateExistsOnNode(nodes, link.from.nodeId, link.from.attr)
        && predicateExistsOnNode(nodes, link.to.nodeId, link.to.attr);
    });
  };

  const cleanupJoins = (nodes, predicateLinks) => {
    return nodes.map(n => {
      if (!n || !n.data) return n;
      if (!n.data.isJoin) return n;
      const hasValidLink = (predicateLinks || []).some(link =>
        String(link.from.nodeId) === String(n.id) || String(link.to.nodeId) === String(n.id)
      );
      if (!hasValidLink) {
        return {
          ...n,
          data: {
            ...n.data,
            isJoin: false
          }
        };
      }
      return n;
    });
  };

  switch (action.type) {
    case 'SET_PRED_DISPLAY':
      return {
        ...state,
        predDisplayStatus: action.payload
      };
    case 'SET_DATA':
      console.log('SETTING DATA');
      return {
        ...state,
        entities: action.payload.entities,
        neighbours: action.payload.neighbours,
        props: action.payload.props,
        nodes: [],
        edges: [],
        predicateLinks: []
      };
    case 'SET_GRAPH':
      console.log('SETTING GRAPH');
      {
        const incomingNodes = action.payload.nodes || [];
        const incomingEdges = action.payload.edges || [];
        const cleanedLinks = cleanupPredicateLinks(incomingNodes, state.predicateLinks);
        const cleanedNodes = cleanupJoins(incomingNodes, cleanedLinks);
        return {
          ...state,
          nodes: incomingNodes,
          edges: incomingEdges,
          predicateLinks: cleanedLinks,
          nodes: cleanedNodes
        }
      }
    case 'SET_NODES':
      console.log('SETTING nodes');
      {
        const incomingNodes = action.payload || [];
        const cleanedLinks = cleanupPredicateLinks(incomingNodes, state.predicateLinks);
        const cleanedNodes = cleanupJoins(incomingNodes, cleanedLinks);
        return {
          ...state,
          nodes: cleanedNodes,
          predicateLinks: cleanedLinks
        };
      }
    case 'SET_EDGES':
      console.log('SETTING nodes');
      return {
        ...state,
        edges: action.payload,
      };
    case 'SET_OPEN_MODAL':
      return {
        ...state,
        modalVisible: action.payload
      }
    case 'MODIFY_NODE_DATA':
      return {
        ...state,
        nodes: state.nodes.map(n =>
          n.id === action.payload.node
            ? { ...n, data: { ...n.data, [action.payload.prop]: action.payload.newVal } }
            : n
        ),
      }
    case 'SET_LINKING_PREDICATE':
      return {
        ...state,
        linkingPredicate: action.payload
      };
    case 'ADD_PREDICATE_LINK': {
      const newLink = action.payload;
      const exists = state.predicateLinks.some(link =>
        link.from.nodeId === newLink.from.nodeId &&
        link.from.attr === newLink.from.attr &&
        link.to.nodeId === newLink.to.nodeId &&
        link.to.attr === newLink.to.attr
      );
      if (exists) return { ...state, linkingPredicate: null }; // already exists, just reset linking state

      // prevent linking a predicate to itself
      const isSelf = newLink.from.nodeId === newLink.to.nodeId && newLink.from.attr === newLink.to.attr;
      if (isSelf) return { ...state, linkingPredicate: null };

      const newPredicateLinks = [...state.predicateLinks, newLink];
      const newNodesAfterJoinCleanup = cleanupJoins(state.nodes, newPredicateLinks);
      return {
        ...state,
        predicateLinks: newPredicateLinks,
        linkingPredicate: null,
        nodes: newNodesAfterJoinCleanup
      };
    }
    case 'UPDATE_PREDICATE': {
      const { nodeId, attr, newPred } = action.payload;
      let predicateLinks = state.predicateLinks;
      if (!newPred || !newPred.data || newPred.data.length === 0) {
        predicateLinks = predicateLinks.filter(
          link =>
            !(
              (link.from.nodeId === nodeId && link.from.attr === attr) ||
              (link.to.nodeId === nodeId && link.to.attr === attr)
            )
        );
      }
      const cleanedLinks = cleanupPredicateLinks(state.nodes, predicateLinks);
      const cleanedNodes = cleanupJoins(state.nodes, cleanedLinks);
      return {
        ...state,
        predicateLinks: cleanedLinks,
        nodes: cleanedNodes,
      };
    }

    case 'DELETE_PREDICATE': {
      const { nodeId, attr } = action.payload;
      let predicateLinks = state.predicateLinks.filter(
        link =>
          !(
            (link.from.nodeId === nodeId && link.from.attr === attr) ||
            (link.to.nodeId === nodeId && link.to.attr === attr)
          )
      );
      const cleanedLinks = cleanupPredicateLinks(state.nodes, predicateLinks);
      const cleanedNodes = cleanupJoins(state.nodes, cleanedLinks);
      return {
        ...state,
        predicateLinks: cleanedLinks,
        nodes: cleanedNodes,
      };
    }
    case 'DELETE_PREDICATE_LINK': {
      const linkToDelete = action.payload;
      const newPredicateLinks = state.predicateLinks.filter(link => 
        !(link.from.nodeId === linkToDelete.from.nodeId && 
          link.from.attr === linkToDelete.from.attr && 
          link.to.nodeId === linkToDelete.to.nodeId && 
          link.to.attr === linkToDelete.to.attr)
      );
      const cleanedNodes = cleanupJoins(state.nodes, newPredicateLinks);
      return {
        ...state,
        predicateLinks: newPredicateLinks,
        nodes: cleanedNodes
      };
    }
    case 'UPDATE_PREDICATE_LINK': {
      const { oldLink, newLink } = action.payload;
      const newPredicateLinks = state.predicateLinks.map(link => {
        if (link.from.nodeId === oldLink.from.nodeId && 
            link.from.attr === oldLink.from.attr && 
            link.to.nodeId === oldLink.to.nodeId && 
            link.to.attr === oldLink.to.attr) {
          return newLink;
        }
        return link;
      });
      return {
        ...state,
        predicateLinks: newPredicateLinks
      };
    }
    default:
      return state;
  }
};

export default Reducer;