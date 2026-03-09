import React, { createContext, useReducer } from 'react';
import Reducer from './Reducer';

const initialState = {
  nodes: [],
  edges: [],
  entities: [],
  neighbours: {},
  props: {},
  predDisplayStatus: 'FULL',
  modalVisible: '',
  linkingPredicate: null,
  predicateLinks: [],
  linkingOR: null,
  orLinks: [],
  andLinks: [],
  dnfMode: false,
  dnfHovering: false,
  dnfHoverCount: 0
};

const Store = ({ children }) => {
  const [state, dispatch] = useReducer(Reducer, initialState);
  return <Context.Provider value={[state, dispatch]}>{children}</Context.Provider>;
};

export const Context = createContext(initialState);
export default Store;
