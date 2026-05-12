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

  const cleanupOrLinks = (nodes, orLinks) => {
    return (orLinks || []).filter(link => {
      return nodeExists(nodes, link.from.nodeId)
        && nodeExists(nodes, link.to.nodeId)
        && predicateExistsOnNode(nodes, link.from.nodeId, link.from.attr)
        && predicateExistsOnNode(nodes, link.to.nodeId, link.to.attr);
    });
  };

  const cleanupAndLinks = (nodes, andLinks) => {
    return (andLinks || []).filter(link => {
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
    case 'SET_OR_REPRESENTATION':
      return {
        ...state,
        orRepresentation: action.payload
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
        predicateLinks: [],
        orLinks: []
      };
    case 'SET_GRAPH':
      console.log('SETTING GRAPH');
      {
        const incomingNodes = action.payload.nodes || [];
        const incomingEdges = action.payload.edges || [];
        const cleanedLinks = cleanupPredicateLinks(incomingNodes, state.predicateLinks);
        const cleanedOrLinks = cleanupOrLinks(incomingNodes, state.orLinks);
        const incomingAndLinks = Object.prototype.hasOwnProperty.call(action.payload, 'andLinks')
          ? action.payload.andLinks
          : state.andLinks;
        const cleanedAndLinks = cleanupAndLinks(incomingNodes, incomingAndLinks);
        const cleanedNodes = cleanupJoins(incomingNodes, cleanedLinks);
        const nextDnfMode = Object.prototype.hasOwnProperty.call(action.payload, 'dnfMode')
          ? action.payload.dnfMode
          : state.dnfMode;
        const nextHoverCount = Object.prototype.hasOwnProperty.call(action.payload, 'dnfHoverCount')
          ? action.payload.dnfHoverCount
          : 0;
        return {
          ...state,
          nodes: cleanedNodes,
          edges: incomingEdges,
          predicateLinks: cleanedLinks,
          orLinks: cleanedOrLinks,
          andLinks: cleanedAndLinks,
          dnfMode: nextDnfMode,
          dnfHoverCount: nextHoverCount,
          dnfHovering: nextHoverCount > 0
        }
      }
    case 'SET_NODES':
      console.log('SETTING nodes');
      {
        const incomingNodes = action.payload || [];
        const cleanedLinks = cleanupPredicateLinks(incomingNodes, state.predicateLinks);
        const cleanedOrLinks = cleanupOrLinks(incomingNodes, state.orLinks);
        const cleanedAndLinks = cleanupAndLinks(incomingNodes, state.andLinks);
        const cleanedNodes = cleanupJoins(incomingNodes, cleanedLinks);
        return {
          ...state,
          nodes: cleanedNodes,
          predicateLinks: cleanedLinks,
          orLinks: cleanedOrLinks,
          andLinks: cleanedAndLinks
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
    case 'SET_LINKING_OR':
      return {
        ...state,
        linkingOR: action.payload
      };
    case 'DNF_HOVER_START': {
      const nextCount = state.dnfHoverCount + 1;
      return {
        ...state,
        dnfHoverCount: nextCount,
        dnfHovering: nextCount > 0
      };
    }
    case 'DNF_HOVER_END': {
      const nextCount = Math.max(0, state.dnfHoverCount - 1);
      return {
        ...state,
        dnfHoverCount: nextCount,
        dnfHovering: nextCount > 0
      };
    }
    case 'RESET_DNF_HOVER':
      return {
        ...state,
        dnfHoverCount: 0,
        dnfHovering: false
      };
    case 'SET_DNF_LINKS_VISIBLE':
      return {
        ...state,
        dnfLinksVisible: action.payload
      };
    case 'SET_DNF_AND_GROUPING':
      return {
        ...state,
        dnfAndGroupingEnabled: action.payload
      };
    case 'ADD_OR_LINK': {
      const newLink = action.payload;
      const exists = (state.orLinks || []).some(link =>
        (link.from.nodeId === newLink.from.nodeId &&
         link.from.attr === newLink.from.attr &&
         link.to.nodeId === newLink.to.nodeId &&
         link.to.attr === newLink.to.attr) ||
        (link.from.nodeId === newLink.to.nodeId &&
         link.from.attr === newLink.to.attr &&
         link.to.nodeId === newLink.from.nodeId &&
         link.to.attr === newLink.from.attr)
      );
      if (exists) return { ...state, linkingOR: null };

      const isSelf = newLink.from.nodeId === newLink.to.nodeId && newLink.from.attr === newLink.to.attr;
      if (isSelf) return { ...state, linkingOR: null };

      const newOrLinks = [...(state.orLinks || []), newLink];
      return {
        ...state,
        orLinks: newOrLinks,
        linkingOR: null
      };
    }
    case 'DELETE_OR_LINK': {
      const linkToDelete = action.payload;
      const newOrLinks = (state.orLinks || []).filter(link =>
        !(
          link.from.nodeId === linkToDelete.from.nodeId &&
          link.from.attr === linkToDelete.from.attr &&
          link.to.nodeId === linkToDelete.to.nodeId &&
          link.to.attr === linkToDelete.to.attr
        )
      );
      return {
        ...state,
        orLinks: newOrLinks
      };
    }
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
      let orLinks = state.orLinks || [];
      let andLinks = state.andLinks || [];
      if (!newPred || !newPred.data || newPred.data.length === 0) {
        predicateLinks = predicateLinks.filter(
          link =>
            !(
              (link.from.nodeId === nodeId && link.from.attr === attr) ||
              (link.to.nodeId === nodeId && link.to.attr === attr)
            )
        );
        orLinks = orLinks.filter(
          link =>
            !(
              (link.from.nodeId === nodeId && link.from.attr === attr) ||
              (link.to.nodeId === nodeId && link.to.attr === attr)
            )
        );
        andLinks = andLinks.filter(
          link =>
            !(
              (link.from.nodeId === nodeId && link.from.attr === attr) ||
              (link.to.nodeId === nodeId && link.to.attr === attr)
            )
        );
      }
      const cleanedLinks = cleanupPredicateLinks(state.nodes, predicateLinks);
      const cleanedOrLinks = cleanupOrLinks(state.nodes, orLinks);
      const cleanedAndLinks = cleanupAndLinks(state.nodes, andLinks);
      const cleanedNodes = cleanupJoins(state.nodes, cleanedLinks);
      return {
        ...state,
        predicateLinks: cleanedLinks,
        orLinks: cleanedOrLinks,
        andLinks: cleanedAndLinks,
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
      let orLinks = (state.orLinks || []).filter(
        link =>
          !(
            (link.from.nodeId === nodeId && link.from.attr === attr) ||
            (link.to.nodeId === nodeId && link.to.attr === attr)
          )
      );
      let andLinks = (state.andLinks || []).filter(
        link =>
          !(
            (link.from.nodeId === nodeId && link.from.attr === attr) ||
            (link.to.nodeId === nodeId && link.to.attr === attr)
          )
      );
      const cleanedLinks = cleanupPredicateLinks(state.nodes, predicateLinks);
      const cleanedOrLinks = cleanupOrLinks(state.nodes, orLinks);
      const cleanedAndLinks = cleanupAndLinks(state.nodes, andLinks);
      const cleanedNodes = cleanupJoins(state.nodes, cleanedLinks);
      return {
        ...state,
        predicateLinks: cleanedLinks,
        orLinks: cleanedOrLinks,
        andLinks: cleanedAndLinks,
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