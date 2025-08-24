import React, { useContext, useEffect, useRef, useState } from 'react';
import _ from 'lodash'
import ReactDOM from 'react-dom';
import Predicate from './Predicate';
import PredicateCountBubble from './PredicateCountBubble';
import { Handle } from 'react-flow-renderer';
import { Context } from '../Store';
import { BsPencilSquare, BsPlusCircle, BsFillEyeFill } from 'react-icons/bs';
import { addEdge } from 'react-flow-renderer';
import * as Constants from '../constants';
import NodePredicateModal from './NodePredicateModal'
import { set } from 'lodash';
import useVisualActions from '../hooks/useVisualActions'

const api = require('../neo4jApi');

function Node(props) {
  const VA = useVisualActions()
  const [state, dispatch] = useContext(Context);
  const [propData, setPropData] = useState([]);
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
    <>
      <div
        id={'node-' + props.data.label}
        className="node"
        onMouseDown={e => mouseDownCoords(e)}
          onMouseUp={(e) => {
          if(isClick(e)) {
            e.stopPropagation()
            handleClick(e)
          }
        }}
        style={{
          background: props.data.color,
          height: `${props.data.radius * 2}px`,
          width: `${props.data.radius * 2}px`,
          border: props.data.isBold ? '1px solid #2F2F2F' : ''
        }}
      >
        <Handle type="target" position="left" style={{ zIndex: 100, height: '0.6rem', width: '0.6rem' }} />
        <Handle type="source" position="right" style={{ zIndex: 100, height: '0.6rem', width: '0.6rem' }} />
        {preds()}

        <div
          style={{ position: 'relative', top: '50%', transform: 'translateY(-50%)' }}>
          <p className="h6">
            {props.data.label}
          </p>
        </div>
      </div>
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
      propData={propData}
      currPos={[props.xPos, props.yPos]}
      onClose={() => {setShowDetails(false)}} />
    </>
  );
}

export default Node;
