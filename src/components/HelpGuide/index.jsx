import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Layout, Modal, Space, Typography } from 'antd';
import './index.css';

const buildGuideImageMap = () => {
  const guideImageContext = require.context('../../assets/guide', false, /\.(png|jpe?g|svg)$/i);
  return guideImageContext.keys().reduce((acc, key) => {
    const filename = key.replace('./', '');
    const basename = filename.replace(/\.[^/.]+$/, '');
    const moduleValue = guideImageContext(key);
    acc[basename.toLowerCase()] = moduleValue?.default || moduleValue;
    return acc;
  }, {});
};

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
    title: 'Joins',
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
    id: 'nesting',
    title: 'Nesting',
    summary: 'Create nested predicate groups and inspect their logical structure.',
    usage: [
      'Group predicates into nested levels.',
      'Use Change Nesting to rearrange groups.',
      'Review the Expression Tree for precedence.'
    ],
    showcaseKey: 'Nesting',
    children: [
      {
        id: 'nesting-change',
        title: 'Change Nesting',
        summary: 'Rearrange predicate groups to change boolean structure without rebuilding them.',
        usage: [
          'Open the predicate modal and select Change Nesting.',
          'Move predicates between groups to reshape logic.',
          'Confirm the updated grouping before closing.'
        ],
        showcaseKey: 'Change Nesting'
      },
      {
        id: 'nesting-expression-tree',
        title: 'Expression Tree',
        summary: 'Visualize predicate logic as an expression tree to understand grouping and precedence.',
        usage: [
          'Open the predicate modal to view the expression tree.',
          'Expand groups to inspect nested boolean structure.',
          'Use the tree to verify how predicates combine.'
        ],
        showcaseKey: 'Expression Tree'
      }
    ]
  },
  {
    id: 'ui-features',
    title: 'UI Features',
    summary: 'Navigate the interface and use helper panels to build and review queries faster.',
    usage: [
      'Use the controls bar to run, reset, or manage your query.',
      'Copy queries from the clipboard panel.',
      'Review join details in the join view box.'
    ],
    showcaseKey: 'UI Features',
    children: [
      {
        id: 'ui-features-query-controls',
        title: 'Query Controls',
        summary: 'Access the primary actions for running, saving, and clearing queries.',
        usage: [
          'Use the Run button to execute the query.',
          'Reset to clear the current graph.',
          'Open additional actions from the controls bar.'
        ],
        showcaseKey: 'Query Controls'
      },
      {
        id: 'ui-features-clipboard',
        title: 'Clipboard',
        summary: 'Copy, review, and reuse generated Cypher queries.',
        usage: [
          'Open the clipboard panel to view saved queries.',
          'Copy a query with one click.',
          'Paste into your editor or reuse later.'
        ],
        showcaseKey: 'Clipboard'
      },
      {
        id: 'ui-features-join-view-box',
        title: 'Join View Box',
        summary: 'Inspect join relationships and predicate link details.',
        usage: [
          'Open the join view to see active joins.',
          'Review join operators and matched fields.',
          'Use it to validate complex join logic.'
        ],
        showcaseKey: 'Join View Box'
      }
    ]
  }
];

const flattenFeatures = (items) => items.reduce((acc, item) => {
  acc.push(item);
  if (Array.isArray(item.children)) {
    item.children.forEach((child) => acc.push(child));
  }
  return acc;
}, []);

const getDefaultActiveId = () => {
  for (const feature of FEATURES) {
    if (Array.isArray(feature.children) && feature.children.length > 0) {
      return feature.children[0].id;
    }
    if (feature?.id) {
      return feature.id;
    }
  }
  return null;
};

const GuideImage = ({ title, guideImages }) => {
  const normalizedTitle = title ? title.toLowerCase() : '';
  const imageSrc = guideImages[normalizedTitle];

  if (!imageSrc) {
    return <div className="help-guide-image-placeholder">Image coming soon.</div>;
  }

  return <img className="help-guide-image" src={imageSrc} alt={`${title} guide`} />;
};

function HelpGuideModal({ visible, onClose }) {
  const [activeId, setActiveId] = useState(() => getDefaultActiveId());
  const [guideImages, setGuideImages] = useState({});
  const flattened = useMemo(() => flattenFeatures(FEATURES), []);
  const selectableFeatures = useMemo(
    () => flattened.filter((feature) => !Array.isArray(feature.children) || feature.children.length === 0),
    [flattened]
  );
  const featureIndex = useMemo(
    () => selectableFeatures.reduce((acc, feature) => {
      acc[feature.id] = feature;
      return acc;
    }, {}),
    [selectableFeatures]
  );
  const activeFeature = featureIndex[activeId] || featureIndex[getDefaultActiveId()];

  useEffect(() => {
    if (!visible) return;
    setActiveId((current) => (featureIndex[current] ? current : getDefaultActiveId()));
  }, [visible, featureIndex]);

  useEffect(() => {
    if (!visible) return;
    const images = buildGuideImageMap();
    setGuideImages(images);
    Object.values(images).forEach((src) => {
      const img = new Image();
      img.src = src;
    });
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
                {Array.isArray(feature.children) && feature.children.length > 0 ? (
                  <div className="help-guide-list-item is-parent">
                    {feature.title}
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`help-guide-list-item${activeId === feature.id ? ' is-active' : ''}`}
                    onClick={() => setActiveId(feature.id)}
                  >
                    {feature.title}
                  </button>
                )}
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
              </Space>
              <div className="help-guide-graph-wrapper">
                <GuideImage title={activeFeature?.title} guideImages={guideImages} />
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
