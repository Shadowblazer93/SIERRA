import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import Node from './components/Node';
import ReactFlow, { Controls, isEdge, addEdge, removeElements, Background, useStoreState, ReactFlowProvider } from 'react-flow-renderer';
import NewNodeDrawButton from './components/NewNodeDrawButton';
import PredicateDisplayDropDown from './components/PredicateDisplayDropDown';
import UserStudyDatasetDropDown from './components/UserStudyDatasetDropDown';
import CypherTextEditor from './components/TextEditor'
import Help from './components/Help';
import SearchResults from './components/SearchResults';
import { Context } from './Store';
import CustomEdge from './components/CustomEdge';
import PredicateLinkEdge from './components/PredicateLinkEdge';
import OrLinkEdge from './components/OrLinkEdge';
import AndLinkEdge from './components/AndLinkEdge';
import PredicateLinkModal from './components/PredicateLinkModal';
import ConfirmationAlert from './components/ConfirmationAlert';
import {Button, Spin, Select, Drawer, Modal, Form, Input, Row, Col} from 'antd';
import {InfoCircleOutlined, CopyOutlined, LoadingOutlined, ApiOutlined, ArrowLeftOutlined} from '@ant-design/icons'
import Title from 'antd/lib/typography/Title';
import { getNodeId } from './utils/getNodeId';
import useVisualActions from './hooks/useVisualActions'
import JoinGraphView from './components/JoinGraphView';
import QueryControls from './components/QueryControls';
import { buildDnfAndLinksFromQuery } from './utils/dnfGraph';
import { buildOrGroupRoots } from './utils/orGroupRoots';
const neo4jApi = require('./neo4jApi')
const pkg = require('../package.json')

const api = require('./neo4jApi');

