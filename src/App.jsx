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
import ConfirmationAlert from './components/ConfirmationAlert';
import {Button, Spin} from 'antd';
import {InfoCircleOutlined, CopyOutlined, LoadingOutlined} from '@ant-design/icons'
import Title from 'antd/lib/typography/Title';
import { getNodeId } from './utils/getNodeId';
import useVisualActions from './hooks/useVisualActions'

const api = require('./neo4jApi');

function App() {
  const VA = useVisualActions()
  const [state, dispatch] = useContext(Context);
  const [pageStatus, setPageStatus] = useState('LOADING');
  const [showResults, setShowResults] = useState(false);
  const [searchResult, setSearchResult] = useState([]);
  const [toastInfo, setToastInfo] = useState({ show: false, msg: '', confirm: function () {} });
  const [cypherQuery, setCypherQuery] = useState('')

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

  const renderContent = () => {
    if(pageStatus  === "LOADING") {
      return (
      <div style={{width: '100vw', height: '100vh'}}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 42 }} spin />} style={{margin:'35% 50%'}} />
      </div>)
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
              elements={state.nodes.map(
                  n => ({...n, data: {...n.data, color: n.color,radius:  n.radius, isBold: n.isBold}})
                )
                .concat(state.edges.map(
                  e => ({...e, data: {...e.data, isBold: e.isBold}})
                  ))}
              style={{ width: '100%', height: '100vh' }}
              nodeTypes={{ special: Node }}
              edgeTypes={{ custom: CustomEdge }}
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
