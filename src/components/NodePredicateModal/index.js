import { Drawer, Button, Divider, Typography, Tooltip, Select, Input, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  MinusOutlined,
  HomeOutlined,
  FilterOutlined,
  LeftOutlined,
  RightOutlined,
  DragOutlined,
  SortAscendingOutlined
} from '@ant-design/icons';
import React, {useState, useContext, useMemo, useEffect, useCallback, useRef} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/stream-parser';
import { EditorView } from '@codemirror/view';
import { cypher } from '@codemirror/legacy-modes/mode/cypher';
import ReactFlow, { ReactFlowProvider, Background, Handle } from 'react-flow-renderer';
import { PRED_COLOR_V2, OPERATORS } from '../../constants';
import { Context } from '../../Store';
import { PredicateDraw, PredicateCheckBox } from '../common';
import Predicate from '../Predicate';
import { getNodeId } from '../../utils/getNodeId';
import useVisualActions from '../../hooks/useVisualActions';
import DNFBuilder from './DNFBuilder';
import { buildOrGroupRoots } from '../../utils/orGroupRoots';

const { Title } = Typography

const NESTING_LEVEL_COLORS = [
  '#f6ffed',
  '#e6fffb',
  '#e6f7ff',
  '#f9f0ff',
  '#fff7e6',
  '#fff1f0'
];

const normalizePredicateMode = (mode) => (String(mode || '').toUpperCase() === 'OR' ? 'OR' : 'AND');

const normalizePredicateNesting = (predicateNesting, predicateKeys) => {
  const source = (predicateNesting && typeof predicateNesting === 'object') ? predicateNesting : {};
  const sourceOrder = Array.isArray(source.order) ? source.order : [];
  const sourceLevels = (source.levels && typeof source.levels === 'object') ? source.levels : {};
  const sourceModes = (source.modes && typeof source.modes === 'object') ? source.modes : {};

  const keySet = new Set(predicateKeys);
  const seen = new Set();
  const normalizedOrder = [];

  sourceOrder.forEach((attr) => {
    if (!keySet.has(attr) || seen.has(attr)) return;
    seen.add(attr);
    normalizedOrder.push(attr);
  });

  predicateKeys.forEach((attr) => {
    if (seen.has(attr)) return;
    seen.add(attr);
    normalizedOrder.push(attr);
  });

  const normalizedLevels = {};
  const normalizedModes = {};
  normalizedOrder.forEach((attr, index) => {
    const raw = Number.parseInt(sourceLevels[attr], 10);
    const safeLevel = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const maxLevel = index === 0 ? safeLevel : (normalizedLevels[normalizedOrder[index - 1]] + 1);
    normalizedLevels[attr] = Math.min(safeLevel, maxLevel);
    normalizedModes[attr] = normalizePredicateMode(sourceModes[attr]);
  });

  return {
    order: normalizedOrder,
    levels: normalizedLevels,
    modes: normalizedModes
  };
};

const clampLevelsToOrder = (order, levels) => {
  const clampedLevels = {};
  order.forEach((attr, index) => {
    const raw = Number.parseInt(levels[attr], 10);
    const safeLevel = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const maxLevel = index === 0 ? safeLevel : (clampedLevels[order[index - 1]] + 1);
    clampedLevels[attr] = Math.min(safeLevel, maxLevel);
  });
  return clampedLevels;
};

const moveItem = (arr, fromIndex, toIndex) => {
  const next = [...arr];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const normalizeLogicalConnector = (value) => (String(value || '').toUpperCase() === 'OR' ? 'OR' : 'AND');

const renderLogicalTokens = (tokens, omitFirstConnector = true) => {
  if (!tokens || tokens.length === 0) return '';

  return tokens
    .map((token, index) => {
      const connector = normalizeLogicalConnector(token.connector);
      if (index === 0 && omitFirstConnector) {
        return token.expression;
      }
      return `${connector} ${token.expression}`;
    })
    .join(' ');
};

const buildNestedExpression = (orderedItems) => {
  if (!orderedItems || orderedItems.length === 0) return '';

  const stack = [[]];

  orderedItems.forEach((item) => {
    let targetLevel = item.level;

    if (targetLevel > stack.length - 1) {
      targetLevel = stack.length;
    }

    while (stack.length - 1 > targetLevel) {
      const finished = stack.pop();
      if (finished.length > 0) {
        const collapsedExpression = `(${renderLogicalTokens(finished, true)})`;
        const collapsedConnector = finished[0]?.connector || 'AND';
        stack[stack.length - 1].push({
          connector: collapsedConnector,
          expression: collapsedExpression
        });
      }
    }

    while (stack.length - 1 < targetLevel) {
      stack.push([]);
    }

    stack[stack.length - 1].push({
      connector: normalizeLogicalConnector(item.connector),
      expression: item.expression
    });
  });

  while (stack.length > 1) {
    const finished = stack.pop();
    if (finished.length > 0) {
      const collapsedExpression = `(${renderLogicalTokens(finished, true)})`;
      const collapsedConnector = finished[0]?.connector || 'AND';
      stack[stack.length - 1].push({
        connector: collapsedConnector,
        expression: collapsedExpression
      });
    }
  }

  return renderLogicalTokens(stack[0], true);
};

const normalizePredicateValue = (value) => {
  if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
    return value.low;
  }
  return value;
};

const formatCypherValue = (value) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;

  const escapedBackslashes = value.replace(/\\/g, '\\\\');

  if (value.includes("'")) {
    return `"${escapedBackslashes.replace(/"/g, '\\"')}"`;
  }

  return `'${escapedBackslashes.replace(/'/g, "\\'")}'`;
};

const getNodeRepFallback = (nodeId) => {
  const parsed = Number.parseInt(nodeId, 10);
  if (Number.isFinite(parsed)) {
    return (parsed + 10).toString(36);
  }
  return `n${String(nodeId).replace(/[^A-Za-z0-9_]/g, '_')}`;
};

const EXPRESSION_TREE_LAYOUT = {
  bubbleSize: 22,
  operatorSize: 22,
  horizontalGap: 64,
  verticalGap: 82
};

const sanitizeExpressionNodeId = (value) => String(value).replace(/[^A-Za-z0-9_-]/g, '_');

const getPredicateTreeColor = (attr, attributes = []) => {
  const index = attributes.indexOf(attr);
  return PRED_COLOR_V2[(index < 0 ? 0 : index) % PRED_COLOR_V2.length];
};

