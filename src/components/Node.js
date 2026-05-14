import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import _ from 'lodash'
import ReactDOM from 'react-dom';
import Predicate from './Predicate';
import PredicateCountBubble from './PredicateCountBubble';
import { Handle, useStoreActions } from 'react-flow-renderer';
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
import { buildOrGroupRoots } from '../utils/orGroupRoots';

const api = require('../neo4jApi');

const hexToRgba = (hex, alpha) => {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  const normalized = hex.replace('#', '');
  const parse = (value) => parseInt(value, 16);
  if (normalized.length === 3) {
    const r = parse(normalized[0] + normalized[0]);
    const g = parse(normalized[1] + normalized[1]);
    const b = parse(normalized[2] + normalized[2]);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (normalized.length === 6) {
    const r = parse(normalized.slice(0, 2));
    const g = parse(normalized.slice(2, 4));
    const b = parse(normalized.slice(4, 6));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgba(0, 0, 0, ${alpha})`;
};

const darkenHsl = (hslStr, deltaLightness = 8) => {
  try {
    const m = /hsl\((\d+),\s*(\d+)%\,\s*(\d+)%\)/.exec(hslStr);
    if (!m) return hslStr;
    const h = Number(m[1]);
    const s = Number(m[2]);
    const l = Math.max(0, Number(m[3]) - deltaLightness);
    return `hsl(${h}, ${s}%, ${l}%)`;
  } catch (e) {
    return hslStr;
  }
};

const normalizeAngle = (angle) => {
  let value = angle;
  const twoPi = Math.PI * 2;
  while (value < 0) value += twoPi;
  while (value >= twoPi) value -= twoPi;
  return value;
};

const getArcSpan = (angles) => {
  if (!angles || angles.length === 0) return null;
  if (angles.length === 1) return [angles[0] - 0.15, angles[0] + 0.15];
  const sorted = angles.map(normalizeAngle).sort((a, b) => a - b);
  const twoPi = Math.PI * 2;
  let maxGap = -1;
  let maxGapIndex = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + twoPi : sorted[i + 1];
    const gap = next - current;
    if (gap > maxGap) {
      maxGap = gap;
      maxGapIndex = i;
    }
  }
  const start = sorted[(maxGapIndex + 1) % sorted.length];
  let end = sorted[maxGapIndex];
  if (end < start) end += twoPi;
  return [start, end];
};

const polarToCartesian = (cx, cy, radius, angle) => ({
  x: cx + radius * Math.cos(angle),
  y: cy + radius * Math.sin(angle)
});

const buildArcPath = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

const rotatePoint = (x, y, cx, cy, angleDeg) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return {
    x: cx + dx * Math.cos(angleRad) - dy * Math.sin(angleRad),
    y: cy + dx * Math.sin(angleRad) + dy * Math.cos(angleRad)
  };
};

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const buildRandomAggregationColor = (seed) => {
  const hash = hashString(seed);
  const hue = hash % 360;
  const saturation = 62 + (hash % 18);
  const lightness = 44 + (hash % 16);
  return {
    bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    text: lightness > 56 ? '#1f2937' : '#ffffff'
  };
};

function Node(props) {
  const VA = useVisualActions()
  const [state, dispatch] = useContext(Context);
  const [propData, setPropData] = useState([]);
  const [hoveredPredicate, setHoveredPredicate] = useState(null);
  const [nodeHovered, setNodeHovered] = useState(false);
  const dnfHoverEnterTimeout = useRef(null);
  const dnfHoverLeaveTimeout = useRef(null);
  const dnfHoverActive = useRef(false);
  const nodeRef = useRef(null);
  const updateNodeDimensions = useStoreActions((actions) => actions.updateNodeDimensions);
  const predicates = props.data.predicates ?? {};
  const aggregationEntries = useMemo(() => {
    const rawAggregations = props.data.aggregations;
    if (Array.isArray(rawAggregations)) {
      return rawAggregations.filter((agg) => agg && agg.function);
    }
    if (rawAggregations && typeof rawAggregations === 'object') {
      return Object.entries(rawAggregations)
        .filter(([, fn]) => !!fn)
        .map(([attribute, fn]) => ({ attribute, function: fn }));
    }
    return [];
  }, [props.data.aggregations]);
  const hasAggregations = aggregationEntries.length > 0;

  const formatAggregationLine = (agg) => {
    const fn = (agg.function || 'COUNT').toUpperCase();
    const attribute = agg.attribute || '*';
    const base = `${fn}(${attribute})`;
    if (!agg.hasCondition) return base;

    const conditionParts = [];
    if (agg.alias) conditionParts.push(agg.alias);
    if (agg.operator) conditionParts.push(agg.operator);
    if (agg.value !== undefined && agg.value !== null && `${agg.value}`.trim() !== '') {
      conditionParts.push(`${agg.value}`);
    }
    return conditionParts.length > 0 ? `${base} | ${conditionParts.join(' ')}` : base;
  };

  const dnfRows = (props.data.dnf || []).filter(r => r.predicates && r.predicates.length > 0);
  const hasPredicates = Object.keys(predicates).length > 0;
  const hasDNF = dnfRows.length > 0;
  const displayRadius = (hasDNF && !hasPredicates) ? props.data.radius + 15 : props.data.radius;
  const nodeOpacity = (state.dnfLinksVisible && state.dnfMode && !state.dnfHovering && props.data.dnfParticipates) ? 0.65 : 1;
  // Separate simple aggregations from pipeline aggregations
  const simpleAggregations = useMemo(() => {
    return aggregationEntries.filter(agg => !agg.hasCondition);
  }, [aggregationEntries]);

  const pipelineAggregations = useMemo(() => {
    return aggregationEntries.filter(agg => agg.hasCondition);
  }, [aggregationEntries]);

  const aggregationBubbles = useMemo(() => {
    if (simpleAggregations.length === 0) return [];

    const total = simpleAggregations.length;
    const bubbleSize = total >= 10 ? 9 : (total >= 6 ? 10 : 11);
    const ringRadius = hasDNF ? Math.max(12, displayRadius - 38) : Math.max(14, displayRadius - 14);
    const startAngle = -Math.PI / 2;
    const pixelGap = 2;
    const baseStep = (bubbleSize + pixelGap) / Math.max(ringRadius, 1);
    const maxSpan = Math.PI * 2 - baseStep;
    const requestedSpan = baseStep * Math.max(total - 1, 0);
    const packedStep = total > 1
      ? (requestedSpan > maxSpan ? maxSpan / (total - 1) : baseStep)
      : 0;

    return simpleAggregations.map((agg, index) => {
      const angle = startAngle + index * packedStep;

      const centerX = displayRadius + ringRadius * Math.cos(angle);
      const centerY = displayRadius + ringRadius * Math.sin(angle);
      const seed = `${props.id}|${index}|${agg.function || ''}|${agg.attribute || ''}|${agg.alias || ''}|${agg.operator || ''}|${agg.value || ''}`;
      const color = buildRandomAggregationColor(seed);

      return {
        key: `agg-bubble-${props.id}-${index}`,
        agg,
        index,
        x: centerX - bubbleSize / 2,
        y: centerY - bubbleSize / 2,
        size: bubbleSize,
        color
      };
    });
  }, [simpleAggregations, displayRadius, hasDNF, props.id]);

  // Pipeline aggregations positioned like predicate bubbles
  const pipelineAggregationBubbles = useMemo(() => {
    if (pipelineAggregations.length === 0) return [];

    const predicateCount = Object.keys(predicates).length;
    const totalCount = predicateCount + pipelineAggregations.length;

    if (totalCount === 0) return [];

    const bubbleRadius = 8;
    const angleOffset = -Math.PI / 8;

    return pipelineAggregations.map((agg, aggIndex) => {
      const index = predicateCount + aggIndex;
      const angle = angleOffset + (index / totalCount) * 2 * Math.PI;
      const centerX = displayRadius + displayRadius * Math.cos(angle);
      const centerY = displayRadius + displayRadius * Math.sin(angle);

      const seed = `${props.id}|${aggIndex}|${agg.function || ''}|${agg.attribute || ''}|${agg.alias || ''}|${agg.operator || ''}|${agg.value || ''}`;
      const color = buildRandomAggregationColor(seed);

      return {
        key: `pipeline-agg-bubble-${props.id}-${aggIndex}`,
        agg,
        index: aggIndex,
        centerX,
        centerY,
        radius: bubbleRadius,
        angle,
        color
      };
    });
  }, [pipelineAggregations, predicates, displayRadius, props.id]);

  const orGroupRoots = useMemo(() => {
    if (props.data?.orGroupRoots && typeof props.data.orGroupRoots === 'object') {
      return props.data.orGroupRoots;
    }
    return buildOrGroupRoots(state.nodes, state.orLinks);
  }, [props.data?.orGroupRoots, state.nodes, state.orLinks]);

  const predicateKeySignature = useMemo(() => {
    return Object.keys(predicates).sort().join('|');
  }, [predicates]);

  const orGroupsByNode = useMemo(() => {
    const groups = {};
    Object.keys(predicates).forEach((attr) => {
      const key = `${props.id}_${attr}`;
      const groupId = orGroupRoots[key];
      if (!groupId) return;
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(attr);
    });
    return groups;
  }, [predicates, props.id, orGroupRoots, predicateKeySignature]);

  const getOrGroupIdForAttr = (attr) => {
    const key = `${props.id}_${attr}`;
    return orGroupRoots[key];
  };

  const andGroupsByNode = useMemo(() => {
    if (!state.dnfMode || !state.dnfAndGroupingEnabled) return [];
    const groups = {};
    (state.andLinks || []).forEach((link) => {
      const addAttr = (nodeId, attr) => {
        if (String(nodeId) !== String(props.id)) return;
        if (!predicates[attr]) return;
        if (!groups[link.groupId]) {
          groups[link.groupId] = { groupId: link.groupId, color: link.color, attrs: new Set() };
        }
        groups[link.groupId].attrs.add(attr);
      };
      addAttr(link.from.nodeId, link.from.attr);
      addAttr(link.to.nodeId, link.to.attr);
    });
    return Object.values(groups)
      .map((group) => ({
        groupId: group.groupId,
        color: group.color,
        attrs: Array.from(group.attrs)
      }))
      .filter((group) => group.attrs.length > 1);
  }, [state.andLinks, state.dnfMode, state.dnfAndGroupingEnabled, props.id, predicateKeySignature, predicates]);

  const orGroupSignature = useMemo(() => {
    return Object.keys(orGroupsByNode)
      .sort()
      .map((groupId) => `${groupId}:${(orGroupsByNode[groupId] || []).slice().sort().join(',')}`)
      .join('|');
  }, [orGroupsByNode]);

  const andGroupSignature = useMemo(() => {
    return andGroupsByNode
      .map((group) => `${group.groupId}:${(group.attrs || []).slice().sort().join(',')}:${group.color || ''}`)
      .sort()
      .join('|');
  }, [andGroupsByNode]);

  useEffect(() => {
    if (!nodeRef.current) return;
    updateNodeDimensions([
      {
        id: props.id,
        nodeElement: nodeRef.current,
        forceUpdate: true
      }
    ]);
  }, [updateNodeDimensions, props.id, predicateKeySignature, orGroupSignature, andGroupSignature, displayRadius]);

  useEffect(async () => {
    const propValues = await api.fetchPropertyValues(props.data.label);
    setPropData(propValues);
  }, []);

  useEffect(() => {
    return () => {
      if (dnfHoverEnterTimeout.current) {
        clearTimeout(dnfHoverEnterTimeout.current);
      }
      if (dnfHoverLeaveTimeout.current) {
        clearTimeout(dnfHoverLeaveTimeout.current);
      }
      if (dnfHoverActive.current) {
        dnfHoverActive.current = false;
        dispatch({ type: 'DNF_HOVER_END' });
      }
    };
  }, [dispatch]);

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

  const maybeOpenOrGroup = (event, attr) => {
    const groupId = getOrGroupIdForAttr(attr);
    if (!groupId) return false;
    const groupAttrs = orGroupsByNode[groupId] || [];
    if (groupAttrs.length < 2) return false;
    if (props.data?.onOrGroupOpen) {
      props.data.onOrGroupOpen(event, groupId);
      return true;
    }
    return false;
  };

  const maybeHoverOrGroup = (event, attr, action) => {
    const groupId = getOrGroupIdForAttr(attr);
    if (!groupId) return;
    const groupAttrs = orGroupsByNode[groupId] || [];
    if (groupAttrs.length < 2) return;
    if (action === 'start' && props.data?.onOrGroupHoverStart) {
      props.data.onOrGroupHoverStart(groupId);
    }
    if (action === 'end' && props.data?.onOrGroupHoverEnd) {
      props.data.onOrGroupHoverEnd(groupId);
    }
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

  const scheduleDnfHoverStart = () => {
    if (!state.dnfLinksVisible) return;
    if (!state.dnfMode || !props.data.dnfParticipates) return;
    if (dnfHoverActive.current) return;
    if (dnfHoverLeaveTimeout.current) {
      clearTimeout(dnfHoverLeaveTimeout.current);
    }
    if (dnfHoverEnterTimeout.current) {
      clearTimeout(dnfHoverEnterTimeout.current);
    }
    dnfHoverActive.current = true;
    dispatch({ type: 'DNF_HOVER_START' });
  };

  const scheduleDnfHoverEnd = () => {
    if (!state.dnfLinksVisible) return;
    if (!state.dnfMode || !props.data.dnfParticipates) return;
    if (!dnfHoverActive.current) return;
    if (dnfHoverEnterTimeout.current) {
      clearTimeout(dnfHoverEnterTimeout.current);
    }
    if (dnfHoverLeaveTimeout.current) {
      clearTimeout(dnfHoverLeaveTimeout.current);
    }
    dnfHoverLeaveTimeout.current = setTimeout(() => {
      dnfHoverActive.current = false;
      dispatch({ type: 'DNF_HOVER_END' });
    }, 2000);
  };
  return (
    <div
      ref={nodeRef}
      data-id={props.id}
      style={{ position: 'relative', width: `${displayRadius * 2}px`, height: `${displayRadius * 2}px`, cursor: 'pointer' }}
    >
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
        onMouseEnter={() => {
          setNodeHovered(true);
          scheduleDnfHoverStart();
        }}
        onMouseLeave={() => {
          setNodeHovered(false);
          scheduleDnfHoverEnd();
        }}
        style={{
          background: props.data.color,
          height: `${displayRadius * 2}px`,
          width: `${displayRadius * 2}px`,
          border: props.data.isBold ? '2px solid rgba(47, 47, 47, 0.4)' : '',
          opacity: nodeOpacity,
          transition: 'opacity 320ms ease',
          position: 'absolute',
          left: 0,
          top: 0,
          zIndex: 1,
          cursor: 'pointer'
        }}
      >
        <Handle type="target" position="left" style={{ zIndex: 100, height: '0.5rem', width: '0.5rem', border: '0px solid black' }} />
        <Handle type="source" position="right" style={{ zIndex: 100, height: '0.5rem', width: '0.5rem', border: '0px solid black' }} />

        <div style={{ position: 'relative', top: '50%', transform: 'translateY(-50%)' }}>
          <p className="h6" style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
            margin: 0, width: 'max-content', pointerEvents: 'none',
            opacity: nodeHovered ? 0 : 1, transition: 'opacity 0.2s ease'
          }}>
            {props.data.label}
          </p>
          <p className="h6" style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translate(-50%, -50%)',
            margin: 0, width: 'max-content', pointerEvents: 'none',
            opacity: nodeHovered ? 1 : 0, transition: 'opacity 0.2s ease', color: '#5c5c5c'
          }}>
            {props.data.rep || (parseInt(props.id) + 10).toString(36)}
          </p>
        </div>

        {aggregationBubbles.map((bubble) => (
          <Tooltip
            key={bubble.key}
            title={
              <div style={{ maxWidth: 280 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  Aggregation {bubble.index + 1}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                  {formatAggregationLine(bubble.agg)}
                </div>
              </div>
            }
            placement="top"
            overlayStyle={{ zIndex: 9999, maxWidth: 300 }}
            mouseEnterDelay={0}
            mouseLeaveDelay={0.05}
            destroyTooltipOnHide
            getPopupContainer={() => document.body}
          >
            <div
              onMouseDown={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              style={{
                position: 'absolute',
                left: bubble.x,
                top: bubble.y,
                width: bubble.size,
                height: bubble.size,
                borderRadius: '50%',
                border: '1px solid rgba(0,0,0,0.5)',
                background: bubble.color.bg,
                color: bubble.color.text,
                fontSize: 7,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.28)',
                cursor: 'help',
                zIndex: 30,
                lineHeight: 1
              }}
            >
              {bubble.index + 1}
            </div>
          </Tooltip>
        ))}

        {/* Pipeline Aggregation Bubbles - displayed as predicate-style bubbles */}
        {pipelineAggregationBubbles.map((bubble) => {
          const bubbleX = bubble.centerX - bubble.radius;
          const bubbleY = bubble.centerY - bubble.radius;
          const bubbleSize = bubble.radius * 2;

          return (
            <Tooltip
              key={bubble.key}
              title={
                <div style={{ maxWidth: 280 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    Pipeline Aggregation
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    {formatAggregationLine(bubble.agg)}
                  </div>
                </div>
              }
              placement="top"
              overlayStyle={{ zIndex: 9999, maxWidth: 300 }}
              mouseEnterDelay={0}
              mouseLeaveDelay={0.05}
              destroyTooltipOnHide
              getPopupContainer={() => document.body}
            >
              <div
                onMouseDown={(event) => event.stopPropagation()}
                onMouseUp={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: bubbleX,
                  top: bubbleY,
                  width: bubbleSize,
                  height: bubbleSize,
                  borderRadius: '50%',
                  border: '1px solid rgba(0,0,0,0.3)',
                  background: bubble.color.bg,
                  color: bubble.color.text,
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  cursor: 'pointer',
                  zIndex: 25,
                  pointerEvents: 'all',
                  lineHeight: 1
                }}
                >
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: Math.round(bubbleSize * 0.65) + 'px',
                    height: Math.round(bubbleSize * 0.65) + 'px',
                    borderRadius: '50%',
                    background: darkenHsl(bubble.color.bg, 10),
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none'
                  }}
                />
              </div>
            </Tooltip>
          );
        })}

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
      {state.predDisplayStatus === "FULL" && (() => {
        const predicateKeys = Object.keys(predicates);
        const predicateCount = predicateKeys.length;
        const pipelineAggCount = pipelineAggregations.length;
        const totalBubbleCount = predicateCount + pipelineAggCount;
        
        if (totalBubbleCount === 0) return null;

        const maxRadius = Math.max(...predicateKeys.map((attr) => predicates[attr]?.radius ?? 8));

        const anchorByAttr = {};
        const angleOffset = -Math.PI / 8;
        predicateKeys.forEach((attr, index) => {
          const angle = angleOffset + (index / totalBubbleCount) * 2 * Math.PI;
          const centerX = displayRadius + displayRadius * Math.cos(angle);
          const centerY = displayRadius + displayRadius * Math.sin(angle);
          anchorByAttr[attr] = { centerX, centerY, index, angle };
        });

        const predicateLayout = {};
        const predicateLayoutsByAttr = {};
        predicateKeys.forEach((attr) => {
          const circle = predicates[attr];
          const baseRadius = circle?.radius ?? 8;
          const { centerX, centerY, angle } = anchorByAttr[attr];
          const baseLayout = { radius: baseRadius, centerX, centerY, angle };
          predicateLayout[attr] = baseLayout;
          predicateLayoutsByAttr[attr] = [baseLayout];
        });

        const orRepresentation = state.orRepresentation || 'sunflower';
        const orGroupVisualMeta = {};
        const groupLayoutsById = {};

        Object.keys(orGroupsByNode).forEach((groupId) => {
          const attrs = orGroupsByNode[groupId];
          if (attrs.length < 2) return;

          const ordered = attrs.slice().sort((a, b) => anchorByAttr[a].index - anchorByAttr[b].index);

          if (orRepresentation === 'sunflower') {
            const radii = ordered.map((attr) => predicates[attr]?.radius ?? 8);
            const baseRadius = Math.max(...radii);
            const directionVector = ordered.reduce((acc, attr) => {
              const angle = anchorByAttr[attr]?.angle ?? 0;
              return {
                x: acc.x + Math.cos(angle),
                y: acc.y + Math.sin(angle)
              };
            }, { x: 0, y: 0 });
            let angle = Math.atan2(directionVector.y, directionVector.x);
            if (!Number.isFinite(angle)) {
              angle = anchorByAttr[ordered[0]]?.angle ?? -Math.PI / 2;
            }

            const step = Math.max(8, Math.round(baseRadius * 1.08));
            const overlap = Math.max(4, Math.round(baseRadius * 0.35));
            const startDistance = displayRadius + baseRadius - overlap;
            const groupLayouts = [];

            ordered.forEach((attr, idx) => {
              const radius = predicates[attr]?.radius ?? baseRadius;
              const distance = startDistance + idx * step;
              const layout = {
                radius,
                centerX: displayRadius + distance * Math.cos(angle),
                centerY: displayRadius + distance * Math.sin(angle),
                angle
              };
              groupLayouts.push(layout);
              predicateLayout[attr] = layout;
              predicateLayoutsByAttr[attr] = [layout];
            });

            const tipLayout = groupLayouts[groupLayouts.length - 1];
            const tipRadius = tipLayout?.radius ?? baseRadius;
            const tipAngle = tipLayout?.angle ?? angle;
            const labelAnchor = tipLayout
              ? {
                  x: tipLayout.centerX + Math.cos(tipAngle) * (tipRadius + 14),
                  y: tipLayout.centerY + Math.sin(tipAngle) * (tipRadius + 14)
                }
              : { x: displayRadius, y: displayRadius };

            orGroupVisualMeta[groupId] = {
              attrs: ordered,
              centerX: displayRadius,
              centerY: displayRadius,
              outerRadius: tipLayout ? Math.hypot(tipLayout.centerX - displayRadius, tipLayout.centerY - displayRadius) + tipRadius : baseRadius,
              angle,
              labelAnchor,
              tipLayout
            };
            groupLayoutsById[groupId] = groupLayouts;
            return;
          }

          const baseRadius = Math.max(...ordered.map((attr) => predicates[attr]?.radius ?? 8));
          const gap = 4;
          const anchorAttr = ordered[0];
          const { centerX, centerY } = anchorByAttr[anchorAttr];
          const outerRadius = baseRadius + (ordered.length - 1) * gap;
          ordered.forEach((attr, idx) => {
            const anchorPos = anchorByAttr[attr];
            const angle = (anchorPos.centerX === centerX && anchorPos.centerY === centerY)
              ? anchorPos.angle
              : Math.atan2(anchorPos.centerY - centerY, anchorPos.centerX - centerX);
            const layout = { radius: baseRadius + idx * gap, centerX, centerY, angle };
            predicateLayout[attr] = layout;
            predicateLayoutsByAttr[attr] = [layout];
          });
          orGroupVisualMeta[groupId] = {
            attrs: ordered,
            centerX,
            centerY,
            outerRadius
          };
          groupLayoutsById[groupId] = ordered.map((attr) => predicateLayout[attr]).filter(Boolean);
        });

        if (andGroupsByNode.length > 0) {
          const primaryLayoutByAttr = {};
          andGroupsByNode.forEach((group) => {
            const groupLayouts = [];
            const ordered = group.attrs.slice().sort((a, b) => anchorByAttr[a].index - anchorByAttr[b].index);
            const baseRadius = Math.max(...ordered.map((attr) => predicates[attr]?.radius ?? 8));
            const meanVector = ordered.reduce(
              (acc, attr) => {
                const angle = anchorByAttr[attr].angle;
                return {
                  x: acc.x + Math.cos(angle),
                  y: acc.y + Math.sin(angle)
                };
              },
              { x: 0, y: 0 }
            );
            const meanAngle = Math.atan2(meanVector.y, meanVector.x);
            const arcStep = (baseRadius * 2 + 6) / Math.max(displayRadius, 1);
            ordered.forEach((attr, idx) => {
              const offsetIndex = idx - (ordered.length - 1) / 2;
              const angle = meanAngle + offsetIndex * arcStep;
              const layout = {
                radius: baseRadius,
                centerX: displayRadius + displayRadius * Math.cos(angle),
                centerY: displayRadius + displayRadius * Math.sin(angle),
                angle
              };
              groupLayouts.push(layout);
              if (!primaryLayoutByAttr[attr]) {
                primaryLayoutByAttr[attr] = layout;
                predicateLayout[attr] = layout;
                predicateLayoutsByAttr[attr] = [layout];
              } else {
                predicateLayoutsByAttr[attr].push(layout);
              }
            });
            groupLayoutsById[group.groupId] = groupLayouts;
          });
        }

        const duplicateNumberByAttr = {};
        let duplicateCounter = 1;
        predicateKeys.forEach((attr) => {
          if ((predicateLayoutsByAttr[attr] || []).length > 1) {
            duplicateNumberByAttr[attr] = duplicateCounter;
            duplicateCounter += 1;
          }
        });

        const andHalos = andGroupsByNode
          .map((group) => {
            const layouts = (groupLayoutsById[group.groupId] || []).filter(Boolean);
            if (layouts.length < 2) return null;
            const angles = layouts.map((layout) => layout.angle).filter((angle) => typeof angle === 'number');
            const span = getArcSpan(angles);
            if (!span) return null;
            const maxRadius = Math.max(...layouts.map((layout) => layout.radius || 8));
            const haloGap = 2;
            const padAngle = Math.max(0.06, (maxRadius + haloGap) / Math.max(displayRadius, 1));
            const startAngle = span[0] - padAngle;
            const endAngle = span[1] + padAngle;
            const strokeWidth = Math.max(10, maxRadius * 2 + haloGap * 2);
            return {
              key: `and-halo-${group.groupId}`,
              color: group.color || '#1f8a5b',
              startAngle,
              endAngle,
              radius: displayRadius,
              strokeWidth
            };
          })
          .filter(Boolean);

        const haloPadding = andHalos.length > 0
          ? Math.max(...andHalos.map((halo) => halo.strokeWidth / 2)) + 8
          : 0;

        const getLoopGeometry = (groupMeta) => {
          // User-tunable values for the OR inter-join U-shape.
          const loopWidthMultiplier = 1.65;
          const loopDepthMultiplier = 1.45;
          const loopMinWidth = 18;
          const loopMinDepth = 14;
          const loopGap = -6;

          const loopWidth = Math.max(groupMeta.outerRadius * loopWidthMultiplier, loopMinWidth);
          const loopDepth = Math.max(groupMeta.outerRadius * loopDepthMultiplier, loopMinDepth);
          const startX = groupMeta.centerX - loopWidth / 2;
          const startY = groupMeta.centerY + groupMeta.outerRadius + loopGap;
          const endX = groupMeta.centerX + loopWidth / 2;
          const controlY = startY + loopDepth;
          const groupAngle = Math.atan2(groupMeta.centerY - displayRadius, groupMeta.centerX - displayRadius);
          const rotateDeg = (groupAngle * 180) / Math.PI + 270;
          const labelAnchor = rotatePoint(
            groupMeta.centerX,
            startY + loopDepth + 8,
            groupMeta.centerX,
            groupMeta.centerY,
            rotateDeg
          );

          return {
            path: `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${startY}`,
            transform: `rotate(${rotateDeg} ${groupMeta.centerX} ${groupMeta.centerY})`,
            labelAnchor
          };
        };

        const interJoinLoops = orRepresentation === 'sunflower'
          ? Object.keys(orGroupVisualMeta)
            .flatMap((groupId) => {
              const groupMeta = orGroupVisualMeta[groupId];
              if (!groupMeta || !groupMeta.attrs || groupMeta.attrs.length < 2) return [];
              const attrsInGroup = new Set(groupMeta.attrs);
              return (state.predicateLinks || [])
                .map((link) => {
                  const sameNodeFrom = String(link.from.nodeId) === String(props.id);
                  const sameNodeTo = String(link.to.nodeId) === String(props.id);
                  if (!sameNodeFrom || !sameNodeTo) return null;
                  if (!attrsInGroup.has(link.from.attr) || !attrsInGroup.has(link.to.attr)) return null;
                  if (link.from.attr === link.to.attr) return null;
                  const fromLayout = predicateLayout[link.from.attr];
                  const toLayout = predicateLayout[link.to.attr];
                  if (!fromLayout || !toLayout) return null;
                  return {
                    key: `or-group-interjoin-${groupId}-${link.from.attr}-${link.to.attr}`,
                    path: `M ${fromLayout.centerX} ${fromLayout.centerY} L ${toLayout.centerX} ${toLayout.centerY}`,
                    transform: null,
                    sunflower: true
                  };
                })
                .filter(Boolean);
            })
          : Object.keys(orGroupVisualMeta)
            .map((groupId) => {
              const groupMeta = orGroupVisualMeta[groupId];
              if (!groupMeta || !groupMeta.attrs || groupMeta.attrs.length < 2) return null;

              const attrsInGroup = new Set(groupMeta.attrs);
              const hasInterJoin = (state.predicateLinks || []).some((link) => {
                const sameNodeFrom = String(link.from.nodeId) === String(props.id);
                const sameNodeTo = String(link.to.nodeId) === String(props.id);
                if (!sameNodeFrom || !sameNodeTo) return false;
                if (!attrsInGroup.has(link.from.attr) || !attrsInGroup.has(link.to.attr)) return false;
                return link.from.attr !== link.to.attr;
              });

              if (!hasInterJoin) return null;
              const loopGeometry = getLoopGeometry(groupMeta);

              return {
                key: `or-group-interjoin-${groupId}`,
                path: loopGeometry.path,
                transform: loopGeometry.transform,
                sunflower: false
              };
            })
            .filter(Boolean);

        const orGroupBadges = Object.keys(orGroupVisualMeta)
          .map((groupId) => {
            const groupMeta = orGroupVisualMeta[groupId];
            if (!groupMeta || !groupMeta.attrs || groupMeta.attrs.length < 2) return null;
            const labelAnchor = orRepresentation === 'sunflower' && groupMeta.labelAnchor
              ? groupMeta.labelAnchor
              : getLoopGeometry(groupMeta).labelAnchor;
            return {
              key: `or-group-badge-${groupId}`,
              groupId,
              labelX: labelAnchor.x,
              labelY: labelAnchor.y,
              showLabel: props.data?.hoveredOrGroupId === groupId
            };
          })
          .filter(Boolean);

        return (
          <React.Fragment>
            {andHalos.length > 0 && (
              <svg
                width={displayRadius * 2 + haloPadding * 2}
                height={displayRadius * 2 + haloPadding * 2}
                viewBox={`${-haloPadding} ${-haloPadding} ${displayRadius * 2 + haloPadding * 2} ${displayRadius * 2 + haloPadding * 2}`}
                style={{
                  position: 'absolute',
                  left: -haloPadding,
                  top: -haloPadding,
                  zIndex: 5,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                {andHalos.map((halo) => (
                  <path
                    key={halo.key}
                    d={buildArcPath(displayRadius, displayRadius, halo.radius, halo.startAngle, halo.endAngle)}
                    stroke={hexToRgba(halo.color, 0.35)}
                    strokeWidth={halo.strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {andHalos.map((halo) => (
                  <path
                    key={`${halo.key}-outline`}
                    d={buildArcPath(displayRadius, displayRadius, halo.radius, halo.startAngle, halo.endAngle)}
                    stroke={halo.color}
                    strokeWidth={Math.max(2, halo.strokeWidth * 0.15)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
              </svg>
            )}
            {interJoinLoops.length > 0 && (
              <svg
                width={displayRadius * 2}
                height={displayRadius * 2}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  zIndex: -1,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                {interJoinLoops.map((loop) => (
                  <path
                    key={`${loop.key}-shadow`}
                    d={loop.path}
                    transform={loop.transform}
                    stroke={hexToRgba('#8d3f8d', 0.25)}
                    strokeWidth={6}
                    strokeLinecap="round"
                    fill="none"
                  />
                ))}
                {interJoinLoops.map((loop) => (
                  <path
                    key={loop.key}
                    d={loop.path}
                    transform={loop.transform}
                    stroke="#8d3f8d"
                    strokeWidth={3}
                    strokeLinecap="round"
                    fill="none"
                  />
                ))}
              </svg>
            )}
            {orGroupBadges.length > 0 && (
              <svg
                width={displayRadius * 2}
                height={displayRadius * 2}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  zIndex: 35,
                  pointerEvents: 'none',
                  overflow: 'visible'
                }}
              >
                {orGroupBadges.map((loop) => (
                  <foreignObject
                    key={`${loop.key}-label`}
                    width={30}
                    height={24}
                    x={loop.labelX - 15}
                    y={loop.labelY - 12}
                    requiredExtensions="http://www.w3.org/1999/xhtml"
                    style={{
                      overflow: 'visible',
                      pointerEvents: loop.showLabel ? 'all' : 'none',
                      opacity: loop.showLabel ? 1 : 0,
                      transition: 'opacity 180ms ease'
                    }}
                  >
                    <div
                      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}
                      onMouseEnter={() => {
                        if (props.data?.onOrGroupHoverStart) {
                          props.data.onOrGroupHoverStart(loop.groupId);
                        }
                      }}
                      onMouseLeave={() => {
                        if (props.data?.onOrGroupHoverEnd) {
                          props.data.onOrGroupHoverEnd(loop.groupId);
                        }
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 18,
                          borderRadius: 6,
                          background: 'white',
                          border: '2px solid #8d3f8d',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          color: '#8d3f8d',
                          fontWeight: 800,
                          fontSize: 10,
                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                          cursor: 'pointer'
                        }}
                        onClick={(event) => {
                          if (props.data?.onOrGroupOpen) {
                            props.data.onOrGroupOpen(event, loop.groupId);
                          }
                        }}
                      >
                        OR
                      </div>
                    </div>
                  </foreignObject>
                ))}
              </svg>
            )}
            {predicateKeys.flatMap((attr, index) => {
              const circle = predicates[attr];
              const layouts = predicateLayoutsByAttr[attr] || [predicateLayout[attr]];
              const duplicateNumber = duplicateNumberByAttr[attr];
              return layouts.map((layout, layoutIndex) => {
                const predRadius = layout.radius;
                const centerX = layout.centerX;
                const centerY = layout.centerY;
                const x = centerX - predRadius;
                const y = centerY - predRadius;
                const bubbleZ = 20 + (maxRadius - predRadius);
                const isPrimary = layoutIndex === 0;
                const isHovered = hoveredPredicate === attr && isPrimary;
                const isLinking = isPrimary && state.linkingPredicate &&
                  state.linkingPredicate.nodeId === props.id &&
                  state.linkingPredicate.attr === attr;
                const isLinkingOR = isPrimary && state.linkingOR &&
                  state.linkingOR.nodeId === props.id &&
                  state.linkingOR.attr === attr;
                const hasJoinLink = isPrimary && (state.predicateLinks || []).some((link) =>
                  (String(link.from.nodeId) === String(props.id) && link.from.attr === attr) ||
                  (String(link.to.nodeId) === String(props.id) && link.to.attr === attr)
                );
                const bubbleBorder = isHovered || isLinking
                  ? '2px solid #800080'
                  : (hasJoinLink ? '2px solid #8d3f8d' : (isLinkingOR ? '2px dashed #ff8c00' : '1px solid #111'));
                const handleBorder = isHovered || isLinking
                  ? '4px solid rgba(255, 255, 255, 0.4)'
                  : (isLinkingOR ? '2px dashed #ff8c00' : '2px solid transparent');
                const handleSize = predRadius * 2;
                const indicatorSize = Math.max(5, Math.round(predRadius * 0.35));
                const showDuplicateBadge = typeof duplicateNumber === 'number';
                return (
                  <React.Fragment key={`${attr}-${layoutIndex}`}>
                    {/* Show label above bubble if hovered */}
                    {isHovered && (
                      <div
                        style={{
                          position: 'absolute',
                          left: centerX,
                          top: centerY - predRadius - 30,
                          transform: 'translateX(-50%)',
                          background: '#fff',
                          color: '#333',
                          padding: '2px 8px',
                          borderRadius: 4,
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                          fontSize: 10,
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
                      radius={predRadius}
                      position={{ x, y }}
                      style={{
                        position: 'absolute',
                        left: x,
                        top: y,
                        zIndex: bubbleZ,
                        cursor: isPrimary ? 'pointer' : 'default',
                        border: bubbleBorder,
                        pointerEvents: 'all'
                      }}
                      title={attr}
                      onMouseEnter={() => {
                        setHoveredPredicate(attr);
                        scheduleDnfHoverStart();
                        maybeHoverOrGroup(null, attr, 'start');
                      }}
                      onMouseLeave={() => {
                        setHoveredPredicate(null);
                        scheduleDnfHoverEnd();
                        maybeHoverOrGroup(null, attr, 'end');
                      }}
                      onClick={isPrimary ? (event) => {
                        if (!maybeOpenOrGroup(event, attr)) {
                          handlePredicateClick(attr, circle);
                        }
                      } : undefined}
                    />
                    {showDuplicateBadge && (
                      <div
                        style={{
                          position: 'absolute',
                          left: centerX + predRadius * 0.2,
                          top: centerY + predRadius * 0.2,
                          minWidth: 10,
                          height: 10,
                          padding: '0 2px',
                          borderRadius: 6,
                          background: '#111',
                          color: '#fff',
                          fontSize: 7,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: bubbleZ + 4,
                          pointerEvents: 'none'
                        }}
                      >
                        {duplicateNumber}
                      </div>
                    )}
                    {hasJoinLink && (
                      <div
                        style={{
                          position: 'absolute',
                          left: centerX + predRadius * 0.65,
                          top: centerY - predRadius * 0.65,
                          width: indicatorSize,
                          height: indicatorSize,
                          borderRadius: '50%',
                          background: '#8d3f8d',
                          border: '2px solid #fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                          zIndex: bubbleZ + 3,
                          pointerEvents: 'none'
                        }}
                      />
                    )}
                    <Handle
                      type="source"
                      position="top"
                      id={attr}
                      style={{
                        left: centerX,
                        top: centerY,
                        position: 'absolute',
                        background: 'transparent',
                        width: handleSize,
                        height: handleSize,
                        pointerEvents: 'all',
                        zIndex: bubbleZ + 1,
                        border: handleBorder,
                        transition: 'border 0.2s ease',
                        clipPath: 'polygon(0 50%, 100% 50%, 100% 100%, 0 100%)',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%'
                      }}
                      isConnectable={true}
                      onMouseEnter={() => {
                        setHoveredPredicate(attr);
                        scheduleDnfHoverStart();
                        maybeHoverOrGroup(null, attr, 'start');
                      }}
                      onMouseLeave={() => {
                        setHoveredPredicate(null);
                        scheduleDnfHoverEnd();
                        maybeHoverOrGroup(null, attr, 'end');
                      }}
                    />
                    <Handle
                      type="target"
                      position="top"
                      id={attr}
                      style={{
                        left: centerX,
                        top: centerY,
                        position: 'absolute',
                        background: 'transparent',
                        width: handleSize,
                        height: handleSize,
                        pointerEvents: 'all',
                        zIndex: bubbleZ + 2,
                        border: handleBorder,
                        clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)',
                        transition: 'border 0.2s ease',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%'
                      }}
                      isConnectable={true}
                      onMouseEnter={() => {
                        setHoveredPredicate(attr);
                        scheduleDnfHoverStart();
                        maybeHoverOrGroup(null, attr, 'start');
                      }}
                      onMouseLeave={() => {
                        setHoveredPredicate(null);
                        scheduleDnfHoverEnd();
                        maybeHoverOrGroup(null, attr, 'end');
                      }}
                    />
                  </React.Fragment>
                );
              });
            })}
          </React.Fragment>
        );
      })()}

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
          <Tooltip key={row.id} title={tooltipContent}
            color='geekblue'
            placement="bottom"
            overlayStyle={{ zIndex: 9999, maxWidth:220 }}
            mouseEnterDelay={0}
            mouseLeaveDelay={0}
            destroyTooltipOnHide
            getPopupContainer={() => document.body}>
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
        predicateNesting={props.data.predicateNesting}
        aggregations={props.data.aggregations || []}
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
