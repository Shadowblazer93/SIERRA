import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { ReactFlowProvider } from 'react-flow-renderer';
import { Button, Card, Layout, Modal, Space, Typography } from 'antd';
import Node from '../Node';
import CustomEdge from '../CustomEdge';
import PredicateLinkEdge from '../PredicateLinkEdge';
import OrLinkEdge from '../OrLinkEdge';
import AndLinkEdge from '../AndLinkEdge';
import { Context, initialState } from '../../Store';
import { buildOrGroupRoots } from '../../utils/orGroupRoots';
import guideMap from '../../guides.json';
import './index.css';

const FEATURES = [
  {
    id: 'pattern-matching',
    title: 'Basic Pattern Matching',
    summary: 'Build simple node and relationship patterns that translate directly into Cypher MATCH clauses.',
    usage: [
      'Add nodes and connect them with edges to form a pattern.',
      'Toggle bold nodes to include them in the RETURN clause.',
      'Use labels to target specific database entities.'
    ],
    showcaseKey: 'Basic Pattern Matching'
  },
  {
    id: 'relationships',
    title: 'Relationships',
    summary: 'Model how nodes connect using edge links, path lengths, and relationship properties.',
    usage: [
      'Connect nodes with edges to represent relationships.',
      'Use edge settings to define direction, type, and labels.',
      'Add properties to refine how relationships are matched.'
    ],
    showcaseKey: 'Relationships',
    children: [
      {
        id: 'relationships-edge-links',
        title: 'Edge Links',
        summary: 'Define the connections between nodes with directed or undirected links.',
        usage: [
          'Draw an edge between two nodes.',
          'Select the relationship type and direction.',
          'Use the edge modal to refine details.'
        ],
        showcaseKey: 'Edge Links'
      },
      {
        id: 'relationships-path-length',
        title: 'Path Length',
        summary: 'Specify exact or ranged hop counts for relationships.',
        usage: [
          'Open the edge modal and set min/max hops.',
          'Use exact values for fixed path lengths.',
          'Combine with predicates for advanced filtering.'
        ],
        showcaseKey: 'Path Length'
      },
      {
        id: 'relationships-properties',
        title: 'Relationship Properties',
        summary: 'Filter relationships by their properties and metadata.',
        usage: [
          'Add predicates on relationships.',
          'Use property filters to narrow matches.',
          'Combine relationship properties with node predicates.'
        ],
        showcaseKey: 'Relationship Properties'
      }
    ]
  },
  {
    id: 'aggregations',
    title: 'Aggregations',
    summary: 'Count, sum, average, and filter results with aggregations and HAVING rules.',
    usage: [
      'Open a node and add aggregations for the attributes.',
      'Optionally add conditions to create HAVING filters.',
      'Combine multiple aggregations in a single query.'
    ],
    showcaseKey: 'Aggregations',
    children: [
      {
        id: 'aggregations-simple',
        title: 'Simple Aggregation',
        summary: 'Add a quick COUNT, SUM, AVG, MIN, or MAX without extra conditions.',
        usage: [
          'Open a node and pick an aggregation function.',
          'Leave the condition empty to keep it simple.',
          'Add multiple aggregations to return more metrics.'
        ],
        showcaseKey: 'Simple Aggregation'
      },
      {
        id: 'aggregations-pipeline',
        title: 'Pipeline Aggregation',
        summary: 'Filter aggregation results with HAVING-style conditions.',
        usage: [
          'Add an aggregation with a condition (operator + value).',
          'Use aliases for clearer HAVING rules.',
          'Combine multiple conditional aggregations in one query.'
        ],
        showcaseKey: 'Pipeline Aggregation'
      }
    ]
  },
  {
    id: 'joins',
    title: 'Joins (Equi + Theta)',
    summary: 'Link predicates between nodes to compare attributes across different entities.',
    usage: [
      'Create a predicate on each node you want to compare.',
      'Use predicate links to select Equi or Theta joins.',
      'Pick the comparison operator to define the join rule.'
    ],
    showcaseKey: 'Joins (Equi + Theta)',
    children: [
      {
        id: 'joins-equi',
        title: 'Equi Join',
        summary: 'Match attributes with equality for exact joins.',
        usage: [
          'Create predicates on two nodes.',
          'Select Equi join to compare with =.',
          'Use for exact key-to-key matches.'
        ],
        showcaseKey: 'Equi Join'
      },
      {
        id: 'joins-theta',
        title: 'Theta Join',
        summary: 'Compare attributes with operators like >, <, or >=.',
        usage: [
          'Create predicates on two nodes.',
          'Select Theta join to choose the operator.',
          'Use for range-based or inequality matches.'
        ],
        showcaseKey: 'Theta Join'
      }
    ]
  },
  {
    id: 'or-links',
    title: 'OR Links',
    summary: 'Combine predicates with OR logic using visual links and grouping.',
    usage: [
      'Select predicates and connect them with OR links.',
      'Review the OR grouping halo around predicates.',
      'Mix OR with AND to build complex boolean filters.'
    ],
    showcaseKey: 'OR Links'
  },
  {
    id: 'nested-predicates',
    title: 'Nested Predicates',
    summary: 'Use nested predicate groups to construct advanced boolean logic.',
    usage: [
      'Open the predicate modal and create nested levels.',
      'Switch between AND / OR connectors per group.',
      'Toggle DNF mode to visualize the expanded expression.'
    ],
    showcaseKey: 'Nested Predicates'
  }
];