function App() {
  const VA = useVisualActions()
  const [state, dispatch] = useContext(Context);
  const [pageStatus, setPageStatus] = useState('LOADING');
  const [showResults, setShowResults] = useState(false);
  const [searchResult, setSearchResult] = useState([]);
  const [toastInfo, setToastInfo] = useState({ show: false, msg: '', confirm: function () {} });
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [selectedLink, setSelectedLink] = useState(null);
  const [cypherQuery, setCypherQuery] = useState('');
  const [databaseSource, setDatabaseSource] = useState('northwind');
  const [linkToolMode, setLinkToolMode] = useState('join');
  const connectModeRef = useRef('join');
  const pendingOrRef = useRef(false);
  const orGroupColorsRef = useRef({});
  const [hoveredOrGroupId, setHoveredOrGroupId] = useState(null);
  const orGroupHoverTimeout = useRef(null);
  const [orGroupModalVisible, setOrGroupModalVisible] = useState(false);
  const [activeOrGroupId, setActiveOrGroupId] = useState(null);
  const lastDnfSignatureRef = useRef('');
  const dnfHoverResetTimer = useRef(null);
  const lastDnfModeRef = useRef(false);
  const dnfActivationTimer = useRef(null);
  
  const [queryOptions, setQueryOptions] = useState({
    limit: '',
    skip: '',
    distinct: false,
    orderBys: [], // Changed from orderBy string to array of objects { field, direction }
    withClauses: [], // Changed from withClause string to array of objects { expression, alias }
    returnClause: ''
  });

  const [connectModalVisible, setConnectModalVisible] = useState(false);
  const [form] = Form.useForm();

  const getOrGroupColor = (groupId) => {
    if (!groupId) return '#ff8c00';
    if (!orGroupColorsRef.current[groupId]) {
      const randomChannel = () => 80 + Math.floor(Math.random() * 150);
      const toHex = (value) => value.toString(16).padStart(2, '0');
      const r = randomChannel();
      const g = randomChannel();
      const b = randomChannel();
      orGroupColorsRef.current[groupId] = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    return orGroupColorsRef.current[groupId];
  };

  const orGroupRoots = useMemo(() => {
    return buildOrGroupRoots(state.nodes, state.orLinks);
  }, [state.nodes, state.orLinks]);

  const getOrGroupPredicateKeys = (groupId) => {
    if (!groupId) return [];
    return Object.keys(orGroupRoots).filter((key) => orGroupRoots[key] === groupId);
  };

  const getPredicateLabel = (nodeId, attr) => {
    const node = (state.nodes || []).find((n) => String(n.id) === String(nodeId));
    const nodeLabel = node?.data?.label || node?.data?.rep || nodeId;
    return `${nodeLabel}.${attr}`;
  };

  const orGroupPredicates = useMemo(() => {
    const keys = getOrGroupPredicateKeys(activeOrGroupId);
    return keys.map((key) => {
      const [nodeId, ...attrParts] = key.split('_');
      const attr = attrParts.join('_');
      return {
        key,
        nodeId,
        attr,
        label: getPredicateLabel(nodeId, attr)
      };
    });
  }, [activeOrGroupId, orGroupRoots, state.nodes]);

  useEffect(() => {
    if (orGroupModalVisible && orGroupPredicates.length === 0) {
      setOrGroupModalVisible(false);
      setActiveOrGroupId(null);
    }
  }, [orGroupModalVisible, orGroupPredicates.length]);

  useEffect(() => {
    const activeGroups = new Set(Object.values(orGroupRoots));
    Object.keys(orGroupColorsRef.current).forEach((groupId) => {
      if (!activeGroups.has(groupId)) {
        delete orGroupColorsRef.current[groupId];
      }
    });
  }, [orGroupRoots]);

  useEffect(() => {
    return () => {
      if (orGroupHoverTimeout.current) {
        clearTimeout(orGroupHoverTimeout.current);
      }
    };
  }, []);
  
  const handleDatabaseChange = (value) => {
    if (value === 'connect-database') {
      setConnectModalVisible(true);
    } else {
      setDatabaseSource(value);
    }
  };

  //* only for user study
  // const [userStudyDataset, setUserStudyDataset] = useState('Northwind')

  const handleSearch = async () => {
    const res = await VA.run(cypherQuery)
    setSearchResult(res);
    setShowResults(true);
  };

  useEffect(() => {
    if(state.nodes && state.nodes.length > 0){
      let query = api.convertToQuery(state)
      
      // Apply Query Options
      if (queryOptions.returnClause) {
        const lastReturnIndex = query.lastIndexOf('RETURN');
        if (lastReturnIndex !== -1) {
            const pre = query.substring(0, lastReturnIndex);
            query = pre + `RETURN ${queryOptions.returnClause}`;
        } else {
            query += `\nRETURN ${queryOptions.returnClause}`;
        }
      }

      if (queryOptions.distinct) {
          const lastReturnIndex = query.lastIndexOf('RETURN');
          if (lastReturnIndex !== -1) {
            const chunk = query.substring(lastReturnIndex);
            if (!chunk.toUpperCase().startsWith('RETURN DISTINCT')) {
                  const pre = query.substring(0, lastReturnIndex);
                  const post = query.substring(lastReturnIndex + 6); 
                  query = pre + 'RETURN DISTINCT' + post;
            }
          }
      }

      if (queryOptions.withClauses && queryOptions.withClauses.length > 0) {
          const withs = queryOptions.withClauses
            .filter(w => w.expression)
            .map(w => w.alias ? `${w.expression} AS ${w.alias}` : w.expression)
            .join(', ');
          
          if (withs) {
              query += `\nWITH ${withs}`;
          }
      }

      if (queryOptions.orderBys && queryOptions.orderBys.length > 0) {
          const orders = queryOptions.orderBys
            .filter(o => o.field)
            .map(o => `${o.field} ${o.direction}`)
            .join(', ');
            
          if (orders) {
              query += `\nORDER BY ${orders}`;
          }
      }
      
      if (queryOptions.skip) {
          query += `\nSKIP ${queryOptions.skip}`;
      }

      if (queryOptions.limit) {
          query += `\nLIMIT ${queryOptions.limit}`;
      }

      setCypherQuery(query)
    }
  }, [state, queryOptions])

  useEffect(() => {
    if (!cypherQuery || !state.nodes || state.nodes.length === 0) return;
    let dnfInfo;
    try {
      dnfInfo = buildDnfAndLinksFromQuery(cypherQuery, state.nodes);
    } catch (error) {
      dnfInfo = {
        andLinks: [],
        participatingNodeIds: new Set(),
        dnfTermsCount: 0,
        hasMixedBoolean: false
      };
    }

    const participatingList = Array.from(dnfInfo.participatingNodeIds).sort();
    const signature = JSON.stringify({
      andLinks: dnfInfo.andLinks,
      dnfTermsCount: dnfInfo.dnfTermsCount,
      participating: participatingList
    });

    if (signature === lastDnfSignatureRef.current) return;
    lastDnfSignatureRef.current = signature;

    const updatedNodes = state.nodes.map((node) => {
      const participates = dnfInfo.participatingNodeIds.has(node.id);
      if (node?.data?.dnfParticipates === participates) return node;
      return {
        ...node,
        data: {
          ...node.data,
          dnfParticipates: participates
        }
      };
    });

    const nextDnfMode = dnfInfo.hasMixedBoolean && dnfInfo.dnfTermsCount > 0;
    const allowDnfHover = state.dnfLinksVisible;
    const activateDnfMode = allowDnfHover && nextDnfMode && !lastDnfModeRef.current;
    lastDnfModeRef.current = nextDnfMode;

    if (dnfActivationTimer.current) {
      clearTimeout(dnfActivationTimer.current);
      dnfActivationTimer.current = null;
    }

    if (activateDnfMode) {
      dnfActivationTimer.current = setTimeout(() => {
        dispatch({ type: 'RESET_DNF_HOVER' });
      }, 1200);
    }

    dispatch({
      type: 'SET_GRAPH',
      payload: {
        ...state,
        nodes: updatedNodes,
        edges: state.edges,
        andLinks: dnfInfo.andLinks,
        dnfMode: nextDnfMode,
        dnfHoverCount: activateDnfMode ? 1 : 0
      }
    });
  }, [cypherQuery, state.nodes, state.edges, state.dnfLinksVisible]);

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    connectModeRef.current = linkToolMode;
    pendingOrRef.current = false;
    if (linkToolMode !== 'or') {
      dispatch({
        type: 'SET_LINKING_OR',
        payload: null
      });
    }
  }, [linkToolMode, dispatch]);

  const scheduleDnfHoverReset = () => {
    if (!state.dnfLinksVisible) return;
    if (dnfHoverResetTimer.current) {
      clearTimeout(dnfHoverResetTimer.current);
    }
    dnfHoverResetTimer.current = setTimeout(() => {
      dispatch({ type: 'RESET_DNF_HOVER' });
    }, 2000);
  };

  const cancelDnfHoverReset = () => {
    if (!state.dnfLinksVisible) return;
    if (dnfHoverResetTimer.current) {
      clearTimeout(dnfHoverResetTimer.current);
      dnfHoverResetTimer.current = null;
    }
  };

  useEffect(() => {
    async function fetchData() {
      let result = await api.setUp();
      let props = await api.getProperties(result.entities);
      return { entities: result.entities, neighbours: result.neighbours, props: props };
    }

    fetchData().then((res) => {
      dispatch({ type: 'SET_DATA', payload: res });
      setPageStatus("READY")
    });

  }, []);

  useEffect(() => {
    // when DB source changes: show loading, recreate driver, re-fetch data
    let mounted = true;
    (async () => {
      setPageStatus('LOADING');
      if (typeof api.setDatabase === 'function') {
        await api.setDatabase(databaseSource);
      }
      try {
        const result = await api.setUp();
        const props = await api.getProperties(result.entities);
        if (!mounted) return;
        dispatch({ type: 'SET_DATA', payload: { entities: result.entities, neighbours: result.neighbours, props } });
        setPageStatus('READY');
      } catch (e) {
        console.error('Error reloading data after DB change', e);
        if (mounted) setPageStatus('READY');
      }
    })();
    return () => { mounted = false; }
  }, [databaseSource]);

  const _internalDispatchPredDisplayStatus = (val) => {
    dispatch({
      type: 'SET_PRED_DISPLAY',
      payload: val
    })
  }

  const _internalDispatchGraph = (graph) => {
    dispatch({
      type: 'SET_GRAPH',
      payload: graph
    })
  }
  const onElementsRemove = (elementsToRemove) => {
    let graph = state;
    console.log(elementsToRemove)
    for(const el of elementsToRemove){
      if(el.data && el.data.label){
        graph = VA.delete(graph, "NODE", {label: el.data.label, el: el})
      } else {
        graph = VA.delete(graph, "EDGE", {
          el: el,
        })
      }
    }

    _internalDispatchGraph(graph)
  };

  const onConnectStart = (event, params) => {
    connectModeRef.current = linkToolMode;
    pendingOrRef.current = false;
    if (linkToolMode === 'or' && params && params.nodeId && params.handleId) {
      dispatch({
        type: 'SET_LINKING_OR',
        payload: { nodeId: params.nodeId, attr: params.handleId }
      });
    } else {
      dispatch({
        type: 'SET_LINKING_OR',
        payload: null
      });
    }
  };

  const onConnectStop = () => {
    if (pendingOrRef.current) {
      setTimeout(() => {
        if (pendingOrRef.current) {
          dispatch({
            type: 'SET_LINKING_OR',
            payload: null
          });
          pendingOrRef.current = false;
        }
      }, 0);
    }
  };

  const onConnect = (params) => {
    console.log("HANDLE CONNECTION",params)
    if (params.sourceHandle && params.targetHandle) {
      if (connectModeRef.current === 'and') {
        dispatch({
          type: 'SET_LINKING_OR',
          payload: null
        });
        pendingOrRef.current = false;
        return;
      }

      const isOrConnect = connectModeRef.current === 'or';
      if (isOrConnect) {
        dispatch({
          type: 'ADD_OR_LINK',
          payload: {
            from: { nodeId: params.source, attr: params.sourceHandle },
            to:   { nodeId: params.target, attr: params.targetHandle }
          }
        });
      } else {
        dispatch({
          type: 'ADD_PREDICATE_LINK',
          payload: {
            from: { nodeId: params.source, attr: params.sourceHandle },
            to:   { nodeId: params.target, attr: params.targetHandle }
          }
        });
      }
      dispatch({
        type: 'SET_LINKING_OR',
        payload: null
      });
      pendingOrRef.current = false;
      return; // don't fall through to normal node-edge logic
    }

    const src = state.nodes.find((el) => el.id === params.source);
    const dest = state.nodes.find((el) => el.id === params.target);
    const srcNeighbours = state.neighbours[src.data.label].map((rs) => {
      return rs.label;
    });

    if (srcNeighbours.includes(dest.data.label)) {
      _internalDispatchGraph(VA.add(state, "EDGE", {params}))
    } else {
      setToastInfo({
        show: true,
        msg: `There is no data corresponding to an edge from ${src.data.label} to ${dest.data.label}. Are you sure you want to add this edge?`,
        confirm: function (){
          _internalDispatchGraph(VA.add(state, "EDGE", {params}))
        }
      });
    }
  };

  const addNode = (nodeName) => {
    const graph = VA.add(state, "NODE", {label: nodeName})

    dispatch({
      type: 'SET_GRAPH',
      payload: graph
    })
  }

  const handleLinkClick = (event, id) => {
    const idx = parseInt(id.split('-')[2]);
    const link = state.predicateLinks[idx];
    setSelectedLink(link);
    setJoinModalVisible(true);
  };

  const handleDeleteLink = () => {
    if (selectedLink) {
      dispatch({
        type: 'DELETE_PREDICATE_LINK',
        payload: selectedLink
      });
      setJoinModalVisible(false);
      setSelectedLink(null);
    }
  };

  const handleUpdateLink = (newLink) => {
    if (selectedLink) {
      dispatch({
        type: 'UPDATE_PREDICATE_LINK',
        payload: { oldLink: selectedLink, newLink }
      });
      setSelectedLink(newLink);
    }
  };

  const handleEditLink = (link) => {
    setSelectedLink(link);
    setJoinModalVisible(true);
  };

  const predicateLinkElements = state.predicateLinks.length > 0
    ? state.predicateLinks.map((link, idx) => ({
        id: `predicate-link-${idx}`,
        source: link.from.nodeId,
        target: link.to.nodeId,
        sourceHandle: link.from.attr,
        targetHandle: link.to.attr,
        type: 'predicateLink',
        data: {
          fromAttr: link.from.attr,
          toAttr: link.to.attr,
          operator: link.operator,
          joinType: link.joinType,
          onLinkClick: handleLinkClick
        }
      }))
    : [];

  const handleOrGroupOpen = (event, groupId) => {
    event.stopPropagation();
    setActiveOrGroupId(groupId);
    setOrGroupModalVisible(true);
  };

  const handleOrGroupHoverStart = (groupId) => {
    if (!groupId) return;
    if (orGroupHoverTimeout.current) {
      clearTimeout(orGroupHoverTimeout.current);
      orGroupHoverTimeout.current = null;
    }
    setHoveredOrGroupId(groupId);
  };

  const handleOrGroupHoverEnd = (groupId) => {
    if (!groupId) return;
    if (orGroupHoverTimeout.current) {
      clearTimeout(orGroupHoverTimeout.current);
    }
    orGroupHoverTimeout.current = setTimeout(() => {
      setHoveredOrGroupId((prev) => (prev === groupId ? null : prev));
      orGroupHoverTimeout.current = null;
    }, 650);
  };

  const handleRemovePredicateFromOrGroup = (nodeId, attr) => {
    const linksToRemove = (state.orLinks || []).filter((link) =>
      (String(link.from.nodeId) === String(nodeId) && link.from.attr === attr) ||
      (String(link.to.nodeId) === String(nodeId) && link.to.attr === attr)
    );

    linksToRemove.forEach((link) => {
      dispatch({ type: 'DELETE_OR_LINK', payload: link });
    });
  };

  const showDnfLinks = state.dnfMode && state.dnfLinksVisible && !state.dnfHovering;
  const andOpacity = showDnfLinks ? 1 : 0;
  const orOpacity = showDnfLinks ? 0 : 1;

  const orLinkElements = (state.orLinks || []).length > 0
    ? state.orLinks.map((link, idx) => {
        const fromKey = `${link.from.nodeId}_${link.from.attr}`;
        const toKey = `${link.to.nodeId}_${link.to.attr}`;
        const isSameNodeGroup = String(link.from.nodeId) === String(link.to.nodeId);
        const groupId = orGroupRoots[fromKey] || orGroupRoots[toKey] || fromKey;
        const groupColor = getOrGroupColor(groupId);
        return {
          id: `or-link-${idx}`,
          source: link.from.nodeId,
          target: link.to.nodeId,
          sourceHandle: link.from.attr,
          targetHandle: link.to.attr,
          type: 'orLink',
          data: {
            fromAttr: link.from.attr,
            toAttr: link.to.attr,
            orGroupId: groupId,
            orGroupColor: groupColor,
            onOrTextClick: handleOrGroupOpen,
            isGroupHovering: hoveredOrGroupId === groupId,
            hideEdgeLabel: isSameNodeGroup,
            opacity: orOpacity
          }
        };
      })
    : [];

  const andLinkElements = (state.andLinks || []).length > 0
    ? state.andLinks.map((link, idx) => ({
        id: `and-link-${idx}`,
        source: link.from.nodeId,
        target: link.to.nodeId,
        sourceHandle: link.from.attr,
        targetHandle: link.to.attr,
        type: 'andLink',
        data: {
          groupId: link.groupId,
          color: link.color,
          opacity: andOpacity
        }
      }))
    : [];

  const loadingOverlay = (
    <div className={`loading-screen ${pageStatus === 'READY' ? 'fade-out' : ''}`}>
      <div className="spinner-layer" aria-hidden>
        <LoadingOutlined className="spin spin-1" />
        <LoadingOutlined className="spin spin-2" />
        <LoadingOutlined className="spin spin-3" />
      </div>
      <Title style={{ color: '#0b3d91', fontSize: 70, fontFamily: 'monospace', fontWeight: 700}}>SIERRA</Title>
      <div style={{ marginTop: -40, color: '#6b7280', fontSize: 20, fontFamily: 'monospace' }}>Loading...</div>

      {/* version badge */}
      <div style={{
        position: 'fixed',
        right: 12,
        bottom: 8,
        fontSize: 12,
        fontWeight: 500,
        color: '#000000ff',
        background: 'rgba(120, 192, 255, 0.7)',
        padding: '4px 8px',
        borderRadius: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        v{pkg.version}
      </div>
    </div>
  );

  return (
    <div className="App" id="app-root">
      {loadingOverlay}
      
      <>
          <div>
            <div className="main-buttons">
              {state.modalVisible !== '' && (<div style={{width: 363}}/>)}
              <Title
                style={{margin: 0, marginRight: 14}}
                level={3}>
                  SIERRA
              </Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 7 }}>
                <Select
                  value={typeof databaseSource === 'string' ? databaseSource : (databaseSource.database || 'Custom Database')}
                  onChange={handleDatabaseChange}
                  style={{ width: 160 }}
                  size="middle"
                >
                  <Select.Option value="connect-database" style={{ backgroundColor: '#1890ff', color: 'white', fontSize: 13 }}>
                    <ApiOutlined style={{ marginRight: 8 }} />
                    Connect Database
                  </Select.Option>
                  <Select.OptGroup label="Demo Databases">
                    <Select.Option value="recommendations">Recommendations</Select.Option>
                    <Select.Option value="movies">Movies</Select.Option>
                    <Select.Option value="northwind">NorthWind</Select.Option>
                    <Select.Option value="fincen">Fincen</Select.Option>
                    <Select.Option value="twitter">Twitter</Select.Option>
                    {/* <Select.Option value="stackoverflow">StackOverFlow</Select.Option> */}
                    <Select.Option value="gameofthrones">GameOfThrones</Select.Option>
                    {/* <Select.Option value="neoflix">NeoFlix</Select.Option> */}
                    {/* <Select.Option value="wordnet">WordNet</Select.Option> */}
                    {/* <Select.Option value="slack">Slack</Select.Option> */}
                  </Select.OptGroup>
                </Select>
              </div>
              <NewNodeDrawButton addNode={addNode} />
              <Select
                value={linkToolMode}
                onChange={setLinkToolMode}
                size="middle"
                className="link-tool-select"
                dropdownClassName="link-tool-dropdown"
                style={{ width: 150, marginLeft: 50 }}
              >
                <Select.Option value="join" className="link-tool-option link-tool-join">
                  Join
                </Select.Option>
                <Select.Option value="or" className="link-tool-option link-tool-or">
                  OR Link
                </Select.Option>
                <Select.Option value="and" className="link-tool-option link-tool-and">
                  AND Link
                </Select.Option>
              </Select>
              <PredicateDisplayDropDown value={state.predDisplayStatus} onSelect={_internalDispatchPredDisplayStatus} />
              {/* <UserStudyDatasetDropDown value={userStudyDataset} onSelect={setUserStudyDataset} /> */}
              <Button
                style={{
                  width: 120,
                  borderRadius: 4,
                  marginLeft: 'auto'
                }}
                type="primary"
                disabled={state.nodes.length === 0}
                onClick={handleSearch}
              >
                Play
              </Button>
            </div>
          </div>

          <Drawer
            title={<Title style={{ marginBottom: 0 }} level={3}>OR Group Predicates</Title>}
            placement="left"
            closeIcon={<ArrowLeftOutlined />}
            onClose={() => {
              setOrGroupModalVisible(false);
              setActiveOrGroupId(null);
            }}
            visible={orGroupModalVisible}
            push={false}
            maskClosable={false}
            mask={false}
            width={363}
          >
            {orGroupPredicates.length === 0 ? (
              <div style={{ color: '#888' }}>No predicates in this OR group.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orGroupPredicates.map((pred) => (
                  <div
                    key={pred.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '6px 8px',
                      border: '1px solid #eee',
                      borderRadius: 6
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{pred.label}</span>
                    <Button
                      danger
                      size="small"
                      onClick={() => handleRemovePredicateFromOrGroup(pred.nodeId, pred.attr)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Drawer>

          <JoinGraphView onEditLink={handleEditLink} />
          <QueryControls 
            options={queryOptions} 
            onOptionsChange={setQueryOptions}
            dnfLinksVisible={state.dnfLinksVisible}
            onToggleDnfLinks={(visible) => {
              dispatch({ type: 'SET_DNF_LINKS_VISIBLE', payload: visible });
              if (!visible) {
                dispatch({ type: 'RESET_DNF_HOVER' });
              }
            }}
            dnfAndGroupingEnabled={state.dnfAndGroupingEnabled}
            onToggleDnfAndGrouping={(enabled) => {
              dispatch({ type: 'SET_DNF_AND_GROUPING', payload: enabled });
            }}
          />
          <ReactFlowProvider>
            <CypherTextEditor text={cypherQuery}/>

            <ReactFlow
              elements={
                state.nodes.map(
                  n => ({
                    ...n,
                    data: {
                      ...n.data,
                      color: n.color,
                      radius: n.radius,
                      isBold: n.isBold,
                      orGroupRoots,
                      onOrGroupOpen: handleOrGroupOpen,
                      onOrGroupHoverStart: handleOrGroupHoverStart,
                      onOrGroupHoverEnd: handleOrGroupHoverEnd,
                      hoveredOrGroupId
                    }
                  })
                ).concat(andLinkElements).concat(
                  state.edges.map(e => {
                    const sourceNode = state.nodes.find(n => n.id === e.source);
                    const targetNode = state.nodes.find(n => n.id === e.target);
                    return {
                      ...e,
                      data: {
                        ...e.data,
                        isBold: e.isBold,
                        sourcePredicates: sourceNode?.data?.predicates || {},
                        targetPredicates: targetNode?.data?.predicates || {},
                      }
                    };
                  })
                ).concat(predicateLinkElements).concat(orLinkElements)
              }
              style={{ width: '100%', height: '100vh' }}
              nodeTypes={{ special: Node }}
              edgeTypes={{ custom: CustomEdge, predicateLink: PredicateLinkEdge, orLink: OrLinkEdge, andLink: AndLinkEdge }}
              onElementsRemove={(elementsToRemove) =>
                setToastInfo({
                  show: true,
                  msg: `Are you sure you want to remove this ${isEdge(elementsToRemove[0]) ? 'edge' : 'node'}?`,
                  confirm: () => onElementsRemove(elementsToRemove),
                })
              }
              onConnect={onConnect}
              onConnectStart={onConnectStart}
              onConnectStop={onConnectStop}
              onPaneMouseLeave={scheduleDnfHoverReset}
              onPaneMouseEnter={cancelDnfHoverReset}
            >
              <Controls className='controls-custom' />
              <Background
                style={{backgroundColor: '#ECEFF2'}}
                variant="dots"
                color="#343330"
              />
            </ReactFlow>
          </ReactFlowProvider>

          {toastInfo.show ? (
            <ConfirmationAlert
              hide={() => setToastInfo({ ...toastInfo, show: false })}
              msg={toastInfo.msg}
              confirm={toastInfo.confirm}
              attr={toastInfo.attr ? toastInfo.attr : null}
            />
          ) : null}

          <PredicateLinkModal
            visible={joinModalVisible}
            onClose={() => setJoinModalVisible(false)}
            link={selectedLink}
            onDelete={handleDeleteLink}
            onUpdate={handleUpdateLink}
          />
          
          <Modal
            title="Connect to Database"
            visible={connectModalVisible}
            onOk={() => {
              form
                .validateFields()
                .then((values) => {
                  form.resetFields();
                  let { uri } = values;
                  // Check for existing protocol
                  if (!/^[a-z0-9+.-]+:\/\//i.test(uri)) {
                    uri = `bolt+s://${uri}`;
                  }
                  
                  setDatabaseSource({ ...values, uri });
                  setConnectModalVisible(false);
                })
                .catch((info) => {
                  console.log('Validate Failed:', info);
                });
            }}
            onCancel={() => setConnectModalVisible(false)}
          >
            <Form
              form={form}
              layout="vertical"
              name="form_in_modal"
              initialValues={{
                uri: 'localhost:7687',
                username: 'neo4j',
                database: 'neo4j'
              }}
            >
              <Form.Item
                name="uri"
                label="Connection URI"
                className="db-uri-field"
                rules={[{ required: true, message: 'Please input the URI of the database!' }]}
              >
                <Input addonBefore="bolt+s://" />
              </Form.Item>
              <Form.Item
                name="database"
                label="Database Name"
                rules={[{ required: true, message: 'Please input the database name!' }]}
              >
                <Input />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label="Username"
                    rules={[{ required: true, message: 'Please input the username!' }]}
                  >
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[{ required: true, message: 'Please input the password!' }]}
                  >
                    <Input.Password />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Modal>

          {showResults ? 
            <SearchResults 
              result={searchResult.result} 
              query={searchResult.query} 
              hide={() => setShowResults(false)}
              colMap={state.nodes.reduce((acc, node) => {
                if(node.data && node.data.rep) {
                   acc[node.data.rep] = typeof node.color === 'object' ? node.color.light : node.color;
                }
                return acc;
              }, {})}
            /> 
            : null}
        </>
    </div>
  );
}

export default App;
