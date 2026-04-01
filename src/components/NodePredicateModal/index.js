import { Drawer, Button, Divider, Typography, Tooltip, Select, Input, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  PlusOutlined,
  FilterOutlined,
  LeftOutlined,
  RightOutlined,
  DragOutlined,
  SortAscendingOutlined
} from '@ant-design/icons';
import React, {useState, useContext, useMemo, useEffect} from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/stream-parser';
import { EditorView } from '@codemirror/view';
import { cypher } from '@codemirror/legacy-modes/mode/cypher';
import { PRED_COLOR_V2, OPERATORS } from '../../constants';
import { Context } from '../../Store';
import { PredicateDraw, PredicateCheckBox } from '../common';
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
  }, [visible]);

  const persistNestingState = (nextNestingState) => {
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'predicateNesting', newVal: nextNestingState },
    });
  };

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

    const emittedRoots = new Set();
    const orderedItems = [];

    (normalizedNesting.order || []).forEach((attr) => {
      const key = `${nodeId}_${attr}`;
      const root = orGroupRoots[key] || key;
      if (emittedRoots.has(root)) return;

      const expression = groupedExpressionByAttr[attr] || attrExpressionMap[attr];
      if (!expression) return;

      emittedRoots.add(root);
      orderedItems.push({
        expression,
        level: normalizedNesting.levels[attr] || 0,
        connector: normalizedNesting.modes[attr] || 'AND'
      });
    });

    return buildNestedExpression(orderedItems);
  }, [nodeId, normalizedNesting, predicates, state.nodes, state.orLinks]);

  const previewQueryText = nodePredicatePreview
    ? `WHERE ${nodePredicatePreview}`
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

  const togglePredicateMode = (attr) => {
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
          width={460}
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
