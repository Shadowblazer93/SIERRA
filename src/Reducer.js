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
    default:
      return state;
  }
};

export default Reducer;
