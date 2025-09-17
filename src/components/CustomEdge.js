import React, { useContext, useRef, useState, useEffect } from 'react';
import _ from 'lodash'
import { getBezierPath, getMarkerEnd } from 'react-flow-renderer';
import ReactDOM from 'react-dom';
import { Context } from '../Store';
import { BsPencilSquare, BsPlusCircle, BsFillEyeFill } from 'react-icons/bs';
import * as Constants from '../constants';
import Predicate from './Predicate';
import EdgeModal from './EdgeModal';
import useVisualActions from '../hooks/useVisualActions';
import { Tooltip } from 'antd';

const api = require('../neo4jApi');

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {
    stroke: 'darkgrey',
    strokeWidth: '3',
  },
  data,
  arrowHeadType,
  markerEndId,
}) {
  console.log("CustomEdge data:", data);

  const VA = useVisualActions()
  const [directed, setDirected] = useState(true);
  const [state, dispatch] = useContext(Context);
  const [propData, setPropData] = useState([]);

  const edgePath = `M ${sourceX}, ${sourceY}L ${targetX}, ${targetY}`
  const markerEnd = getMarkerEnd(directed === true ? arrowHeadType : '', markerEndId);

  const predicates = data.predicates ?? {}
  const {rs, cardinality} = data
  const isDirected = arrowHeadType === "arrowclosed"

  useEffect(() => {
    const fetchData = async () => {
      const propValues = await api.fetchEdgePropertyValues(rs);
      return propValues
    }

    if (rs !== '') {
      fetchData().then(res => {
        setPropData(res);
      })

    }

  }, [rs])

  const setModalVisible = (bool) => {
    dispatch({
      type:'SET_OPEN_MODAL',
      payload: bool ? id : ''
    })
  }

  const _internalDispatchGraph = (graph) => {
    dispatch({
      type: 'SET_GRAPH',
      payload: graph
    })
  }

  const toggleDirected = () => {
    updateEdgeRs("")
    const graph = VA.update(state, "EDGE", {
      edge: id,
      prop: 'arrowHeadType',
      newVal: isDirected ? '' : 'arrowclosed'
    })
    _internalDispatchGraph(graph)
  }

  const updateEdgeRs = async (newRs) => {
    const graph = VA.update(state, "EDGE", {
      edge: id,
      prop: 'data',
      newVal: { ...data, rs: newRs, predicates: {} }
    })
    _internalDispatchGraph(graph)

  }

  const updateEdgeCardinality = async (newCardinality) => {
  const graph = VA.update(state, "EDGE", {
    edge: id,
    prop: 'data',
    newVal: { ...data, cardinality: newCardinality, predicates: {} }
  });
  _internalDispatchGraph(graph);
};

  const addPredicate = (attr, color) => {
    const graph = VA.add(state, "PREDICATE", {
      attr,
      vals: ['0', ''],
      parent: id,
      color,
      sourcePos: {x: sourceX, y: sourceY},
      targetPos: {x: targetX, y: targetY}
    })
    _internalDispatchGraph(graph)
  };

  const updatePredicate = (action, parameters) => {
    switch(action) {
      case "modify":
        _internalDispatchGraph(VA.update(state, "PREDICATE", {
          parent: id,
          ...parameters
        }))
        break;
      case "add":
        _internalDispatchGraph(VA.add(state, "PREDICATE", {
          parent: id,
          ...parameters
        }))
        break;
      case "delete":
        _internalDispatchGraph(VA.delete(state, "PREDICATE", {
          parent: id,
          ...parameters
        }))
    }
  }

  const deletePredicate = (attr) => {
    const graph = VA.delete(state, "PREDICATE", {
      parent: id,
      attr,
      deleteAll: true,
    })
    _internalDispatchGraph(graph)
  };

  let availRs = {};
  data.relationships.map(function (rsItem) {
    availRs[rsItem.type] = rsItem.props;
  });


  const preds = () => {
    switch(state.predDisplayStatus) {
      case "FULL" :
        return (
          Object.keys(predicates).map((attr, index) => {
            const circle = {...predicates[attr]}
            const {position} = circle
            delete circle.position

            return (
              <g key={attr} fill={circle.color.secondary}
              stroke="black" strokeWidth="1">
                <circle onClick={
                    (e)=>{
                      e.stopPropagation()
                      setModalVisible(true)
                    }
                  }
                  cx={sourceX < targetX ? sourceX + (1+index) * Math.abs(sourceX-targetX)/(1+Object.keys(predicates).length) :
                    sourceX - (1+index) * Math.abs(sourceX-targetX)/(1+Object.keys(predicates).length)}
                  cy={sourceY < targetY ? sourceY + (1+index) * Math.abs(sourceY-targetY)/(1+Object.keys(predicates).length) :
                    sourceY - (1+index) * Math.abs(sourceY-targetY)/(1+Object.keys(predicates).length) }
                  r={circle.radius} />
                    <Predicate
                      {...circle}
                      position={{x:0, y: 0}}
                    />
              </g>
            )})
        );
      case "SEMI" :
        const x = sourceX < targetX ? sourceX + Math.abs(sourceX-targetX)/2 : sourceX - Math.abs(sourceX-targetX)/2
        const y = sourceY < targetY ? sourceY + Math.abs(sourceY-targetY)/2 : sourceY - Math.abs(sourceY-targetY)/2
        return (
          <g>
                <circle onClick={
                    (e)=>{
                      e.stopPropagation()
                      setModalVisible(true)
                    }
                  }
                  fill={'#ED1C24'}
                  stroke="white"
                  strokeWidth="1"
                  cx={x}
                  cy={y}
                  r={10} />
                <text fill="white" fontSize={13} textAnchor="middle" x={x} y={y + 4}>{Object.keys(predicates).length}</text>
            </g>

        )
      default:
        return (
          <div />
        )
    }
  }

  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2 + 10;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        onClick={(e) => {
          e.stopPropagation()
          setModalVisible(true)
          }
        }
      >

      </path>
      {preds()}
      )

      <text dy="-10px">
        <textPath href={`#${id}`} style={{ fontSize: '1rem' }} startOffset="50%" textAnchor="middle">
          {rs}
        </textPath>
      </text>
      {cardinality && !(cardinality.min === 1 && cardinality.max === 1) && (
        <Tooltip
          title={
            <>
              <div style={{fontWeight: 'bold'}}>Cardinality: {cardinality.min} to {cardinality.max}</div>
              <div style={{marginTop: 4, fontSize: 12, color: '#ffffffff'}}>
                For every {cardinality.min} relationship(s) of <b>{data.source}</b>, there are {cardinality.max} relationships of <b>{data.destination}</b>.
              </div>
            </>
    }
          placement="bottom"
          overlayStyle={{ zIndex: 9999, maxWidth:220 }}
        >
          <g>
            <rect
              x={midX - 18}
              y={midY - 14}
              width={36}
              height={20}
              rx={6}
              fill="#fff"
              stroke="#888"
              strokeWidth={1}
              opacity={0.85}
            />
            <text
              x={midX}
              y={midY}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize="12"
              fontWeight="bold"
              fill="#333"
            >
              {cardinality.min} → {cardinality.max}
            </text>
          </g>
        </Tooltip>
      )}
      <EdgeModal
        source={data.source}
        destination={data.destination}
        isDirected={isDirected}
        toggleDirected={toggleDirected}
        onClose={() => {setModalVisible(false)}}
        allRs={availRs}
        rs={rs}
        cardinality={cardinality}
        visible={id === state.modalVisible}
        updateEdgeRs={updateEdgeRs}
        updateEdgeCardinality={updateEdgeCardinality}
        predicates={predicates}
        addPredicate={addPredicate}
        updatePredicate={updatePredicate}
        deletePredicate={deletePredicate}
        propData={propData}
      />
    </>
  );
}

export default CustomEdge;
