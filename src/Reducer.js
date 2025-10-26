const Reducer = (state, action) => {
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
        props: action.payload.props
      };
    case 'SET_GRAPH':
      console.log('SETTING GRAPH');
      return {
        ...state,
        nodes: action.payload.nodes,
        edges: action.payload.edges
      }
    case 'SET_NODES':
      console.log('SETTING nodes');
      return {
        ...state,
        nodes: action.payload,
      };
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

      // optional: prevent linking a predicate to itself
      const isSelf = newLink.from.nodeId === newLink.to.nodeId && newLink.from.attr === newLink.to.attr;
      if (isSelf) return { ...state, linkingPredicate: null };

      return {
        ...state,
        predicateLinks: [...state.predicateLinks, newLink],
        linkingPredicate: null
      };
    }
      case 'UPDATE_PREDICATE': {
        const { nodeId, attr, newPred } = action.payload;
        // Remove links involving this predicate if the predicate is now empty or changed
        let predicateLinks = state.predicateLinks;
        // If the predicate is now empty (no data), remove all links involving it
        if (!newPred || !newPred.data || newPred.data.length === 0) {
          predicateLinks = predicateLinks.filter(
            link =>
              !(
                (link.from.nodeId === nodeId && link.from.attr === attr) ||
                (link.to.nodeId === nodeId && link.to.attr === attr)
              )
          );
        }
        return {
          ...state,
          predicateLinks,
          // ...update the predicate as you already do
        };
      }

      case 'DELETE_PREDICATE': {
        const { nodeId, attr } = action.payload;
        // Remove all links involving this predicate
        const predicateLinks = state.predicateLinks.filter(
          link =>
            !(
              (link.from.nodeId === nodeId && link.from.attr === attr) ||
              (link.to.nodeId === nodeId && link.to.attr === attr)
            )
        );
        return {
          ...state,
          predicateLinks,
          // ...delete the predicate as you already do
        };
      }
    default:
      return state;
  }
};

export default Reducer;