const buildExpressionTreeAst = (orderedItems) => {
  if (!Array.isArray(orderedItems) || orderedItems.length === 0) {
    return null;
  }

  let operatorCounter = 0;

  const buildOperatorChain = (tokens = [], fallbackOperator = 'AND', idPrefix = 'expr-op') => {
    if (!Array.isArray(tokens) || tokens.length === 0) return null;
    if (tokens.length === 1) return tokens[0].node;

    let current = tokens[0].node;
    for (let i = 1; i < tokens.length; i += 1) {
      const token = tokens[i];
      const operator = normalizeLogicalConnector(token?.connector || fallbackOperator);
      current = {
        id: `${idPrefix}-${operatorCounter += 1}`,
        kind: 'operator',
        label: operator,
        operator,
        toggleAttr: token?.node?.attr,
        children: [current, token.node]
      };
    }

    return current;
  };

  const stack = [[]];

  const collapseTopLevel = () => {
    const finished = stack.pop();
    if (!Array.isArray(finished) || finished.length === 0) return;

    const collapsedNode = buildOperatorChain(finished, 'AND', 'expr-group-op');
    if (!collapsedNode) return;

    stack[stack.length - 1].push({
      connector: finished[0]?.connector || 'AND',
      node: collapsedNode
    });
  };

  orderedItems.forEach((item, index) => {
    let targetLevel = Number.parseInt(item.level, 10);
    if (!Number.isFinite(targetLevel) || targetLevel < 0) targetLevel = 0;
    if (targetLevel > stack.length - 1) targetLevel = stack.length;

    while (stack.length - 1 > targetLevel) {
      collapseTopLevel();
    }

    while (stack.length - 1 < targetLevel) {
      stack.push([]);
    }

    stack[stack.length - 1].push({
      connector: normalizeLogicalConnector(item.connector),
      node: {
        id: item.id || `expr-leaf-${index}`,
        kind: 'leaf',
        attr: item.attr,
        label: item.attr || item.label || item.expression,
        tooltip: item.tooltip || item.expression,
        connector: normalizeLogicalConnector(item.connector),
        children: []
      }
    });
  });

  while (stack.length > 1) {
    collapseTopLevel();
  }

  return buildOperatorChain(stack[0], 'AND', 'expr-root-op');
};

const annotateExpressionTree = (node, state = { leafIndex: 0 }) => {
  if (!node) return null;

  if (!Array.isArray(node.children) || node.children.length === 0) {
    const nextIndex = state.leafIndex;
    state.leafIndex += 1;
    return {
      ...node,
      leafCount: 1,
      orderIndex: nextIndex
    };
  }

  const children = node.children.map((child) => annotateExpressionTree(child, state)).filter(Boolean);
  const leafCount = children.reduce((total, child) => total + (child.leafCount || 0), 0);
  const orderIndex = children.length > 0
    ? children.reduce((total, child) => total + (child.orderIndex || 0), 0) / children.length
    : state.leafIndex;

  return {
    ...node,
    children,
    leafCount,
    orderIndex
  };
};

const ExpressionTreeNode = ({ data }) => {
  const [hovered, setHovered] = useState(false);
  const isOperator = data.kind === 'operator';
  const bubbleSize = isOperator ? EXPRESSION_TREE_LAYOUT.operatorSize : EXPRESSION_TREE_LAYOUT.bubbleSize;
  const operatorLabel = normalizeLogicalConnector(data.label || data.operator || 'AND');
  const operatorPalette = operatorLabel === 'OR'
    ? {
        background: '#ff7a45',
        border: '#ff7a45',
        color: '#fff',
        glow: 'rgba(255, 122, 69, 0.35)'
      }
    : {
        background: '#7b3ff2',
        border: '#7b3ff2',
        color: '#fff',
        glow: 'rgba(123, 63, 242, 0.35)'
      };
  const circleStyle = isOperator
    ? {
        width: bubbleSize,
        height: bubbleSize,
        borderRadius: '50%',
        border: `1px solid ${operatorPalette.border}`,
        background: operatorPalette.background,
        color: operatorPalette.color,
        fontWeight: 800,
        fontSize: 9,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: hovered
          ? `0 0 0 3px ${operatorPalette.glow}, 0 3px 10px rgba(0,0,0,0.22)`
          : '0 2px 6px rgba(0,0,0,0.2)',
        transform: hovered ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 160ms ease, box-shadow 160ms ease'
      }
    : null;

  const handleOperatorClick = (event) => {
    if (!isOperator || typeof data.onToggle !== 'function') return;
    event.stopPropagation();
    data.onToggle(data.toggleAttr);
  };

  const handleLeafPointerDown = (event) => {
    if (isOperator || typeof data.onDragStart !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    data.onDragStart(data.attr, event);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: bubbleSize,
        height: bubbleSize,
        overflow: 'visible',
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position="top" style={{ opacity: 0, border: 0, background: 'transparent' }} />
      {isOperator ? (
        <div
          role="button"
          tabIndex={0}
          style={{
            ...circleStyle,
            cursor: 'pointer',
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 10,
            pointerEvents: 'auto'
          }}
          onClick={handleOperatorClick}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleOperatorClick(event);
            }
          }}
        >
          {data.label}
        </div>
      ) : (
        <Predicate
          radius={Math.floor(bubbleSize / 2)}
          position={{ x: 0, y: 0 }}
          color={data.color}
          title={data.title || data.label}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            zIndex: 10,
            border: '1px solid #111',
            boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            cursor: 'grab',
            userSelect: 'none',
            touchAction: 'none'
          }}
          onMouseDown={handleLeafPointerDown}
          onPointerDown={handleLeafPointerDown}
        />
      )}
      {!isOperator && hovered && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: -(bubbleSize + 14),
            transform: 'translateX(-50%)',
            background: '#fff',
            color: '#333',
            padding: '2px 8px',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            fontSize: 10,
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap',
            maxWidth: `${Math.max((data.title || data.label || '').length * 6.5, bubbleSize * 2)}px`,
            textAlign: 'center'
          }}
        >
          {data.title || data.label}
        </div>
      )}
      <Handle type="source" position="bottom" style={{ opacity: 0, border: 0, background: 'transparent' }} />
    </div>
  );
};

const ExpressionTreeDropSlotNode = ({ data }) => {
  const isActive = !!data.active;
  const palette = data.palette || { background: '#e6f7ff', border: '#91d5ff' };
  const slotWidth = Number.isFinite(data.width) ? data.width : 54;
  const slotHeight = Number.isFinite(data.height) ? data.height : 26;
  const label = data.label || '';

  return (
    <div
      style={{
        width: slotWidth,
        height: slotHeight,
        borderRadius: 8,
        border: `2px dashed ${palette.border}`,
        background: palette.background,
        boxShadow: isActive ? `0 0 0 3px ${palette.background}99` : 'none',
        opacity: isActive ? 0.5 : 0.1,
        transition: 'opacity 220ms ease, transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, background-color 220ms ease',
        transform: isActive ? 'scale(1.03)' : 'scale(1)',
        pointerEvents: 'none',
        color: '#262626',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 6px'
      }}
    >
      {label}
    </div>
  );
};

