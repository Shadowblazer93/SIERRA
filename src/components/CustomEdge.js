import React, { useContext, useRef, useState, useEffect } from 'react';
import _ from 'lodash'
import { getBezierPath, getMarkerEnd } from 'react-flow-renderer';
import ReactDOM from 'react-dom';
import { Context } from '../Store';
import { BsPencilSquare, BsPlusCircle, BsFillEyeFill } from 'react-icons/bs';
import * as Constants from '../constants';
import Predicate from './Predicate';
import EdgeModal from './EdgeModal';
import CardinalityPropsModal from './CardinalityPropsModal';
import useVisualActions from '../hooks/useVisualActions';
import { Tooltip } from 'antd';
import joinIcon from '../assets/images/join_icon.png';

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
  const [cardinalityModalVisible, setCardinalityModalVisible] = useState(false);

  const edgePath = `M ${sourceX}, ${sourceY}L ${targetX}, ${targetY}`
  const markerEnd = getMarkerEnd(directed === true ? arrowHeadType : '', markerEndId);

  const predicates = data.predicates ?? {}
  const {rs, cardinality, isOptional, cardinalityProps} = data
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

  const updateEdgeCardinalityProps = (newProps) => {
    const graph = VA.update(state, "EDGE", {
      edge: id,
      prop: 'data',
      newVal: { ...data, cardinalityProps: newProps }
    });
    _internalDispatchGraph(graph);
  };

  const updateEdgeIsOptional = async (newIsOptional) => {
    const graph = VA.update(state, "EDGE", {
      edge: id,
      prop: 'data',
      newVal: {...data, isOptional: newIsOptional, predicates: {}}
    });
    _internalDispatchGraph(graph);
  }

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

  const baseWidth = 36;
  const bubbleSpacing = 22;
  const numBubbles = Array.isArray(cardinalityProps) ? cardinalityProps.length : 0;
  const boxWidth = baseWidth + Math.max(0, numBubbles - 1) * bubbleSpacing;

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
        <>
          {/* Cardinality box with its own tooltip and click */}
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
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
            destroyTooltipOnHide
            getPopupContainer={() => document.body}
          >
            <g
              style={{ cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation();
                setCardinalityModalVisible(true);
              }}
            >
              <rect
                x={midX - boxWidth / 2}
                y={midY - 14}
                width={boxWidth}
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
          {/* Render property bubbles as separate elements, overlaid above the box */}
          {Array.isArray(cardinalityProps) && cardinalityProps.map((prop, idx) => (
            <Tooltip
              key={prop.key || idx}
              title={<span><b>{prop.key}</b>{prop.value ? `: ${prop.value}` : ''}</span>}
              placement="bottom"
              overlayStyle={{ zIndex: 9999 }}
            >
              <circle
                cx={midX - (boxWidth / 2) + 18 + idx * bubbleSpacing}
                cy={midY + 10}
                r={7}
                fill={prop.color || '#eee'}
                stroke="#333"
                strokeWidth={1}
                // style={{ cursor: 'pointer', pointerEvents: 'all' }}
              />
            </Tooltip>
          ))}
        </>
      )}
      {isOptional && (
        <Tooltip
          title={
            <>
              <div style={{fontWeight: 'bold'}}>Optional Join</div>
              <div style={{marginTop: 4, fontSize: 12, color: '#ffffffff'}}>
                OPTIONAL MATCH: Get a collection of all nodes connected to <b>{data.source}</b>
              </div>
            </>
          }
          placement="bottom"
          overlayStyle={{ zIndex: 9999, maxWidth: 220 }}
        >
          <g>
            <rect
              x={midX - 18}
              y={midY + 10}
              width={36}
              height={21}
              rx={8}
              fill="#ebbcf3ff"
              stroke="#888"
              strokeWidth={1}
              opacity={0.85}
            />
            <image
              href={joinIcon}
              x={midX - 18}
              y={midY + 9}
              width={36}
              height={20}
              style={{ pointerEvents: 'none' }}
            />
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
        isOptional={isOptional}
        cardinalityProps={cardinalityProps}
        visible={id === state.modalVisible}
        updateEdgeRs={updateEdgeRs}
        updateEdgeCardinality={updateEdgeCardinality}
        updateEdgeIsOptional={updateEdgeIsOptional}
        predicates={predicates}
        addPredicate={addPredicate}
        updatePredicate={updatePredicate}
        deletePredicate={deletePredicate}
        propData={propData}
      />
      <CardinalityPropsModal
        visible={cardinalityModalVisible}
        onClose={() => setCardinalityModalVisible(false)}
        cardinalityProps={cardinalityProps || []}
        onSave={updateEdgeCardinalityProps}
      />
    </>
  );
}

export default CustomEdge;
