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

  const dnfRows = (props.data.dnf || []).filter(r => r.predicates && r.predicates.length > 0);
  const hasPredicates = Object.keys(predicates).length > 0;
  const hasDNF = dnfRows.length > 0;
  const displayRadius = (hasDNF && !hasPredicates) ? props.data.radius + 15 : props.data.radius;

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

  const deleteNode = () => {
    const graph = VA.delete(state, "NODE", {
      id: props.id,
      label: props.data.label,
      el: { id: props.id } // Pass the element object expected by removeElements
    })
    _internalDispatchGraph(graph)
    setShowDetails(false)
  }

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
              nodeRad={displayRadius}
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
    <div style={{ position: 'relative', width: `${displayRadius * 2}px`, height: `${displayRadius * 2}px` }}>
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
          height: `${displayRadius * 2}px`,
          width: `${displayRadius * 2}px`,
          border: props.data.isBold ? '2px solid rgba(47, 47, 47, 0.4)' : '',
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1
        }}
      >
        <Handle type="target" position="left" style={{ zIndex: 100, height: '0.5rem', width: '0.5rem', border: '0px solid black' }} />
        <Handle type="source" position="right" style={{ zIndex: 100, height: '0.5rem', width: '0.5rem', border: '0px solid black' }} />

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
        const r = displayRadius
        const x = displayRadius + r * Math.cos(angle) - 11;
        const y = displayRadius + r * Math.sin(angle) - 11;
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
                width: 16,
                height: 16,
                pointerEvents: 'all',
                zIndex: 30,
                border: isHovered || isLinking ? '2px solid #800080' : '2px solid transparent',
                transition: 'border 0.2s ease',
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
                width: 16,
                height: 16,
                pointerEvents: 'all',
                zIndex: 40,
                border: isHovered || isLinking ? '2px solid #800080' : '2px solid transparent',
                clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                transition: 'border 0.2s ease'
              }}
              isConnectable={true}
              onMouseEnter={() => setHoveredPredicate(attr)}
              onMouseLeave={() => setHoveredPredicate(null)}
            />
          </React.Fragment>
        );
      })}

      {/* DNF Bubbles (Inside Node) */}
      {state.predDisplayStatus === "FULL" && dnfRows.map((row, i, arr) => {
        const total = arr.length;
        const bubbleSize = 17;
        const innerRadius = displayRadius - 16;
        let x, y;

        if (total >= 13) {
          // Regular circle mapping (360 degrees)
          const angleOffset = -Math.PI / 2; // Start from top
          const angle = angleOffset + (i / total) * 2 * Math.PI;
          x = displayRadius + innerRadius * Math.cos(angle) - (bubbleSize / 2);
          y = displayRadius + innerRadius * Math.sin(angle) - (bubbleSize / 2);
        } else {
          // Split layout (Bottom 4, then Top)
          const maxBottom = 4;
          const isBottom = i < maxBottom;
          
          const rowSize = isBottom 
            ? Math.min(total, maxBottom) 
            : total - maxBottom;
            
          const indexInRow = isBottom ? i : i - maxBottom;
          const gap = 3;
          
          // Calculate angles
          // Bottom center : Math.PI/2, Top center : -Math.PI/2
          const centerAngle = isBottom ? Math.PI / 2 : -Math.PI / 2;
          
          const angleStep = (bubbleSize + gap) / innerRadius;
          
          const startAngle = centerAngle - ((rowSize - 1) * angleStep) / 2;
          const angle = startAngle + indexInRow * angleStep;

          x = displayRadius + innerRadius * Math.cos(angle) - (bubbleSize / 2);
          y = displayRadius + innerRadius * Math.sin(angle) - (bubbleSize / 2);
        }
        
        const tooltipContent = row.predicates.map(p => {
           const val = (p.val && typeof p.val === 'object' && 'low' in p.val) ? p.val.low : p.val;
           return `${p.attr} ${p.op} ${val}`;
        }).join(' AND ');

        return (
          <Tooltip key={row.id} title={tooltipContent} placement="top">
            <div
              onClick={(e) => { e.stopPropagation(); setShowDetails(true); }}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: `${bubbleSize}px`,
                height: `${bubbleSize}px`,
                background: 'white',
                borderRadius: '50%',
                border: '1px solid black',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                zIndex: 20,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: '#555',
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '-0.5px'
              }}
            >
              OR
            </div>
          </Tooltip>
        );
      })}

      {/* Modal */}
      <NodePredicateModal
        node={props.data.label}
        nodeId={props.id}
        targets={props.data.possibleTargets}
        attributes={props.data.attributes}
        predicates={predicates}
        dnf={props.data.dnf}
        visible={state.modalVisible === props.id}
        addPredicate={addPredicate}
        deletePredicate={deletePredicate}
        updatePredicate={updatePredicate}
        isJoin={props.data.isJoin}
        setIsJoin={setIsJoin}
        propData={propData}
        currPos={[props.xPos, props.yPos]}
        onClose={() => { setShowDetails(false); }}
        onDeleteNode={deleteNode}
      />
    </div>
  );
}

export default Node;
