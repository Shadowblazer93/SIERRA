import React, { useContext, useState, useEffect, useRef } from 'react';
import ReactFlow, { ReactFlowProvider, Handle, getMarkerEnd, getBezierPath } from 'react-flow-renderer';
import { Typography, Tooltip, List, Button, Radio } from 'antd';
import { EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import { BsArrowsAngleExpand } from 'react-icons/bs';
import { Context } from '../../Store';
import NodePredicateModal from '../NodePredicateModal';
import './index.css';

const api = require('../../neo4jApi');
const { Title, Text } = Typography;

const SimpleNode = ({ data }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [propData, setPropData] = useState([]);

  useEffect(() => {
    if (modalVisible && propData.length === 0 && data.fullLabel) {
      api.fetchPropertyValues(data.fullLabel).then(setPropData);
    }
  }, [modalVisible, data.fullLabel, propData.length]);

  const dnfRows = (data.dnf || []).filter(r => r.predicates && r.predicates.length > 0);
  const hasDNF = dnfRows.length > 0;

  const getConflicts = (predicates) => {
    const conflicts = [];
    const byAttr = {};
    
    predicates.forEach(p => {
        if (!byAttr[p.attr]) byAttr[p.attr] = [];
        const val = (p.val && typeof p.val === 'object' && 'low' in p.val) ? p.val.low : p.val;
        byAttr[p.attr].push({ op: p.op, val });
    });

    Object.keys(byAttr).forEach(attr => {
        const preds = byAttr[attr];
        const parsedPreds = preds.map(p => ({
            op: p.op,
            val: (typeof p.val === 'number') ? p.val : (isNaN(Number(p.val)) ? p.val : Number(p.val))
        }));

        const eqs = parsedPreds.filter(p => p.op === '=');
        const neqs = parsedPreds.filter(p => p.op === '<>' || p.op === '!=');
        const gts = parsedPreds.filter(p => p.op === '>' || p.op === '>=');
        const lts = parsedPreds.filter(p => p.op === '<' || p.op === '<=');

        if (eqs.length > 1) {
            const firstVal = eqs[0].val;
            if (eqs.some(p => p.val !== firstVal)) conflicts.push(`Conflict: ${attr} has multiple equality values`);
        }

        eqs.forEach(eq => {
            if (neqs.some(neq => neq.val === eq.val)) conflicts.push(`Conflict: ${attr} = ${eq.val} AND ${attr} != ${eq.val}`);
        });

        gts.forEach(gt => {
            lts.forEach(lt => {
                let isConflict = false;
                if (gt.op === '>' && lt.op === '<' && gt.val >= lt.val) isConflict = true;
                else if (gt.op === '>=' && lt.op === '<' && gt.val >= lt.val) isConflict = true;
                else if (gt.op === '>' && lt.op === '<=' && gt.val >= lt.val) isConflict = true;
                else if (gt.op === '>=' && lt.op === '<=' && gt.val > lt.val) isConflict = true;
                
                if (isConflict) conflicts.push(`Conflict: Impossible range for ${attr}`);
            });
        });

        eqs.forEach(eq => {
            gts.forEach(gt => {
                if ((gt.op === '>' && eq.val <= gt.val) || (gt.op === '>=' && eq.val < gt.val)) {
                    conflicts.push(`Conflict: ${attr}=${eq.val} not in range`);
                }
            });
            lts.forEach(lt => {
                if ((lt.op === '<' && eq.val >= lt.val) || (lt.op === '<=' && eq.val > lt.val)) {
                    conflicts.push(`Conflict: ${attr}=${eq.val} not in range`);
                }
            });
        });
    });
    
    return conflicts;
  };

  let hasConflict = false;
  const tooltipContent = hasDNF ? (
    <div>
      {dnfRows.map((row, i) => {
         const conflicts = getConflicts(row.predicates);
         if (conflicts.length > 0) hasConflict = true;

         return (
            <div key={i} style={{ borderBottom: i < dnfRows.length - 1 ? '1px solid #eee' : 'none', paddingBottom: 4, marginBottom: 4 }}>
              <div>
              {row.predicates.map(p => {
                 const val = (p.val && typeof p.val === 'object' && 'low' in p.val) ? p.val.low : p.val;
                 return `${p.attr} ${p.op} ${val}`;
              }).join(' AND ')}
              </div>
              {conflicts.map((c, ci) => (
                  <div key={ci} style={{ color: '#faad14', fontSize: 10 }}>
                      <WarningOutlined /> {c}
                  </div>
              ))}
            </div>
         );
      })}
    </div>
  ) : "Click to edit DNF";

  const baseColor = data.color || '#fff';

  return (
    <div className="simple-node" style={{ backgroundColor: baseColor, border: '2px solid rgba(0,0,0,0.4)', position: 'relative' }}>
      <Handle 
        type="target" 
        position="top" 
        style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} 
      />
      {data.label}
      <Handle 
        type="source" 
        position="top" 
        style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} 
      />
      
      {hasDNF && (
        <Tooltip title={tooltipContent}>
          <div 
            onClick={(e) => { e.stopPropagation(); setModalVisible(true); }}
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#fff', 
              border: `2px solid ${hasConflict ? '#faad14' : '#1890ff'}`,
              cursor: 'pointer',
              zIndex: 10,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {hasConflict && <span style={{color: '#faad14', fontSize: 10, fontWeight: 'bold', lineHeight: '10px'}}>!</span>}
          </div>
        </Tooltip>
      )}

      <NodePredicateModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        node={data.fullLabel}
        nodeId={data.nodeId}
        dnf={data.dnf}
        attributes={data.attributes || []}
        predicates={data.predicates || {}}
        propData={propData}
        targets={[]}
        addPredicate={() => {}}
        deletePredicate={() => {}}
        updatePredicate={() => {}}
        isJoin={false}
        setIsJoin={() => {}}
        currPos={[0,0]}
        onDeleteNode={() => {}}
      />
    </div>
  );
};

const JoinEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  arrowHeadType,
  markerEndId,
}) => {
  const edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId);
  
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data && data.label && (
        <foreignObject
          width={40}
          height={40}
          x={centerX - 20}
          y={centerY - 20}
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{ overflow: 'visible' }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
            {data.label}
          </div>
        </foreignObject>
      )}
    </>
  );
};

const SelfLoopEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  data,
  arrowHeadType,
  markerEndId,
}) => {
  const loopSize = 30;
  const x = targetX;
  const y = targetY;
  
  // Path: Move to Top Center, Curve up and around back to Top Center
  const path = `M ${x} ${y} 
                C ${x + loopSize} ${y - loopSize}, 
                  ${x - loopSize} ${y - loopSize}, 
                  ${x} ${y}`;

  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId);

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={path}
        markerEnd={markerEnd}
      />
      {data && data.label && (
        <foreignObject
          width={100}
          height={30}
          x={x - 50}
          y={y - loopSize - 25}
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {data.label}
          </div>
        </foreignObject>
      )}
    </>
  );
};

const JoinGraphView = ({ onEditLink }) => {
  const [state, dispatch] = useContext(Context);
  const [activeTab, setActiveTab] = useState('graph');
  const [showJoinView, setShowJoinView] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 490, height: 340 });
  const [nodeDataCache, setNodeDataCache] = useState({});
  const [linkWarnings, setLinkWarnings] = useState({});
  const nodePositions = useRef({});

  useEffect(() => {
    const checkLinks = async () => {
      const newWarnings = {};
      const neededLabels = new Set();
      
      state.predicateLinks.forEach(link => {
        const fromNode = state.nodes.find(n => n.id === link.from.nodeId);
        const toNode = state.nodes.find(n => n.id === link.to.nodeId);
        if (fromNode) neededLabels.add(fromNode.data.label);
        if (toNode) neededLabels.add(toNode.data.label);
      });

      // Fetch missing data
      const newDataCache = { ...nodeDataCache };
      let dataUpdated = false;
      
      await Promise.all(Array.from(neededLabels).map(async (label) => {
        if (!newDataCache[label]) {
          try {
             const data = await api.fetchPropertyValues(label);
             newDataCache[label] = data;
             dataUpdated = true;
          } catch (e) {
             console.error("Failed to fetch data for", label, e);
          }
        }
      }));

      if (dataUpdated) {
        setNodeDataCache(newDataCache);
      }

      // Check for conflicting joins
      const linksByPair = {};
      state.predicateLinks.forEach(link => {
          const n1 = link.from.nodeId;
          const a1 = link.from.attr;
          const n2 = link.to.nodeId;
          const a2 = link.to.attr;
          
          let key, op, isSwapped;
          if (n1 < n2 || (n1 === n2 && a1 <= a2)) {
              key = `${n1}:${a1}-${n2}:${a2}`;
              op = link.operator || '=';
              isSwapped = false;
          } else {
              key = `${n2}:${a2}-${n1}:${a1}`;
              op = link.operator || '=';
              isSwapped = true;
          }
          
          let normalizedOp = op;
          if (isSwapped) {
              if (op === '>') normalizedOp = '<';
              else if (op === '<') normalizedOp = '>';
              else if (op === '>=') normalizedOp = '<=';
              else if (op === '<=') normalizedOp = '>=';
          }
          
          if (!linksByPair[key]) linksByPair[key] = [];
          linksByPair[key].push({ link, op: normalizedOp });
      });

      Object.values(linksByPair).forEach(group => {
          if (group.length < 2) return;
          
          const ops = new Set(group.map(g => g.op));
          let conflict = false;
          
          const hasEq = ops.has('=');
          const hasNeq = ops.has('<>') || ops.has('!=');
          const hasGt = ops.has('>');
          const hasLt = ops.has('<');
          const hasGte = ops.has('>=');
          const hasLte = ops.has('<=');

          if (hasEq && (hasNeq || hasGt || hasLt)) conflict = true;
          if (hasGt && (hasLt || hasLte)) conflict = true;
          if (hasLt && (hasGt || hasGte)) conflict = true;
          
          if (conflict) {
              group.forEach(item => {
                  const link = item.link;
                  const linkKey = `${link.from.nodeId}-${link.from.attr}-${link.to.nodeId}-${link.to.attr}`;
                  newWarnings[linkKey] = 'Conflicting joins';
              });
          }
      });

      // Check intersections
      state.predicateLinks.forEach(link => {
        const linkKey = `${link.from.nodeId}-${link.from.attr}-${link.to.nodeId}-${link.to.attr}`;
        if (newWarnings[linkKey]) return;

        const fromNode = state.nodes.find(n => n.id === link.from.nodeId);
        const toNode = state.nodes.find(n => n.id === link.to.nodeId);
        
        if (fromNode && toNode) {
            const dataA = newDataCache[fromNode.data.label] || nodeDataCache[fromNode.data.label];
            const dataB = newDataCache[toNode.data.label] || nodeDataCache[toNode.data.label];
            
            if (dataA && dataB) {
                const valuesA = new Set(dataA.map(d => d[link.from.attr]).filter(v => v !== undefined && v !== null));
                const valuesB = new Set(dataB.map(d => d[link.to.attr]).filter(v => v !== undefined && v !== null));
                
                // Check for intersection
                let hasIntersection = false;
                for (let elem of valuesA) {
                    if (valuesB.has(elem)) {
                        hasIntersection = true;
                        break;
                    }
                }
                
                if (!hasIntersection) {
                    newWarnings[linkKey] = 'No matching values';
                }
            }
        }
      });
      
      setLinkWarnings(newWarnings);
    };

    if (showJoinView) {
        checkLinks();
    }
  }, [state.predicateLinks, state.nodes, showJoinView]);

  const handleResizeMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const onMouseMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX; // Dragging left increases width
      const deltaY = startY - moveEvent.clientY; // Dragging up increases height
      setDimensions({
        width: Math.max(300, startWidth + deltaX),
        height: Math.max(200, startHeight + deltaY)
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Helper to get node label (letter)
  const getNodeLabel = (id) => {
    const node = state.nodes.find(n => n.id === id);
    return node ? (node.data.rep || (parseInt(node.id) + 10).toString(36)) : '?';
  };

  // Map nodes
  const nodes = state.nodes.map(node => {
    if (!nodePositions.current[node.id]) {
      let x, y;
      let overlap = true;
      let attempts = 0;
      while (overlap && attempts < 50) {
        x = (Math.random() - 0.5) * 400;
        y = (Math.random() - 0.5) * 300;
        overlap = false;
        for (const key in nodePositions.current) {
          const pos = nodePositions.current[key];
          const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
          if (dist < 50) {
            overlap = true;
            break;
          }
        }
        attempts++;
      }
      nodePositions.current[node.id] = { x, y };
    }

    return {
      id: node.id,
      type: 'simpleNode',
      position: nodePositions.current[node.id],
      data: { 
        label: node.data.rep || (parseInt(node.id) + 10).toString(36), // Fallback if rep not set yet
        color: node.color,
        fullLabel: node.data.label,
        nodeId: node.id,
        dnf: node.data.dnf,
        attributes: node.data.attributes,
        predicates: node.data.predicates
      },
    };
  });

  // Map normal edges
  const edges = state.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'default',
    style: { stroke: '#b1b1b7', strokeWidth: 2 },
    animated: false,
  }));

  // Group links by source-target pair to handle multiple joins
  const groupedLinks = {};
  state.predicateLinks.forEach((link) => {
    const ids = [link.from.nodeId, link.to.nodeId].sort();
    const key = ids.join('-');
    if (!groupedLinks[key]) {
      groupedLinks[key] = [];
    }
    groupedLinks[key].push(link);
  });

  // Map join edges (grouped)
  const joinEdges = Object.keys(groupedLinks).map((key, i) => {
    const links = groupedLinks[key];
    const isMulti = links.length > 1;
    
    // Determine if any link is Theta Join to decide color
    const isTheta = links.some(link => link.joinType === 'Theta Join');
    
    const [sourceId, targetId] = key.split('-');
    const isSelfLoop = sourceId === targetId;

    let labelContent;
    let tooltipContent;
    let hasWarning = false;

    if (isMulti) {
      labelContent = links.length;
      tooltipContent = (
        <div>
          {links.map((link, idx) => {
            const fromLabel = getNodeLabel(link.from.nodeId);
            const toLabel = getNodeLabel(link.to.nodeId);
            const op = link.operator || '=';
            const linkKey = `${link.from.nodeId}-${link.from.attr}-${link.to.nodeId}-${link.to.attr}`;
            const warningMsg = linkWarnings[linkKey];
            if (warningMsg) hasWarning = true;

            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {warningMsg && <WarningOutlined style={{ color: '#faad14' }} />}
                {fromLabel}.{link.from.attr} {op} {toLabel}.{link.to.attr}
                {warningMsg && <span style={{color: '#faad14', fontSize: 10}}>({warningMsg})</span>}
              </div>
            );
          })}
        </div>
      );
    } else {
      const link = links[0];
      const fromLabel = getNodeLabel(link.from.nodeId);
      const toLabel = getNodeLabel(link.to.nodeId);
      const linkKey = `${link.from.nodeId}-${link.from.attr}-${link.to.nodeId}-${link.to.attr}`;
      const warningMsg = linkWarnings[linkKey];
      if (warningMsg) hasWarning = true;

      labelContent = (link.joinType === 'Theta Join') ? (link.operator || 'θ') : '=';
      tooltipContent = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {hasWarning && <WarningOutlined style={{ color: '#faad14' }} />}
            {fromLabel}.{link.from.attr} {link.operator || '='} {toLabel}.{link.to.attr}
            {hasWarning && <div style={{color: '#faad14', fontSize: 10}}>({warningMsg})</div>}
        </div>
      );
    }
    
    const labelElement = (
      <div style={{ width: 20, height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <Tooltip title={tooltipContent}>
          <div style={{ 
            width: 18,
            height: 18,
            borderRadius: 9,
            background: 'white',
            border: `2px solid ${hasWarning ? '#ff4d4f' : (isTheta ? '#faad14' : '#1890ff')}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: hasWarning ? '#ff4d4f' : (isTheta ? '#faad14' : '#1890ff'), 
            fontWeight: 800, 
            fontSize: 10,
            cursor: 'help',
            pointerEvents: 'all',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            {hasWarning ? '!' : labelContent}
          </div>
        </Tooltip>
      </div>
    );

    return {
      id: `join-group-${i}`,
      source: sourceId,
      target: targetId,
      type: isSelfLoop ? 'selfLoop' : 'joinEdge',
      style: { 
        stroke: isTheta ? '#faad14' : '#1890ff',
        strokeWidth: 3,
        strokeDasharray: isTheta ? '5,5' : '0'
      },
      data: { label: labelElement }, // Pass label to custom edge
      animated: true,
    };
  });

  const elements = [...nodes, ...edges, ...joinEdges];

  const onLoad = (reactFlowInstance) => {
    reactFlowInstance.fitView();
    reactFlowInstance.zoomTo(1.1);
  };

  const onNodeDragStop = (event, node) => {
    nodePositions.current[node.id] = node.position;
  };

  const handleDelete = (link) => {
    dispatch({
      type: 'DELETE_PREDICATE_LINK',
      payload: link
    });
  };

  if (state.nodes.length === 0) return null;

  return (
    <>
      <Button
        style={{
          position: 'fixed',
          top: 24,
          right: 310,
          zIndex: 1000,
          fontSize: 13,
          height: 32,
          borderRadius: 4,
          marginBottom: 0
        }}
        type="primary"
        onClick={() => setShowJoinView(v => !v)}
      >
        {showJoinView ? "Hide Join View" : "Show Join View"}
      </Button>

      {showJoinView && (
        <div 
          className="join-graph-container"
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          <div className="join-graph-header" style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Title level={5} style={{ margin: '0 0 0 16px' }}>Join View</Title>
            <Radio.Group value={activeTab} onChange={e => setActiveTab(e.target.value)} size="small">
              <Radio.Button value="graph">Graph</Radio.Button>
              <Radio.Button value="list">List</Radio.Button>
            </Radio.Group>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeTab === 'graph' && (
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
                <div className="join-graph-content" style={{ flex: 1 }}>
                  <ReactFlowProvider>
                    <ReactFlow
                      elements={elements}
                      nodeTypes={{ simpleNode: SimpleNode }}
                      edgeTypes={{ selfLoop: SelfLoopEdge, joinEdge: JoinEdge }}
                      onLoad={onLoad}
                      onNodeDragStop={onNodeDragStop}
                    />
                  </ReactFlowProvider>
                </div>
              </div>
            )}
            
            <div style={{ display: activeTab === 'list' ? 'block' : 'none', flex: 1, overflowY: 'auto' }}>
                <List
                  size="small"
                  dataSource={state.predicateLinks}
                  renderItem={link => {
                    const fromLabel = getNodeLabel(link.from.nodeId);
                    const toLabel = getNodeLabel(link.to.nodeId);
                    const isTheta = link.joinType === 'Theta Join';
                    const linkKey = `${link.from.nodeId}-${link.from.attr}-${link.to.nodeId}-${link.to.attr}`;
                    const warningMsg = linkWarnings[linkKey];
                    
                    return (
                      <List.Item
                        actions={[
                          <Button 
                            type="text" 
                            icon={<EditOutlined />} 
                            size="small" 
                            onClick={() => onEditLink && onEditLink(link)} 
                          />,
                          <Button 
                            type="text" 
                            danger 
                            icon={<DeleteOutlined />} 
                            size="small" 
                            onClick={() => handleDelete(link)} 
                          />
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Text style={{ fontSize: 12 }}>
                              {warningMsg && <Tooltip title={warningMsg}><WarningOutlined style={{ color: '#faad14', marginRight: 4 }} /></Tooltip>}
                              {fromLabel}.{link.from.attr} {link.operator || '='} {toLabel}.{link.to.attr}
                            </Text>
                          }
                          description={
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              {isTheta ? 'Theta Join' : 'Equi Join'}
                              {warningMsg && <span style={{color: '#faad14', marginLeft: 4}}>({warningMsg})</span>}
                            </Text>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
            </div>
          </div>

          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute',
              left: 0,
              cursor: 'nw-resize',
              padding: '5px',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <BsArrowsAngleExpand style={{fontSize: '14px', color: '#888', transform: 'rotate(90deg)'}} />
          </div>
        </div>
      )}
    </>
  );
};

export default JoinGraphView;