const buildExpressionTreeGraph = (tree, attributes = [], onToggleOperator = null, onLeafDragStart = null) => {
  if (!tree) {
    return { elements: [], leafNodes: [], operatorNodes: [], nodeTypes: {} };
  }

  const elements = [];
  const leafNodes = [];
  const operatorNodes = [];
  let nextLeafIndex = 0;

  const layout = (current, depth = 0, parentId = null) => {
    if (!current) return { centerX: 0, width: 0 };

    const isLeaf = !current.children || current.children.length === 0;
    const id = current.id;
    const width = isLeaf ? EXPRESSION_TREE_LAYOUT.bubbleSize : EXPRESSION_TREE_LAYOUT.operatorSize;
    const height = width;
    const y = depth * EXPRESSION_TREE_LAYOUT.verticalGap;

    if (isLeaf) {
      const x = nextLeafIndex * EXPRESSION_TREE_LAYOUT.horizontalGap;
      nextLeafIndex += 1;
      leafNodes.push({
        id,
        attr: current.attr,
        x,
        y,
        width,
        height,
        centerX: x + width / 2,
        centerY: y + height / 2
      });
      elements.push({
        id,
        type: 'expressionBubbleNode',
        position: { x, y },
        data: {
          kind: 'leaf',
          attr: current.attr,
          label: current.label,
          title: current.tooltip || current.label,
          onDragStart: onLeafDragStart,
          color: getPredicateTreeColor(current.attr, attributes)
        },
        draggable: false,
        selectable: false,
        connectable: false,
        style: { width, height }
      });
      return {
        id,
        attr: current.attr,
        centerX: x + width / 2,
        centerY: y + height / 2,
        width,
        minX: x,
        maxX: x + width,
        minY: y,
        maxY: y + height,
        leafAttrs: current.attr ? [current.attr] : []
      };
    }

    const childLayouts = (current.children || []).map((child) => layout(child, depth + 1, id));
    const firstChild = childLayouts[0];
    const lastChild = childLayouts[childLayouts.length - 1];
    const centerX = childLayouts.length > 0
      ? ((firstChild?.centerX || 0) + (lastChild?.centerX || 0)) / 2
      : nextLeafIndex * EXPRESSION_TREE_LAYOUT.horizontalGap;
    const x = centerX - width / 2;

    elements.push({
      id,
      type: 'expressionBubbleNode',
      position: { x, y },
      data: {
        kind: 'operator',
        label: current.operator || current.label || 'AND',
        title: current.operator || current.label || 'AND',
        operator: current.operator || current.label || 'AND',
        toggleAttr: current.toggleAttr,
        onToggle: onToggleOperator
      },
      draggable: false,
      selectable: false,
      connectable: false,
      style: { width, height }
    });

    childLayouts.forEach((child) => {
      if (child && child.id) {
        elements.push({
          id: `${id}-${child.id}`,
          source: id,
          target: child.id,
          type: 'step',
          style: {
            stroke: '#8c8c8c',
            strokeWidth: 2
          }
        });
      }
    });

    const validChildren = childLayouts.filter(Boolean);
    const minX = validChildren.length > 0 ? Math.min(...validChildren.map((child) => child.minX ?? child.centerX ?? 0)) : x;
    const maxX = validChildren.length > 0 ? Math.max(...validChildren.map((child) => child.maxX ?? child.centerX ?? 0)) : (x + width);
    const minY = validChildren.length > 0 ? Math.min(...validChildren.map((child) => child.minY ?? y)) : y;
    const maxY = validChildren.length > 0 ? Math.max(...validChildren.map((child) => child.maxY ?? (y + height))) : (y + height);
    const leafAttrs = validChildren.flatMap((child) => child.leafAttrs || []);

    operatorNodes.push({
      id,
      operator: current.operator || current.label || 'AND',
      centerX,
      centerY: y + height / 2,
      minX,
      maxX,
      minY,
      maxY,
      leafAttrs
    });

    return {
      id,
      centerX,
      centerY: y + height / 2,
      width,
      minX,
      maxX,
      minY,
      maxY,
      leafAttrs
    };
  };

  layout(tree, 0, null);

  return {
    elements,
    leafNodes,
    operatorNodes,
    nodeTypes: {
      expressionBubbleNode: ExpressionTreeNode,
      expressionDropSlotNode: ExpressionTreeDropSlotNode
    }
  };
};