const flattenFeatures = (items) => items.reduce((acc, item) => {
  acc.push(item);
  if (Array.isArray(item.children)) {
    item.children.forEach((child) => acc.push(child));
  }
  return acc;
}, []);

const pickShowcase = (key) => {
  if (!guideMap || typeof guideMap !== 'object') return null;
  if (key && guideMap[key]) return guideMap[key];
  const values = Object.values(guideMap || {}).filter(Boolean);
  return values.length > 0 ? values[0] : null;
};

const buildShowcaseState = (showcase) => {
  const graph = showcase?.graph || {};
  const dnfHoverCount = Number.isFinite(graph.dnfHoverCount) ? graph.dnfHoverCount : 0;
  const dnfHovering = typeof graph.dnfHovering === 'boolean' ? graph.dnfHovering : dnfHoverCount > 0;

  return {
    ...initialState,
    nodes: Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph.edges) ? graph.edges : [],
    predicateLinks: Array.isArray(graph.predicateLinks) ? graph.predicateLinks : [],
    orLinks: Array.isArray(graph.orLinks) ? graph.orLinks : [],
    andLinks: Array.isArray(graph.andLinks) ? graph.andLinks : [],
    predDisplayStatus: graph.predDisplayStatus || initialState.predDisplayStatus,
    orRepresentation: graph.orRepresentation || initialState.orRepresentation,
    dnfMode: !!graph.dnfMode,
    dnfLinksVisible: !!graph.dnfLinksVisible,
    dnfAndGroupingEnabled: !!graph.dnfAndGroupingEnabled,
    dnfHoverCount,
    dnfHovering
  };
};

