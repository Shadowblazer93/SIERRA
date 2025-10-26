import React, { useContext, useEffect, useRef, useState } from 'react';
import _ from 'lodash'
import ReactDOM from 'react-dom';
import Predicate from './Predicate';
import PredicateCountBubble from './PredicateCountBubble';
import { Handle } from 'react-flow-renderer';
import { Context } from '../Store';
import { BsPencilSquare, BsPlusCircle, BsFillEyeFill } from 'react-icons/bs';
import { addEdge } from 'react-flow-renderer';
import { getNodeId } from '../utils/getNodeId';
import * as Constants from '../constants';
import NodePredicateModal from './NodePredicateModal';
import { set } from 'lodash';
import useVisualActions from '../hooks/useVisualActions';
import { Tooltip } from 'antd';
import joinIcon from '../assets/images/join_icon.png';

const api = require('../neo4jApi');

function Node(props) {
  const VA = useVisualActions()
  const [state, dispatch] = useContext(Context);
  const [propData, setPropData] = useState([]);
  const [hoveredPredicate, setHoveredPredicate] = useState(null);
  const predicates = props.data.predicates ?? {};

  useEffect(async () => {
    const propValues = await api.fetchPropertyValues(props.data.label);
    setPropData(propValues);
  }, []);

  //* for distinguishing drag and click
  const mousePos = useRef(null)
  const mouseDownCoords = (e) => {
    mousePos.current = {x: e.clientX, y: e.clientY}
  }
  const isClick = (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    return (mouseX < mousePos.current.x + 3 && mouseX > mousePos.current.x - 3)
      && (mouseY < mousePos.current.y + 3 && mouseY > mousePos.current.y - 3)
  }

  const _delayedClick = useRef(null)
  const clickedOnce = useRef(null)

  const doClick = (e) => {
    clickedOnce.current = undefined;
    setShowDetails(true)
  }

  const handleClick = (e) => {
    if (!_delayedClick.current) {
      _delayedClick.current = _.debounce(doClick, 300);
    }

    if (clickedOnce.current) {
      _delayedClick.current.cancel();
      clickedOnce.current = false;
      _internalDispatchGraph(VA.return(state, "NODE", {id: props.id, label: props.data.label}))

    } else {
      _delayedClick.current(e);
      clickedOnce.current = true;
    }
  }

  const handlePredicateClick = (attr, circle) => {
    setHoveredPredicate(attr);
    // const thisPredicate = { nodeId: props.id, attr };
    // if (
    //   state.linkingPredicate &&
    //   (state.linkingPredicate.nodeId !== props.id || state.linkingPredicate.attr !== attr)
    // ) {
    //   dispatch({
    //     type: 'ADD_PREDICATE_LINK',
    //     payload: { from: state.linkingPredicate, to: thisPredicate }
    //   });
    // } else {
    //   dispatch({
    //     type: 'SET_LINKING_PREDICATE',
    //     payload: thisPredicate
    //   });
    // }
  };

  const setShowDetails = (bool) => {
    dispatch({
      type:'SET_OPEN_MODAL',
      payload: bool ? props.id : ''
    })
  }

  const _internalDispatchGraph = (graph) => {
    dispatch({
      type: 'SET_GRAPH',
      payload: graph
    })
  }

  const addPredicate = (attr, color) => {
    const graph = VA.add(state, "PREDICATE", {
      attr,
      vals: ['0', ''],
      parent: props.id,
      color,
    })
    _internalDispatchGraph(graph)
  };

  const updatePredicate = (action, parameters) => {
    switch(action) {
      case "modify":
        _internalDispatchGraph(VA.update(state, "PREDICATE", {
          parent: props.id,
          ...parameters
        }))
        break;
      case "add":
        _internalDispatchGraph(VA.add(state, "PREDICATE", {
          parent: props.id,
          ...parameters
        }))
        break;
      case "delete":
        _internalDispatchGraph(VA.delete(state, "PREDICATE", {
          parent: props.id,
          ...parameters
        }))
    }
  }

  const setIsJoin = (newVal) => {
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: props.id, prop: 'isJoin', newVal},
    });
  };

  const deletePredicate = (attr) => {
    const graph = VA.delete(state, "PREDICATE", {
      parent: props.id,
      attr,
      deleteAll: true,
    })
    _internalDispatchGraph(graph)
  };

  const preds = () => {
    switch(state.predDisplayStatus) {
      case "FULL" :
        return (
          Object.keys(predicates).map((attr, index) => {
            const circle = predicates[attr]

            return (
              <Predicate
                key={attr}
                index={index}
                node={props.data.label}
                {...circle}
              />
          )})
        );
      case "SEMI":
        if (Object.keys(predicates).length > 0){
          return (
            <PredicateCountBubble
              node={props.data.label}
              predicates={predicates}
              nodeRad={props.data.radius}
            />
          )
        } else {
          return (<div/>)
        }

      default:
        return(<div />)
    }
  }
  return (
    <div style={{ position: 'relative', width: `${props.data.radius * 2}px`, height: `${props.data.radius * 2}px` }}>
      {/* Node */}
      <div
        id={'node-' + props.data.label}
        className="node"
        onMouseDown={e => mouseDownCoords(e)}
        onMouseUp={e => {
          if (isClick(e)) {
            e.stopPropagation();
            handleClick(e);
          }
        }}
        style={{
          background: props.data.color,
          height: `${props.data.radius * 2}px`,
          width: `${props.data.radius * 2}px`,
          border: props.data.isBold ? '1px solid #2F2F2F' : '',
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1
        }}
      >
        <Handle type="target" position="left" style={{ zIndex: 100, height: '0.6rem', width: '0.6rem' }} />
        <Handle type="source" position="right" style={{ zIndex: 100, height: '0.6rem', width: '0.6rem' }} />

        <div style={{ position: 'relative', top: '50%', transform: 'translateY(-50%)' }}>
          <p className="h6">{props.data.label}</p>
        </div>

        {props.data.isJoin && (
          <Tooltip
            title={
              <>
                <div style={{ fontWeight: 'bold' }}>Optional Join</div>
                <div style={{ marginTop: 4, fontSize: 12, color: '#800080' }}>
                  OPTIONAL MATCH: Get a collection of all nodes connected to <b>{props.data.label}</b>
                </div>
              </>
            }
            placement="bottom"
            overlayStyle={{ zIndex: 9999, maxWidth: 220 }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: `calc(100% + 8px)`,
                transform: 'translateX(-50%)',
                width: '40px',
                height: '25px',
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10,
                borderRadius: '8px',
                background: '#ebbcf3ff',
                border: '1px solid #888',
                opacity: 0.85
              }}
            >
              <img
                src={joinIcon}
                alt="Join Icon"
                style={{
                  height: '22px',
                  top: `calc(100% - 8px)`,
                }}
              />
            </div>
          </Tooltip>
        )}
      </div>

      {/* Predicate circles absolutely positioned on top */}
      {state.predDisplayStatus === "FULL" && Object.keys(predicates).map((attr, index) => {
        const circle = predicates[attr];
        const angleOffset = -Math.PI/8;
        const angle = angleOffset + (index / Object.keys(predicates).length) * 2 * Math.PI;
        const r = props.data.radius
        const x = props.data.radius + r * Math.cos(angle) - 11;
        const y = props.data.radius + r * Math.sin(angle) - 11;
        const isHovered = hoveredPredicate === attr;
        const isLinking = state.linkingPredicate &&
          state.linkingPredicate.nodeId === props.id &&
          state.linkingPredicate.attr === attr;
        return (
          <React.Fragment key={attr}>
            {/* Show label above bubble if hovered */}
            {isHovered && (
              <div
                style={{
                  position: 'absolute',
                  left: x + 11,
                  top: y - 28,
                  transform: 'translateX(-50%)',
                  background: '#fff',
                  color: '#333',
                  padding: '2px 8px',
                  borderRadius: 4,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  fontSize: 13,
                  pointerEvents: 'none',
                  zIndex: 100
                }}
              >
                {attr}
              </div>
            )}
            <Predicate
              index={index}
              node={props.data.label}
              {...circle}
              position={{ x, y }}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                zIndex: 10,
                pointerEvents: 'none',
                cursor: 'pointer',
                border: isHovered || isLinking ? '2px solid #800080' : '0px solid black',
              }}
              onClick={() => handlePredicateClick(attr, circle)}
            />
            <Handle
              type="source"
              position="top"
              id={attr}
              style={{
                left: x+8,
                top: y,
                position: 'absolute',
                background: 'transparent',
                border: 'none',
                width: 16,
                height: 16,
                pointerEvents: 'all',
                zIndex: 30,
                border: isHovered || isLinking ? '2px solid #800080' : '0px solid black',
                clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
              }}
              isConnectable={true}
              onMouseEnter={() => setHoveredPredicate(attr)}
              onMouseLeave={() => setHoveredPredicate(null)}
            />
            <Handle
              type="target"
              position="top"
              id={attr}
              style={{
                left: x+8,
                top: y,
                position: 'absolute',
                background: 'transparent',
                border: 'none',
                width: 16,
                height: 16,
                pointerEvents: 'all',
                zIndex: 40,
                border: isHovered || isLinking ? '2px solid #800080' : '0px solid black',
                clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                transition: 'border 0.2s'
              }}
              isConnectable={true}
              onMouseEnter={() => setHoveredPredicate(attr)}
              onMouseLeave={() => setHoveredPredicate(null)}
            />
          </React.Fragment>
        );
      })}

      {/* Modal */}
      <NodePredicateModal
        node={props.data.label}
        nodeId={props.id}
        targets={props.data.possibleTargets}
        attributes={props.data.attributes}
        predicates={predicates}
        visible={state.modalVisible === props.id}
        addPredicate={addPredicate}
        deletePredicate={deletePredicate}
        updatePredicate={updatePredicate}
        isJoin={props.data.isJoin}
        setIsJoin={setIsJoin}
        propData={propData}
        currPos={[props.xPos, props.yPos]}
        onClose={() => { setShowDetails(false); }}
      />
    </div>
  );
}

export default Node;