const NodePredicateModal = ({
  visible,
  onClose,
  node,
  nodeId,
  targets,
  attributes,
  predicates,
  predicateNesting,
  aggregations,
  dnf,
  addPredicate,
  deletePredicate,
  updatePredicate,
  currPos,
  isJoin,
  setIsJoin,
  propData,
  onDeleteNode
}) => {
  const VA = useVisualActions()
  const [childrenDrawer, setChildDrawer] = useState({});
  const [nestingDrawerVisible, setNestingDrawerVisible] = useState(false);
  const [draggedAttr, setDraggedAttr] = useState('');
  const [dropTargetAttr, setDropTargetAttr] = useState('');
  const [treeDragState, setTreeDragState] = useState({ attr: '', slotId: null });
  const [expressionTreeInstance, setExpressionTreeInstance] = useState(null);
  const expressionTreeContainerRef = useRef(null);
  const [state, dispatch] = useContext(Context);

  const predicateKeys = Object.keys(predicates || {});
  const predicateKeySignature = predicateKeys.slice().sort().join('|');

  const normalizedNesting = useMemo(() => {
    return normalizePredicateNesting(predicateNesting, predicateKeys);
  }, [predicateNesting, predicateKeySignature]);

  useEffect(() => {
    if (visible) return;
    setNestingDrawerVisible(false);
    setDraggedAttr('');
    setDropTargetAttr('');
    setTreeDragState({ attr: '', slotId: null });
    setExpressionTreeInstance(null);
  }, [visible]);

  const zoomExpressionTreeIn = () => {
    if (!expressionTreeInstance) return;
    if (typeof expressionTreeInstance.zoomIn === 'function') {
      expressionTreeInstance.zoomIn();
    }
  };

  const zoomExpressionTreeOut = () => {
    if (!expressionTreeInstance) return;
    if (typeof expressionTreeInstance.zoomOut === 'function') {
      expressionTreeInstance.zoomOut();
    }
  };

  const resetExpressionTreeView = () => {
    if (!expressionTreeInstance) return;
    if (typeof expressionTreeInstance.fitView === 'function') {
      expressionTreeInstance.fitView({ padding: 0.25 });
    }
  };

  const persistNestingState = (nextNestingState) => {
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'predicateNesting', newVal: nextNestingState },
    });
  };

  const togglePredicateMode = useCallback((attr) => {
    if (!attr) return;

    const currentMode = normalizePredicateMode(normalizedNesting.modes[attr]);
    const nextModes = {
      ...normalizedNesting.modes,
      [attr]: currentMode === 'OR' ? 'AND' : 'OR'
    };

    persistNestingState({
      order: normalizedNesting.order,
      levels: normalizedNesting.levels,
      modes: nextModes
    });
  }, [normalizedNesting.modes, normalizedNesting.order, normalizedNesting.levels, persistNestingState]);

  const relationshipMap = useMemo(() => {
    if (!nestingDrawerVisible) return {};

    const relMap = {};
    const keySet = new Set(predicateKeys);

    predicateKeys.forEach((attr) => {
      relMap[attr] = [];
    });

    (state.orLinks || []).forEach((link) => {
      const isLocal = String(link.from.nodeId) === String(nodeId) && String(link.to.nodeId) === String(nodeId);
      if (!isLocal) return;
      if (!keySet.has(link.from.attr) || !keySet.has(link.to.attr)) return;
      relMap[link.from.attr] = [...new Set([...(relMap[link.from.attr] || []), link.to.attr])];
      relMap[link.to.attr] = [...new Set([...(relMap[link.to.attr] || []), link.from.attr])];
    });

    const orderIndex = {};
    (normalizedNesting.order || []).forEach((attr, index) => {
      orderIndex[attr] = index;
    });

    Object.keys(relMap).forEach((attr) => {
      relMap[attr] = relMap[attr].sort((a, b) => {
        const ai = orderIndex[a] ?? Number.MAX_SAFE_INTEGER;
        const bi = orderIndex[b] ?? Number.MAX_SAFE_INTEGER;
        return ai - bi;
      });
    });

    return relMap;
  }, [state.orLinks, nodeId, predicateKeySignature, normalizedNesting.order, nestingDrawerVisible]);

  const nodePredicatePreview = useMemo(() => {
    const currentNode = (state.nodes || []).find((n) => String(n.id) === String(nodeId));
    const rep = currentNode?.data?.rep || getNodeRepFallback(nodeId);
    const orGroupRoots = buildOrGroupRoots(state.nodes, state.orLinks);

    const attrExpressionMap = {};
    Object.keys(predicates || {}).forEach((attr) => {
      const predRows = predicates[attr]?.data || [];
      const terms = predRows
        .map((pred) => {
          const rawValue = normalizePredicateValue(pred?.[1]);
          if (rawValue === '' || rawValue === undefined || rawValue === null) return null;
          const op = OPERATORS[pred?.[0]] || pred?.[0] || '=';
          const value = formatCypherValue(rawValue);
          return `${rep}.${attr} ${op} ${value}`;
        })
        .filter(Boolean);

      if (terms.length > 0) {
        attrExpressionMap[attr] = terms.join(' AND ');
      }
    });

    const groupedExpressionByAttr = {};
    const groups = {};

    Object.keys(attrExpressionMap).forEach((attr) => {
      const key = `${nodeId}_${attr}`;
      const root = orGroupRoots[key] || key;
      if (!groups[root]) groups[root] = [];
      groups[root].push(attr);
    });

    Object.keys(groups).forEach((root) => {
      const attrs = groups[root];
      const expressions = attrs
        .map((attr) => attrExpressionMap[attr])
        .filter(Boolean);
      if (expressions.length === 0) return;

      const groupedExpression = expressions.length === 1
        ? expressions[0]
        : `(${expressions.join(' OR ')})`;

      attrs.forEach((attr) => {
        groupedExpressionByAttr[attr] = groupedExpression;
      });
    });

    const orderedItems = [];

    (normalizedNesting.order || []).forEach((attr) => {
      const expression = attrExpressionMap[attr];
      if (!expression) return;

      orderedItems.push({
        expression,
        attr,
        label: attr,
        tooltip: expression,
        level: normalizedNesting.levels[attr] || 0,
        connector: normalizedNesting.modes[attr] || 'AND'
      });
    });

    const tree = annotateExpressionTree(buildExpressionTreeAst(orderedItems));

    return {
      preview: buildNestedExpression(orderedItems),
      tree
    };
  }, [nodeId, normalizedNesting, predicates, state.nodes, state.orLinks]);

  const expressionTreeGraph = useMemo(() => {
    return buildExpressionTreeGraph(nodePredicatePreview.tree, attributes || [], togglePredicateMode, (attr, event) => {
      // start drag from leaf
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setTreeDragState({ attr, slotId: null });
    });
  }, [nodePredicatePreview.tree, attributes, togglePredicateMode]);

  const expressionTreeDropSlots = useMemo(() => {
    const draggedAttrForTree = treeDragState.attr;
    if (!draggedAttrForTree) return [];

    const availableLeafNodes = (expressionTreeGraph.leafNodes || []).filter((leaf) => leaf.attr !== draggedAttrForTree);
    if (availableLeafNodes.length === 0) return [];

    const slots = [];
    const baseColors = ['#e6f7ff', '#f9f0ff', '#fff1f0', '#f6ffed', '#fff7e6'];
    const borderColors = ['#91d5ff', '#d3adf7', '#ffa39e', '#b7eb8f', '#ffd591'];

    const orderIndex = {};
    normalizedNesting.order.forEach((attr, idx) => {
      orderIndex[attr] = idx;
    });

    (expressionTreeGraph.operatorNodes || []).forEach((operatorNode, operatorIndex) => {
      const operatorAttrs = (operatorNode.leafAttrs || [])
        .filter((attr) => attr && attr !== draggedAttrForTree)
        .filter((attr, idx, arr) => arr.indexOf(attr) === idx)
        .sort((a, b) => (orderIndex[a] ?? Number.MAX_SAFE_INTEGER) - (orderIndex[b] ?? Number.MAX_SAFE_INTEGER));

      if (operatorAttrs.length === 0) return;

      const targetLeafNodes = availableLeafNodes.filter((leaf) => operatorAttrs.includes(leaf.attr));
      if (targetLeafNodes.length === 0) return;

      const targetIndexes = operatorAttrs
        .map((attr) => normalizedNesting.order.indexOf(attr))
        .filter((idx) => idx >= 0);
      if (targetIndexes.length === 0) return;

      const minLevel = operatorAttrs.reduce((lowest, attr) => {
        const level = Number.parseInt(normalizedNesting.levels[attr], 10) || 0;
        return Math.min(lowest, level);
      }, Number.MAX_SAFE_INTEGER);
      const baseLevel = Number.isFinite(minLevel) && minLevel !== Number.MAX_SAFE_INTEGER ? minLevel : 0;

      const minX = Math.min(...targetLeafNodes.map((leaf) => leaf.x));
      const maxX = Math.max(...targetLeafNodes.map((leaf) => leaf.x + leaf.width));
      const minY = Math.min(...targetLeafNodes.map((leaf) => leaf.y));
      const maxY = Math.max(...targetLeafNodes.map((leaf) => leaf.y + leaf.height));

      const groupPaddingX = 14;
      const groupPaddingY = 12;
      const left = minX - groupPaddingX;
      const right = maxX + groupPaddingX;
      const top = minY - groupPaddingY;
      const bottom = maxY + groupPaddingY;

      const paletteIndex = operatorIndex % baseColors.length;
      const targetInsertIndex = Math.max(...targetIndexes) + 1;
      const nestWidth = Math.max(88, Math.min(160, right - left));

      slots.push({
        id: `group-${operatorNode.id}`,
        type: 'group',
        targetOperatorId: operatorNode.id,
        index: targetInsertIndex,
        targetLevel: baseLevel,
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        width: Math.max(68, right - left),
        height: Math.max(34, bottom - top),
        left,
        right,
        top,
        bottom,
        background: baseColors[paletteIndex],
        border: borderColors[paletteIndex],
        label: 'DROP IN GROUP'
      });

      slots.push({
        id: `nest-group-${operatorNode.id}`,
        type: 'nest-group',
        targetOperatorId: operatorNode.id,
        index: targetInsertIndex,
        targetLevel: baseLevel + 1,
        x: (left + right) / 2,
        y: bottom + 26,
        width: nestWidth,
        height: 24,
        left: ((left + right) / 2) - (nestWidth / 2),
        right: ((left + right) / 2) + (nestWidth / 2),
        top: bottom + 14,
        bottom: bottom + 38,
        background: baseColors[paletteIndex],
        border: borderColors[paletteIndex],
        label: 'DROP BELOW'
      });
    });

    return slots;
  }, [expressionTreeGraph.leafNodes, expressionTreeGraph.operatorNodes, normalizedNesting.levels, normalizedNesting.order, treeDragState.attr]);

  const activeExpressionTreeDropSlot = useMemo(() => {
    const slotId = treeDragState.slotId;
    if (!slotId) return null;
    return expressionTreeDropSlots.find((slot) => slot.id === slotId) || null;
  }, [expressionTreeDropSlots, treeDragState.slotId]);

  const expressionTreeElements = useMemo(() => {
    if (!treeDragState.attr) return [...expressionTreeGraph.elements];

    const slotElements = expressionTreeDropSlots.map((slot) => {
      const slotWidth = Number.isFinite(slot.width) ? slot.width : 54;
      const slotHeight = Number.isFinite(slot.height) ? slot.height : 26;
      return {
        id: `expression-drop-slot-${slot.id}`,
        type: 'expressionDropSlotNode',
        position: { x: slot.x - (slotWidth / 2), y: slot.y - (slotHeight / 2) },
        data: {
          active: slot.id === treeDragState.slotId,
          width: slotWidth,
          height: slotHeight,
          label: slot.label,
          palette: {
            background: slot.background,
            border: slot.border
          }
        },
        selectable: false,
        draggable: false,
        connectable: false,
        style: { width: slotWidth, height: slotHeight }
      };
    });

    const activeSlotEdges = [];
    const aslot = activeExpressionTreeDropSlot;
    if (aslot && aslot.type === 'nest-group') {
      // show edge from target operator down to slot
      activeSlotEdges.push({
        id: `expression-drop-slot-edge-nest-group-${aslot.id}`,
        source: aslot.targetOperatorId,
        target: `expression-drop-slot-${aslot.id}`,
        type: 'step',
        style: {
          stroke: aslot.border,
          strokeWidth: 2,
          strokeDasharray: '4,4'
        }
      });
    }

    return [...expressionTreeGraph.elements, ...slotElements, ...activeSlotEdges];
  }, [activeExpressionTreeDropSlot, expressionTreeDropSlots, expressionTreeGraph.elements, treeDragState.attr, treeDragState.slotId]);

  const previewQueryText = nodePredicatePreview.preview
    ? `WHERE ${nodePredicatePreview.preview}`
    : '-- No valid predicates for this node --';

  const shiftIndentation = (attr, delta) => {
    const index = normalizedNesting.order.indexOf(attr);
    if (index < 0) return;

    const currentLevel = normalizedNesting.levels[attr] || 0;
    let nextLevel = currentLevel + delta;
    if (nextLevel < 0) nextLevel = 0;

    if (delta > 0) {
      if (index > 0) {
        const prevAttr = normalizedNesting.order[index - 1];
        const prevLevel = normalizedNesting.levels[prevAttr] || 0;
        nextLevel = Math.min(nextLevel, prevLevel + 1);
      }
    }

    const nextLevels = {
      ...normalizedNesting.levels,
      [attr]: nextLevel
    };
    const clamped = clampLevelsToOrder(normalizedNesting.order, nextLevels);
    persistNestingState({ order: normalizedNesting.order, levels: clamped, modes: normalizedNesting.modes });
  };

  const handleDropOnAttribute = (targetAttr) => {
    if (!draggedAttr || draggedAttr === targetAttr) {
      setDropTargetAttr('');
      setDraggedAttr('');
      return;
    }

    const fromIndex = normalizedNesting.order.indexOf(draggedAttr);
    const toIndex = normalizedNesting.order.indexOf(targetAttr);
    if (fromIndex < 0 || toIndex < 0) {
      setDropTargetAttr('');
      setDraggedAttr('');
      return;
    }

    const reordered = moveItem(normalizedNesting.order, fromIndex, toIndex);
    const clampedLevels = clampLevelsToOrder(reordered, normalizedNesting.levels);
    persistNestingState({ order: reordered, levels: clampedLevels, modes: normalizedNesting.modes });
    setDropTargetAttr('');
    setDraggedAttr('');
  };

  const getNearestExpressionTreeSlotIndex = useCallback((draggedNode) => {
    if (!draggedNode || !treeDragState.attr || expressionTreeDropSlots.length === 0) return null;

    const leafNode = (expressionTreeGraph.leafNodes || []).find((leaf) => leaf.attr === treeDragState.attr);
    const nodeWidth = leafNode?.width || EXPRESSION_TREE_LAYOUT.bubbleSize;
    const nodeHeight = leafNode?.height || EXPRESSION_TREE_LAYOUT.bubbleSize;
    const dragCenterX = (draggedNode.position?.x || 0) + nodeWidth / 2;
    const dragCenterY = (draggedNode.position?.y || 0) + nodeHeight / 2;

    let nearestSlot = expressionTreeDropSlots[0];
    let nearestDistance = Infinity;

    expressionTreeDropSlots.forEach((slot) => {
      const distance = Math.hypot(slot.x - dragCenterX, slot.y - dragCenterY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlot = slot;
      }
    });

    return nearestSlot?.index ?? null;
  }, [expressionTreeDropSlots, expressionTreeGraph.leafNodes, treeDragState.attr]);

  const getPointToExpressionTreeSlotDistance = useCallback((slot, point) => {
    if (!slot || !point) return Number.POSITIVE_INFINITY;

    const left = Number.isFinite(slot.left) ? slot.left : (slot.x - ((slot.width || 54) / 2));
    const right = Number.isFinite(slot.right) ? slot.right : (slot.x + ((slot.width || 54) / 2));
    const top = Number.isFinite(slot.top) ? slot.top : (slot.y - ((slot.height || 26) / 2));
    const bottom = Number.isFinite(slot.bottom) ? slot.bottom : (slot.y + ((slot.height || 26) / 2));

    const dx = point.x < left ? (left - point.x) : (point.x > right ? point.x - right : 0);
    const dy = point.y < top ? (top - point.y) : (point.y > bottom ? point.y - bottom : 0);

    if (dx === 0 && dy === 0) return 0;
    return Math.hypot(dx, dy);
  }, []);

  const handleExpressionTreePointerMove = useCallback((event) => {
    if (!treeDragState.attr || !expressionTreeInstance || !expressionTreeContainerRef.current) return;

    const rect = expressionTreeContainerRef.current.getBoundingClientRect();
    const flowPoint = typeof expressionTreeInstance.project === 'function'
      ? expressionTreeInstance.project({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        })
      : {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };

    let nearestSlot = null;
    let nearestDistance = Infinity;

    expressionTreeDropSlots.forEach((slot) => {
      const distance = getPointToExpressionTreeSlotDistance(slot, flowPoint);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestSlot = slot;
      }
    });

    const hoveredSlotId = nearestDistance === 0 ? (nearestSlot?.id ?? null) : null;

    setTreeDragState((current) => ({
      ...current,
      slotId: hoveredSlotId
    }));
  }, [expressionTreeDropSlots, expressionTreeInstance, getPointToExpressionTreeSlotDistance, treeDragState.attr]);

  const handleExpressionTreePointerUp = useCallback(() => {
    if (!treeDragState.attr || !treeDragState.slotId) {
      setTreeDragState({ attr: '', slotId: null });
      return;
    }

    const fromIndex = normalizedNesting.order.indexOf(treeDragState.attr);
    const slot = expressionTreeDropSlots.find((s) => s.id === treeDragState.slotId);
    if (!slot) {
      setTreeDragState({ attr: '', slotId: null });
      return;
    }

    if (slot.type === 'group') {
      const targetIndex = slot.index;
      if (fromIndex >= 0 && targetIndex !== null && targetIndex !== undefined) {
        const reordered = moveItem(normalizedNesting.order, fromIndex, targetIndex);
        const nextLevels = {
          ...normalizedNesting.levels,
          [treeDragState.attr]: slot.targetLevel
        };
        const clampedLevels = clampLevelsToOrder(reordered, nextLevels);
        persistNestingState({ order: reordered, levels: clampedLevels, modes: normalizedNesting.modes });
      }
    } else if (slot.type === 'nest-group') {
      const targetIndex = slot.index;
      if (fromIndex >= 0 && targetIndex !== null && targetIndex !== undefined) {
        const desiredIndex = targetIndex;
        const reordered = moveItem(normalizedNesting.order, fromIndex, desiredIndex);
        const nextLevels = {
          ...normalizedNesting.levels,
          [treeDragState.attr]: slot.targetLevel
        };
        const clampedLevels = clampLevelsToOrder(reordered, nextLevels);
        persistNestingState({ order: reordered, levels: clampedLevels, modes: normalizedNesting.modes });
      }
    }

    setTreeDragState({ attr: '', slotId: null });
  }, [normalizedNesting.levels, normalizedNesting.order, normalizedNesting.modes, treeDragState.attr, treeDragState.slotId, expressionTreeDropSlots]);

  useEffect(() => {
    if (!treeDragState.attr) return undefined;

    const onPointerMove = (event) => handleExpressionTreePointerMove(event);
    const onPointerUp = () => handleExpressionTreePointerUp();

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [handleExpressionTreePointerMove, handleExpressionTreePointerUp, treeDragState.attr]);

  const startLeafDrag = useCallback((attr, event) => {
    if (!attr) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setTreeDragState({ attr, slotId: null });
  }, [normalizedNesting.order]);

  const showChildrenDrawer = (attr) => {
    setChildDrawer({
      ...childrenDrawer,
      [attr]: true
    })
  };

  const onChildrenDrawerClose = (attr) => {
    setChildDrawer({
      ...childrenDrawer,
      [attr]: false
    })
  };

  const handleSaveDNF = (newDNF) => {
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'dnf', newVal: newDNF },
    });
  };

  const isNumeric = (attr) => {
      if (!propData || propData.length === 0) return true; 
      for (const row of propData) {
          const val = row[attr];
          if (val === undefined || val === null) continue;
          if (typeof val === 'number') return true;
          if (typeof val === 'object' && val.low !== undefined && val.high !== undefined) return true;
          return false;
      }
      return true; 
  }

  //* Add Target node (new)
  const addTarget = (destNode) => {
    // set connected of existing node to true
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'connected', newVal: true },
    });

    const destId = getNodeId();

    let newState = VA.add(state, "NODE", {
      data : {
        connected: true
      },
      id: destId,
      position: { x: currPos[0] + 200, y: currPos[1] },
      label: destNode
    })

    newState = VA.add(newState, "EDGE", {
      params: { source: nodeId, target: destId},
      destNode
    })

    dispatch({
      type: 'SET_GRAPH',
      payload: newState
    })
  };

  return (
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title style={{marginBottom: 0}} level={3}>{node}</Title>
            <Tooltip title="Delete Node">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={onDeleteNode}
              />
            </Tooltip>
          </div>
        }
        placement="left"
        closeIcon={<ArrowLeftOutlined/>}
        maskClosable={false}
        mask={false}
        onClose={onClose}
        visible={visible}
        push={false}
      >
        <Divider orientation="left">Selected Predicates</Divider>

        <div style={{padding: '0px 15px 10px'}}>
          <Button
            style={{ marginBottom: 10 }}
            block
            icon={<SortAscendingOutlined />}
            onClick={() => setNestingDrawerVisible(true)}
          >
            Change Nesting
          </Button>

          {normalizedNesting.order.map((attr, i) => {
            const attrIndex = attributes.indexOf(attr);
            const colorIndex = attrIndex === -1 ? i : attrIndex;
            const colour = PRED_COLOR_V2[colorIndex % PRED_COLOR_V2.length];
            const mode = normalizePredicateMode(normalizedNesting.modes[attr]);
            return (
              <React.Fragment key={`pt-${attr}`}>
                {i > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 2px' }}>
                    <Button
                      size="small"
                      type={mode === 'OR' ? 'primary' : 'default'}
                      style={mode === 'OR'
                        ? {
                            backgroundColor: '#fa8c16',
                            borderColor: '#fa8c16',
                            fontWeight: 600,
                            height: 16,
                            minWidth: 30,
                            fontSize: 9,
                            lineHeight: '14px',
                            padding: '0 4px'
                          }
                        : {
                            fontWeight: 600,
                            height: 16,
                            minWidth: 30,
                            fontSize: 9,
                            lineHeight: '14px',
                            padding: '0 4px'
                          }}
                      onClick={(event) => {
                        event.stopPropagation();
                        togglePredicateMode(attr);
                      }}
                    >
                      {mode}
                    </Button>
                  </div>
                )}

                <div
                  onClick={() => {showChildrenDrawer(attr);}}
                  style={{
                    borderRadius: 6,
                    padding: '0 8px',
                    display: 'flex',
                    flexDirection: 'row',
                    cursor: 'pointer',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    height: 34,
                    width: '100%',
                    marginBottom: 6,
                    backgroundColor: colour.light,
                    border: `1px solid ${colour.secondary}`,
                    transition: '0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 8 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: colour.primary,
                        border: `1px solid ${colour.secondary}`,
                        flexShrink: 0
                      }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 600,
                        color: '#262626'
                      }}
                    >
                      {attr}
                    </span>
                  </div>
                </div>
                <PredicateDraw
                  onClose={() => onChildrenDrawerClose(attr)}
                  attr={attr}
                  oldPredicate={{ attr: attr, preds: predicates[attr].data }}
                  updatePredicate={updatePredicate}
                  deletePredicate={deletePredicate}
                  propValues={propData
                    .filter((item) => Object.keys(item).includes(attr))
                    .map((item) => item[attr])
                  }
                  titleColor={colour.secondary}
                  visible={childrenDrawer[attr]}/>
              </React.Fragment>
            )
          })}
        </div>

        <Divider orientation="left">Properties</Divider>

        <div style={{padding: '0px 15px 10px'}}>
          {attributes.map((attr, i) => (
              <PredicateCheckBox
                key={`${attr}-k`}
                title={attr}
                checked={Object.keys(predicates).indexOf(attr) !== -1}
                onAddPredicate={() => {
                  addPredicate(attr, PRED_COLOR_V2[i % PRED_COLOR_V2.length])
                  setChildDrawer({
                    ...childrenDrawer,
                    [attr]:true
                  })
                  }
                }
                onDeletePredicate={() => {
                  deletePredicate(attr)
                }}
                palette={PRED_COLOR_V2[i % PRED_COLOR_V2.length]} />
            ))
          }

        </div>

        <Divider orientation="left">Aggregations</Divider>
        <div style={{padding: '0px 15px 10px'}}>
           {
               (Array.isArray(aggregations) ? aggregations : []).map((agg, idx) => (
                   <div key={idx} style={{marginBottom: 8}}>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                       <Select 
                           placeholder="Attribute"
                           style={{flex: 1}}
                           value={agg.attribute}
                           onChange={(val) => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs[idx] = { ...agg, attribute: val };
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       >
                           {attributes.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
                       </Select>
                       <Select 
                           placeholder="Function"
                           style={{width: 100}}
                           value={agg.function}
                           onChange={(val) => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs[idx] = { ...agg, function: val };
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       >
                           <Select.Option value="COUNT">COUNT</Select.Option>
                           <Select.Option value="SUM">SUM</Select.Option>
                           <Select.Option value="AVG">AVG</Select.Option>
                           <Select.Option value="MIN">MIN</Select.Option>
                           <Select.Option value="MAX">MAX</Select.Option>
                           <Select.Option value="COLLECT">COLLECT</Select.Option>
                       </Select>
                       <Button 
                           icon={<FilterOutlined />}
                           type={agg.hasCondition ? 'primary' : 'default'}
                           onClick={() => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               if (!agg.hasCondition) {
                                   newAggs[idx] = { ...agg, hasCondition: true, alias: '', operator: '>', value: '' };
                               } else {
                                   newAggs[idx] = { ...agg, hasCondition: false };
                               }
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       />
                       <Button 
                           danger
                           icon={<DeleteOutlined />}
                           onClick={() => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs.splice(idx, 1);
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       />
                   </div>
                   
                   {agg.hasCondition && (
                       <div style={{display: 'flex', gap: 8, marginTop: 8, paddingLeft: 12, alignItems: 'center'}}>
                           <FilterOutlined style={{color: '#aaa'}}/>
                           <Input 
                               placeholder="Alias"
                               value={agg.alias}
                               onChange={(e) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, alias: e.target.value };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                               style={{flex: 1}}
                           />
                           <Select
                               style={{width: 80}}
                               value={agg.operator}
                               onChange={(val) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, operator: val };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                           >
                               {['=', '>', '>=', '<', '<=', '<>'].map(op => <Select.Option key={op} value={op}>{op}</Select.Option>)}
                           </Select>
                           <Input 
                               placeholder="Value"
                               value={agg.value}
                               onChange={(e) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, value: e.target.value };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                               style={{flex: 1}}
                           />
                       </div>
                   )}

                      {agg.attribute && ['SUM', 'AVG'].includes(agg.function) && !isNumeric(agg.attribute) && (
                          <div style={{color: 'red', fontSize: '12px', marginTop: 4}}>
                              Warning: Numeric aggregation on non-numeric type!
                          </div>
                      )}
                   </div>
               ))
           }
           <Button 
               type="dashed" 
               onClick={() => {
                   const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                   newAggs.push({ attribute: attributes[0], function: 'COUNT' });
                   dispatch({
                       type: 'MODIFY_NODE_DATA',
                       payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                   });
               }} 
               block 
               icon={<PlusOutlined />}
           >
               Add Aggregation
           </Button>
        </div>

        {/* <Divider orientation="left">Join : Optional Match</Divider>
        <div style={{padding: '0px 15px 10px'}}>
          <Button
            type={isJoin ? "primary" : "default"}
            onClick={() => {
              setIsJoin(!isJoin);
            }}
            style={{ width: '100%' }}
          >
            {isJoin ? "Joined" : "Join"}
          </Button>
        </div> */}

        <Divider orientation="left">DNF Query Builder</Divider>
        <DNFBuilder 
            attributes={attributes} 
            propData={propData} 
            initialData={dnf} 
            onSave={handleSaveDNF} 
        />

        <Divider orientation="left">Possible Targets</Divider>
        <div style={{padding: '0px 15px 10px'}}>
          {
            targets.map((target, i) => {
              return (
                <Button
                  style={{marginRight: 8, background: '#d7f0ffee', borderRadius: 10}}
                  key={`${i}`}
                  onClick={() => {
                    addTarget(target)
                  }} type="text">
                  {target}
                </Button>
              )
            })
          }
        </div>

        <Drawer
          title={<Title style={{marginBottom: 0}} level={3}>Change Nesting</Title>}
          placement="left"
          closeIcon={<ArrowLeftOutlined/>}
          maskClosable={false}
          mask={false}
          onClose={() => {
            setNestingDrawerVisible(false);
            setDraggedAttr('');
            setDropTargetAttr('');
          }}
          visible={nestingDrawerVisible}
          push={false}
          width={580}
        >
          <div style={{ padding: '0 4px 12px' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.25fr 1fr 96px',
                gap: 8,
                marginBottom: 8,
                color: '#666',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}
            >
              <div>Predicate</div>
              <div>Relationships</div>
              <div style={{ textAlign: 'right' }}>Nesting</div>
            </div>

            {normalizedNesting.order.length === 0 && (
              <div style={{ color: '#888' }}>No predicates available for nesting.</div>
            )}

            {normalizedNesting.order.map((attr, index) => {
              const level = normalizedNesting.levels[attr] || 0;
              const mode = normalizePredicateMode(normalizedNesting.modes[attr]);
              const relationAttrs = relationshipMap[attr] || [];
              const levelColor = NESTING_LEVEL_COLORS[level % NESTING_LEVEL_COLORS.length];
              const indentOffset = Math.min(level, 6) * 12;
              const isDropTarget = dropTargetAttr === attr && draggedAttr && draggedAttr !== attr;
              const canIndentRight = index === 0 || level < ((normalizedNesting.levels[normalizedNesting.order[index - 1]] || 0) + 1);

              return (
                <React.Fragment key={`nest-${attr}`}>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 6px' }}>
                    <Button
                      size="small"
                      type={mode === 'OR' ? 'primary' : 'default'}
                      style={mode === 'OR' ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16', fontWeight: 600 } : { fontWeight: 600 }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePredicateMode(attr);
                      }}
                    >
                      {mode}
                    </Button>
                  </div>

                  <div
                    draggable
                    onDragStart={(event) => {
                      setDraggedAttr(attr);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (draggedAttr && draggedAttr !== attr) {
                        setDropTargetAttr(attr);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDropOnAttribute(attr);
                    }}
                    onDragEnd={() => {
                      setDraggedAttr('');
                      setDropTargetAttr('');
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.25fr 1fr 96px',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 8,
                      marginLeft: indentOffset,
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: isDropTarget ? '1px dashed #1677ff' : '1px solid #e5e5e5',
                      background: levelColor,
                      boxShadow: isDropTarget ? '0 0 0 2px rgba(22, 119, 255, 0.12)' : 'none',
                      cursor: 'grab'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                      <DragOutlined style={{ color: '#777', marginRight: 8, flexShrink: 0 }} />
                      <Tooltip title={`Nesting level ${level}`}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            minWidth: 18,
                            borderRadius: '50%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1f1f1f',
                            border: '1px solid #bfbfbf',
                            background: '#fff',
                            marginRight: 8,
                            flexShrink: 0
                          }}
                        >
                          {level}
                        </span>
                      </Tooltip>
                      <span style={{
                        display: 'inline-block',
                        maxWidth: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        paddingLeft: 0,
                        fontWeight: 600,
                        color: '#1f1f1f'
                      }}>
                        {attr}
                      </span>
                    </div>

                    <div style={{ minHeight: 24, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
                      {relationAttrs.length > 0 ? relationAttrs.map((peerAttr) => (
                        <Tag key={`${attr}-rel-${peerAttr}`} color="gold" style={{ marginRight: 0 }}>
                          LINK {peerAttr}
                        </Tag>
                      )) : (
                        <span style={{ color: '#8c8c8c', fontSize: 12 }}>No links</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                      <Tooltip title="Outdent">
                        <Button
                          size="small"
                          icon={<LeftOutlined />}
                          disabled={level === 0}
                          onClick={() => shiftIndentation(attr, -1)}
                        />
                      </Tooltip>
                      <Tooltip title="Indent">
                        <Button
                          size="small"
                          icon={<RightOutlined />}
                          disabled={!canIndentRight}
                          onClick={() => shiftIndentation(attr, 1)}
                        />
                      </Tooltip>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            {normalizedNesting.order.length > 0 && (
              <div style={{ marginTop: 12, color: '#666', fontSize: 12 }}>
                Drag rows to reorder predicates. Connector buttons between predicates switch AND/OR, and indentation controls bracket grouping in the generated query.
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                background: '#ffffff',
                padding: 10,
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: 11, color: '#595959', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                Expression Tree
              </div>
              <div ref={expressionTreeContainerRef} style={{ height: 300, width: '100%', borderRadius: 6, overflow: 'hidden', background: 'linear-gradient(180deg, #fffdfa 0%, #fafafa 100%)', position: 'relative' }}>
                {expressionTreeGraph.elements.length > 0 ? (
                  <ReactFlowProvider>
                    <ReactFlow
                      elements={expressionTreeElements}
                      nodeTypes={expressionTreeGraph.nodeTypes}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      elementsSelectable={false}
                      zoomOnScroll
                      panOnScroll={false}
                      zoomOnDoubleClick={false}
                      minZoom={0.45}
                      maxZoom={1.6}
                      onLoad={(instance) => {
                        setExpressionTreeInstance(instance);
                        instance.fitView({ padding: 0.25 });
                      }}
                      style={{ background: 'transparent' }}
                    >
                      <Background gap={18} size={1} color="#f0f0f0" />
                    </ReactFlow>

                    {/* Drag-capture overlay: prevents events reaching underlying main graph while dragging */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: treeDragState.attr ? 60 : -1,
                        pointerEvents: treeDragState.attr ? 'all' : 'none'
                      }}
                      onPointerMove={(e) => {
                        if (treeDragState.attr) handleExpressionTreePointerMove(e);
                      }}
                      onPointerUp={() => {
                        if (treeDragState.attr) handleExpressionTreePointerUp();
                      }}
                      onPointerCancel={() => {
                        if (treeDragState.attr) handleExpressionTreePointerUp();
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                    />

                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        zIndex: 20
                      }}
                    >
                      <Tooltip title="Zoom in">
                        <Button
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={zoomExpressionTreeIn}
                          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                        />
                      </Tooltip>
                      <Tooltip title="Zoom out">
                        <Button
                          size="small"
                          icon={<MinusOutlined />}
                          onClick={zoomExpressionTreeOut}
                          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                        />
                      </Tooltip>
                      <Tooltip title="Reset view">
                        <Button
                          size="small"
                          icon={<HomeOutlined />}
                          onClick={resetExpressionTreeView}
                          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                        />
                      </Tooltip>
                    </div>
                  </ReactFlowProvider>
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c8c8c', fontSize: 12 }}>
                    No predicates available for the expression tree.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                border: '1px solid #e5e5e5',
                borderRadius: 8,
                background: '#fafafa',
                padding: 10,
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
            >
              <div style={{ fontSize: 11, color: '#595959', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
                Live Query Preview
              </div>
              <CodeMirror
                value={previewQueryText}
                height="120px"
                extensions={[StreamLanguage.define(cypher), EditorView.lineWrapping]}
                readOnly
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        </Drawer>

      </Drawer>
  );
}

export default NodePredicateModal