const MiniShowcaseGraph = ({ feature }) => {
  const reactFlowRef = useRef(null);
  const canvasRef = useRef(null);
  const noopDispatch = useCallback(() => {}, []);
  const [showcaseState, setShowcaseState] = useState(() => buildShowcaseState(pickShowcase(feature?.showcaseKey)));
  const showcase = useMemo(() => pickShowcase(feature?.showcaseKey), [feature?.showcaseKey]);

  useEffect(() => {
    setShowcaseState(buildShowcaseState(showcase));
  }, [showcase]);

  const fitShowcase = useCallback(() => {
    const instance = reactFlowRef.current;
    if (!instance || typeof instance.fitView !== 'function') return;
    instance.fitView({ padding: 0.2, includeHiddenNodes: false, duration: 0 });
  }, []);

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement || typeof ResizeObserver === 'undefined') return undefined;

    let frameId = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        fitShowcase();
      });
    });

    observer.observe(canvasElement);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [fitShowcase]);

  const orGroupRoots = useMemo(
    () => buildOrGroupRoots(showcaseState.nodes, showcaseState.orLinks),
    [showcaseState.nodes, showcaseState.orLinks]
  );

  const orGroupColors = useMemo(
    () => (showcase?.orGroupColors && typeof showcase.orGroupColors === 'object' ? showcase.orGroupColors : {}),
    [showcase]
  );

  const getOrGroupColor = useCallback(
    (groupId) => orGroupColors[groupId] || '#ff8c00',
    [orGroupColors]
  );

  const predicateLinkElements = useMemo(
    () => (showcaseState.predicateLinks || []).map((link, idx) => ({
      id: `predicate-link-${idx}`,
      source: link.from.nodeId,
      target: link.to.nodeId,
      sourceHandle: link.from.attr,
      targetHandle: link.to.attr,
      type: 'predicateLink',
      data: {
        fromAttr: link.from.attr,
        toAttr: link.to.attr,
        operator: link.operator,
        joinType: link.joinType
      }
    })),
    [showcaseState.predicateLinks]
  );

  const orLinkElements = useMemo(
    () => (showcaseState.orLinks || []).map((link, idx) => {
      const fromKey = `${link.from.nodeId}_${link.from.attr}`;
      const toKey = `${link.to.nodeId}_${link.to.attr}`;
      const sourceGroupId = orGroupRoots[fromKey];
      const targetGroupId = orGroupRoots[toKey];
      const isSameNode = String(link.from.nodeId) === String(link.to.nodeId);
      const isSameGroup = !!sourceGroupId && !!targetGroupId && sourceGroupId === targetGroupId;
      const orRepresentation = showcaseState.orRepresentation || 'sunflower';

      if (orRepresentation === 'sunflower' && isSameNode && isSameGroup) {
        return null;
      }

      const groupId = sourceGroupId || targetGroupId || fromKey;
      const groupColor = getOrGroupColor(groupId);

      return {
        id: `or-link-${idx}`,
        source: link.from.nodeId,
        target: link.to.nodeId,
        sourceHandle: link.from.attr,
        targetHandle: link.to.attr,
        type: 'orLink',
        data: {
          fromAttr: link.from.attr,
          toAttr: link.to.attr,
          orGroupId: groupId,
          orGroupColor: groupColor,
          sourceGroupId,
          targetGroupId,
          isSameGroup,
          orRepresentation,
          isGroupHovering: false,
          hideEdgeLabel: isSameNode && isSameGroup,
          opacity: 1
        }
      };
    }).filter(Boolean),
    [showcaseState.orLinks, showcaseState.orRepresentation, orGroupRoots, getOrGroupColor]
  );

  const andLinkElements = useMemo(
    () => (showcaseState.andLinks || []).map((link, idx) => ({
      id: `and-link-${idx}`,
      source: link.from.nodeId,
      target: link.to.nodeId,
      sourceHandle: link.from.attr,
      targetHandle: link.to.attr,
      type: 'andLink',
      data: {
        groupId: link.groupId,
        color: link.color,
        opacity: 1
      }
    })),
    [showcaseState.andLinks]
  );

  const edgeElements = useMemo(
    () => (showcaseState.edges || []).map((edge) => {
      const sourceNode = showcaseState.nodes.find((n) => n.id === edge.source);
      const targetNode = showcaseState.nodes.find((n) => n.id === edge.target);
      return {
        ...edge,
        data: {
          ...edge.data,
          isBold: edge.isBold,
          sourcePredicates: sourceNode?.data?.predicates || {},
          targetPredicates: targetNode?.data?.predicates || {}
        }
      };
    }),
    [showcaseState.edges, showcaseState.nodes]
  );

  const nodeElements = useMemo(
    () => (showcaseState.nodes || []).map((node) => ({
      ...node,
      data: {
        ...node.data,
        color: node.color,
        radius: node.radius,
        isBold: node.isBold,
        orGroupRoots
      }
    })),
    [showcaseState.nodes, orGroupRoots]
  );

  const elements = useMemo(
    () => nodeElements.concat(andLinkElements, edgeElements, predicateLinkElements, orLinkElements),
    [nodeElements, andLinkElements, edgeElements, predicateLinkElements, orLinkElements]
  );

  if (!showcase) {
    return <div className="help-guide-graph-empty">No showcase available.</div>;
  }

  return (
    <div className="help-guide-graph" ref={canvasRef}>
      <Context.Provider value={[showcaseState, noopDispatch]}>
        <ReactFlowProvider>
          <ReactFlow
            ref={reactFlowRef}
            elements={elements}
            nodeTypes={{ special: Node }}
            edgeTypes={{
              custom: CustomEdge,
              predicateLink: PredicateLinkEdge,
              orLink: OrLinkEdge,
              andLink: AndLinkEdge
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll
            zoomOnDoubleClick
            zoomOnPinch
            panOnScroll={false}
            panOnDrag
            onLoad={(instance) => {
              reactFlowRef.current = instance;
              const viewport = showcase?.viewport;
              if (viewport && typeof instance.setTransform === 'function') {
                instance.setTransform(viewport);
              }
              window.requestAnimationFrame(() => {
                fitShowcase();
              });
            }}
          />
        </ReactFlowProvider>
      </Context.Provider>
    </div>
  );
};

function HelpGuideModal({ visible, onClose }) {
  const [activeId, setActiveId] = useState(FEATURES[0]?.id);
  const flattened = useMemo(() => flattenFeatures(FEATURES), []);
  const featureIndex = useMemo(
    () => flattened.reduce((acc, feature) => {
      acc[feature.id] = feature;
      return acc;
    }, {}),
    [flattened]
  );
  const activeFeature = featureIndex[activeId] || FEATURES[0];

  useEffect(() => {
    if (!visible) return;
    setActiveId((current) => current || FEATURES[0]?.id);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      width={1180}
      className="help-guide-modal"
      bodyStyle={{ padding: 0 }}
      centered
      destroyOnClose
    >
      <Layout className="help-guide-layout">
        <Layout.Sider width={260} className="help-guide-sider">
          <div className="help-guide-sider-title">SIERRA Guide</div>
          <div className="help-guide-list">
            {FEATURES.map((feature) => (
              <div key={feature.id} className="help-guide-list-group">
                <button
                  type="button"
                  className={`help-guide-list-item${activeId === feature.id ? ' is-active' : ''}`}
                  onClick={() => setActiveId(feature.id)}
                >
                  {feature.title}
                </button>
                {Array.isArray(feature.children) ? (
                  <div className="help-guide-sublist">
                    {feature.children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        className={`help-guide-list-item help-guide-list-subitem${activeId === child.id ? ' is-active' : ''}`}
                        onClick={() => setActiveId(child.id)}
                      >
                        {child.title}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Layout.Sider>
        <Layout.Content className="help-guide-content">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {activeFeature?.title}
                </Typography.Title>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {activeFeature?.summary}
                </Typography.Paragraph>
                {Array.isArray(activeFeature?.children) && activeFeature.children.length > 0 ? (
                  <Space wrap>
                    {activeFeature.children.map((child) => (
                      <Button key={child.id} onClick={() => setActiveId(child.id)}>
                        {child.title}
                      </Button>
                    ))}
                  </Space>
                ) : null}
              </Space>
              <div className="help-guide-graph-wrapper">
                <MiniShowcaseGraph feature={activeFeature} />
              </div>
            </Card>
            <Card title="How to use it" className="help-guide-usage-card">
              <ul className="help-guide-details-list">
                {(activeFeature?.usage || []).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Card>
          </Space>
        </Layout.Content>
      </Layout>
    </Modal>
  );
}

export default HelpGuideModal;
