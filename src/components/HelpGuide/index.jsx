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
      'Click on a node to change its properties',
      'Click on properties, choose the operator and value for predicates',
      'Double click a node to exclude it from the return statement'
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
          'Drag from a node\'s dot to another to form a relationship',
          'Click on the new line to access the relationship sidebar',
          'Select the relationship type and direction',
        ],
        showcaseKey: 'Edge Links'
      },
      {
        id: 'relationships-path-length',
        title: 'Path Length',
        summary: 'Specify exact or ranged hop counts for relationships.',
        usage: [
          'Open the relationship sidebar and set min/max hops',
          'Use exact values for fixed path lengths',
          'Use range mode to return queries with variable length'
        ],
        showcaseKey: 'Path Length'
      },
      {
        id: 'relationships-properties',
        title: 'Relationship Properties',
        summary: 'Filter relationships by their properties and metadata.',
        usage: [
          'Click "Relationship Properties" button in the relationship sidebar',
          'Add new relationship properties from the available ones',
          'Set operator, value and optionally property bubble colour'
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
          'Open a node\'s sidebar and pick an aggregation function.',
          'Optionally, add an alias to be used in the cypher query',
          'Add properties in the GROUP BY section'
        ],
        showcaseKey: 'Simple Aggregation'
      },
      {
        id: 'aggregations-pipeline',
        title: 'Pipeline Aggregation',
        summary: 'Filter aggregation results with HAVING-style conditions.',
        usage: [
          'Add an aggregation and click the filter icon to switch to pipeline mode',
          'Add a condition for the aggregation by choosing operator + value for comparison',
          'Use aliases for clearer HAVING rules'
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
          'Add two predicates with matching value types',
          'Select "JOIN" operation in the toolbar, then drag and drop two predicates together',
          'View the Join View Box to see if there are any errors in the join'
        ],
        showcaseKey: 'Equi Join'
      },
      {
        id: 'joins-theta',
        title: 'Theta Join',
        summary: 'Compare attributes with operators like >, <, or >=.',
        usage: [
          'Add two predicates with matching value types',
          'Select "JOIN" operation in the toolbar, then drag and drop two predicates together',
          'Click on the join and change the join type to "Theta Join". Select operator'
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
      'Select "OR Link" operation in the toolbar. Drag and drop two predicates to "OR" them',
      'Hover over the group of predicates to bring up the OR menu',
      'In the OR menu, you can choose which predicates to remove from the OR group'
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
          'Open a node\'s sidebar and select "Change Nesting"',
          'Click on the operators to toggle them, use the indent and outdent buttons to change nesting',
          'Drag and drop the capsules to re-order predicates in the formed query',
          'View the Live Query Preview at the bottom of the page to verify correctness'
        ],
        showcaseKey: 'Change Nesting'
      },
      {
        id: 'nesting-expression-tree',
        title: 'Expression Tree',
        summary: 'Visualize predicate logic as an expression tree to understand grouping and precedence.',
        usage: [
          'Open a node\'s sidebar and select "Change Nesting"',
          'Click on the operators to toggle them, use the indent and outdent buttons to change nesting',
          'Drag and drop the capsules to re-order predicates in the formed query',
          'TIP: you can do mass nesting by using the operator nesting buttons to nest everything under it'
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
          'Click on the query controls button (pencil icon) in the toolbar',
          'Click "+" to add new RETURN, WITH, ORDER BY clauses',
          'Edit query parameters then save changes by pressing "Update Query"'
        ],
        showcaseKey: 'Query Controls'
      },
      {
        id: 'ui-features-clipboard',
        title: 'Clipboard',
        summary: 'Copy, review, and reuse generated Cypher queries.',
        usage: [
          'Click on the clipboard button in the toolbar',
          'View history as well as saved queries. Click star to save a query',
          'Click the restore button on a query to bring it back into the graph'
        ],
        showcaseKey: 'Clipboard'
      },
      {
        id: 'ui-features-join-view-box',
        title: 'Join View Box',
        summary: 'Inspect join relationships and predicate link details.',
        usage: [
          'Click on the Join View button to see active joins in a mini-graph',
          'Hover over warnings or errors to view reasons for incorrect joins',
          'Click the list button to see, modify and remove all active joins'
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
