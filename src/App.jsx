import React, { useState, useEffect, useContext } from 'react';
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
import ConfirmationAlert from './components/ConfirmationAlert';
import {Button, Spin, Select} from 'antd';
import {InfoCircleOutlined, CopyOutlined, LoadingOutlined} from '@ant-design/icons'
import Title from 'antd/lib/typography/Title';
import { getNodeId } from './utils/getNodeId';
import useVisualActions from './hooks/useVisualActions'
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
  const [cypherQuery, setCypherQuery] = useState('');
  const [databaseSource, setDatabaseSource] = useState('northwind')

  //* only for user study
  // const [userStudyDataset, setUserStudyDataset] = useState('Northwind')

  const handleSearch = async () => {
    const res = await VA.run(cypherQuery)
    setSearchResult(res);
    setShowResults(true);
  };

  useEffect(() => {
    if(state.nodes && state.nodes.length > 0){
      const cypherString = api.convertToQuery(state)
      setCypherQuery(cypherString)
    }
  }, [state])

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
    let graph
    console.log(elementsToRemove)
    for(const el of elementsToRemove){
      if(el.data.label){
        graph = VA.delete(state, "NODE", {label: el.data.label, el: el})
      } else {
        graph = VA.delete(state, "EDGE", {
          el: el,
        })
      }
    }

    _internalDispatchGraph(graph)
  };

  const onConnect = (params) => {
    console.log("HANDLE CONNECTION",params)
    if (params.sourceHandle && params.targetHandle) {
      dispatch({
        type: 'ADD_PREDICATE_LINK',
        payload: {
          from: { nodeId: params.source, attr: params.sourceHandle },
          to:   { nodeId: params.target, attr: params.targetHandle }
        }
      });
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
        }
      }))
    : [];

  const renderContent = () => {
    if(pageStatus  === "LOADING") {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
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
      )
    } else if (pageStatus === "READY") {
      return (
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
                  value={databaseSource}
                  onChange={setDatabaseSource}
                  style={{ width: 160 }}
                  size="middle"
                >
                  <Select.Option value="recommendations">Recommendations</Select.Option>
                  <Select.Option value="movies">Movies</Select.Option>
                  <Select.Option value="northwind">NorthWind</Select.Option>
                  <Select.Option value="fincen">Fincen</Select.Option>
                  <Select.Option value="twitter">Twitter</Select.Option>
                  <Select.Option value="stackoverflow">StackOverFlow</Select.Option>
                  <Select.Option value="gameofthrones">GameOfThrones</Select.Option>
                  <Select.Option value="neoflix">NeoFlix</Select.Option>
                  <Select.Option value="wordnet">WordNet</Select.Option>
                  <Select.Option value="slack">Slack</Select.Option>
                </Select>
              </div>
              <NewNodeDrawButton addNode={addNode} />
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
                      isBold: n.isBold
                    }
                  })
                ).concat(
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
                ).concat(predicateLinkElements)
              }
              style={{ width: '100%', height: '100vh' }}
              nodeTypes={{ special: Node }}
              edgeTypes={{ custom: CustomEdge, predicateLink: PredicateLinkEdge }}
              onElementsRemove={(elementsToRemove) =>
                setToastInfo({
                  show: true,
                  msg: `Are you sure you want to remove this ${isEdge(elementsToRemove[0]) ? 'edge' : 'node'}?`,
                  confirm: () => onElementsRemove(elementsToRemove),
                })
              }
              onConnect={onConnect}
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

          {showResults ? <SearchResults result={searchResult.result} query={searchResult.query} hide={() => setShowResults(false)} /> : null}
        </>
      )
    }
  }
  return (
    <div className="App" id="app-root">
      {renderContent()}
    </div>
  );
}

export default App;
