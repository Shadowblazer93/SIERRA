import React, { useState, useEffect } from 'react';
import { Button, Input, Switch, Select, Space, Typography, Divider, Row, Col, Modal } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, RetweetOutlined, PlusOutlined, DeleteOutlined, DragOutlined, EyeInvisibleOutlined, EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import './index.css';

const { Text } = Typography;
const { Option } = Select;

const QueryControls = ({
  options,
  onOptionsChange,
  orRepresentation,
  onChangeOrRepresentation,
  dnfLinksVisible,
  onToggleDnfLinks,
  dnfAndGroupingEnabled,
  onToggleDnfAndGrouping
}) => {
  const [limit, setLimit] = useState(options.limit || '');
  const [skip, setSkip] = useState(options.skip || '');
  const [distinct, setDistinct] = useState(options.distinct || false);
  const [returnClause, setReturnClause] = useState(options.returnClause || '');
  
  // Dragging State
  const [position, setPosition] = useState({ x: 45, y: window.innerHeight - 340 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);

  // Array management for WITH and ORDER BY
  const [withClauses, setWithClauses] = useState(options.withClauses || []);
  const [orderBys, setOrderBys] = useState(options.orderBys || []);

  // Update effect
  useEffect(() => {
    setLimit(options.limit || '');
    setSkip(options.skip || '');
    setDistinct(options.distinct || false);
    setReturnClause(options.returnClause || '');
    
    // Ensure clauses have IDs for React keys to work properly during deletion
    const withs = (options.withClauses || []).map(w => ({ ...w, id: w.id || Math.random().toString(36).substr(2, 9) }));
    setWithClauses(withs);
    
    const orders = (options.orderBys || []).map(o => ({ ...o, id: o.id || Math.random().toString(36).substr(2, 9) }));
    setOrderBys(orders);
  }, [options]);

  // Drag Effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleMouseDown = (e) => {
    // Only drag if clicking the header area (we'll implement this in render)
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const applyControls = () => {
    onOptionsChange({
        limit,
        skip,
        distinct,
        withClauses,
        orderBys,
        returnClause
    });
  };

  // WITH Handlers
  const addWithClause = () => {
    setWithClauses([...withClauses, { expression: '', alias: '', id: Math.random().toString(36).substr(2, 9) }]);
  };
  const removeWithClause = (index) => {
    const newClauses = [...withClauses];
    newClauses.splice(index, 1);
    setWithClauses(newClauses);
  };
  const updateWithClause = (index, field, value) => {
    const newClauses = [...withClauses];
    newClauses[index][field] = value;
    setWithClauses(newClauses);
  };

  // ORDER BY Handlers
  const addOrderBy = () => {
    setOrderBys([...orderBys, { field: '', direction: 'ASC', id: Math.random().toString(36).substr(2, 9) }]);
  };
  const removeOrderBy = (index) => {
    const newOrders = [...orderBys];
    newOrders.splice(index, 1);
    setOrderBys(newOrders);
  };
  const updateOrderBy = (index, field, value) => {
    const newOrders = [...orderBys];
    newOrders[index][field] = value;
    setOrderBys(newOrders);
  };

  if (!visible) {
    return (
        <div 
            style={{ 
                position: 'fixed',
                left: 45, 
                bottom: 10,
                zIndex: 1000
            }}
        >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button 
                  type="primary" 
                  shape="default" 
                  icon={<EditOutlined />} 
                  size="middle"
                  onClick={() => setVisible(true)}
                  style={{ cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
              <Button
                  type="default"
                  shape="default"
                  icon={<InfoCircleOutlined />}
                  size="middle"
                  onClick={() => setLegendVisible(true)}
                  style={{ cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              />
            </div>
            <Modal
              title="Graph Legend"
              visible={legendVisible}
              onCancel={() => setLegendVisible(false)}
              footer={null}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width="140" height="16">
                    <line
                      x1="4"
                      y1="8"
                      x2="136"
                      y2="8"
                      stroke="#7a3fb2"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                    />
                  </svg>
                  <Text>Join</Text>
                  <code style={{ background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>a.x = b.y</code>
                  <Text>(Left click)</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width="140" height="16" viewBox="0 0 140 16">
                    <defs>
                      <linearGradient id="legend-or" gradientUnits="userSpaceOnUse" x1="4" y1="8" x2="136" y2="8">
                        <stop offset="0%" stopColor="#ebfcff" />
                        <stop offset="100%" stopColor="#407c96" />
                      </linearGradient>
                    </defs>
                    <line
                      x1="4"
                      y1="8"
                      x2="136"
                      y2="8"
                      stroke="url(#legend-or)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <Text>OR</Text>
                  <code style={{ background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>a.x OR b.y</code>
                  <Text>(Right click)</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <svg width="140" height="16" viewBox="0 0 140 16">
                    <path
                      d="M 6 4 L 10 8 L 6 12 M 14 4 L 18 8 L 14 12 M 22 4 L 26 8 L 22 12 M 30 4 L 34 8 L 30 12 M 38 4 L 42 8 L 38 12 M 46 4 L 50 8 L 46 12 M 54 4 L 58 8 L 54 12 M 62 4 L 66 8 L 62 12 M 70 4 L 74 8 L 70 12 M 78 4 L 82 8 L 78 12 M 86 4 L 90 8 L 86 12 M 94 4 L 98 8 L 94 12 M 102 4 L 106 8 L 102 12 M 110 4 L 114 8 L 110 12 M 118 4 L 122 8 L 118 12 M 126 4 L 130 8 L 126 12"
                      stroke="#ea7e20"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <Text>AND</Text>
                  <code style={{ background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>a.x AND b.y</code>
                </div>
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Show DNF Links</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Toggle AND/OR DNF edges in the graph.
                    </Text>
                  </div>
                  <Switch
                    checked={!!dnfLinksVisible}
                    onChange={(checked) => onToggleDnfLinks && onToggleDnfLinks(checked)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Enable DNF Grouping by AND</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Group AND predicates into halos.
                    </Text>
                  </div>
                  <Switch
                    checked={!!dnfAndGroupingEnabled}
                    onChange={(checked) => onToggleDnfAndGrouping && onToggleDnfAndGrouping(checked)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>OR Representation</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Choose how OR predicate groups are drawn.
                    </Text>
                  </div>
                  <Select
                    value={orRepresentation || 'concentric-circles'}
                    onChange={(value) => onChangeOrRepresentation && onChangeOrRepresentation(value)}
                    size="small"
                    style={{ width: 160 }}
                  >
                    <Option value="concentric-circles">Concentric circles</Option>
                    <Option value="sunflower">Sunflower</Option>
                  </Select>
                </div>
              </div>
            </Modal>
        </div>
    );
  }

  return (
    <div 
        className="query-controls-container"
        style={{ 
            left: position.x, 
            top: position.y,
            right: 'auto', // Override CSS
            bottom: 'auto'  // Override CSS if set
        }}
    >
      <div 
        onMouseDown={handleMouseDown}
        style={{ 
            cursor: 'move', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            paddingBottom: 8,
            borderBottom: '1px solid #f0f0f0',
            marginBottom: 8
        }}
      >
        <Space>
            <DragOutlined style={{ color: '#999', display: 'block' }} />
            <Text strong>Query Controls</Text>
        </Space>
        <Button 
            type="text" 
            size="small" 
            icon={<EyeInvisibleOutlined />} 
            onClick={() => setVisible(false)} 
        />
      </div>
      
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        
        <Row gutter={8} align="middle">
             <Col span={8}><Text>RETURN</Text></Col>
             <Col span={16}>
                <Input 
                    placeholder="n, r" 
                    value={returnClause} 
                    onChange={e => setReturnClause(e.target.value)} 
                    size="small"
                />
             </Col>
        </Row>

        <Row gutter={8} align="middle" style={{ marginTop: 4 }}>
          <Col span={12}>
            <Space>
                <Switch 
                    size="small" 
                    checked={distinct} 
                    onChange={setDistinct} 
                />
                <Text>DISTINCT</Text>
            </Space>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0' }} />
        
        <Row gutter={8} align="middle" justify="space-between">
             <Col><Text strong>WITH</Text></Col>
             <Col>
                <Button size="small" type="dashed" onClick={addWithClause} icon={<PlusOutlined />} />
             </Col>
        </Row>
        
        {withClauses.map((clause, idx) => (
            <Row key={clause.id || idx} gutter={4} style={{ marginBottom: 4 }} align="middle">
                <Col span={10}>
                    <Input 
                        placeholder="Expression" 
                        value={clause.expression}
                        onChange={e => updateWithClause(idx, 'expression', e.target.value)}
                        size="small" 
                    />
                </Col>
                <Col span={2} style={{textAlign: 'center'}}><Text type="secondary">AS</Text></Col>
                <Col span={10}>
                    <Input 
                        placeholder="Alias" 
                        value={clause.alias}
                        onChange={e => updateWithClause(idx, 'alias', e.target.value)}
                        size="small" 
                    />
                </Col>
                <Col span={2}>
                    <Button 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => removeWithClause(idx)} 
                    />
                </Col>
            </Row>
        ))}

        <Row gutter={8} align="middle">
             <Col span={8}><Text>SKIP</Text></Col>
             <Col span={16}>
                <Input 
                    type="number" 
                    placeholder="0" 
                    value={skip} 
                    onChange={e => setSkip(e.target.value)} 
                    size="small"
                />
             </Col>
        </Row>

        <Row gutter={8} align="middle">
             <Col span={8}><Text>LIMIT</Text></Col>
             <Col span={16}>
                <Input 
                    type="number" 
                    placeholder="10" 
                    value={limit} 
                    onChange={e => setLimit(e.target.value)} 
                    size="small"
                />
             </Col>
        </Row>

        <Divider style={{ margin: '4px 0' }} />

        <Row gutter={8} align="middle" justify="space-between">
             <Col><Text strong>ORDER BY</Text></Col>
             <Col>
                <Button size="small" type="dashed" onClick={addOrderBy} icon={<PlusOutlined />} />
             </Col>
        </Row>
        
        {orderBys.map((order, idx) => (
            <Row key={order.id || idx} gutter={4} style={{ marginBottom: 4 }} align="middle">
                <Col span={14}>
                    <Input 
                        placeholder="Property" 
                        value={order.field}
                        onChange={e => updateOrderBy(idx, 'field', e.target.value)}
                        size="small"
                    />
                </Col>
                <Col span={8}>
                     <Space>
                        <Button 
                            size="small" 
                            type={order.direction === 'ASC' ? 'primary' : 'default'}
                            onClick={() => updateOrderBy(idx, 'direction', 'ASC')}
                            icon={<ArrowUpOutlined />}
                        />
                        <Button 
                            size="small" 
                            type={order.direction === 'DESC' ? 'primary' : 'default'}
                            onClick={() => updateOrderBy(idx, 'direction', 'DESC')}
                            icon={<ArrowDownOutlined />}
                        />
                     </Space>
                </Col>
                <Col span={2}>
                    <Button 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => removeOrderBy(idx)} 
                    />
                </Col>
            </Row>
        ))}

        <Button type="primary" block onClick={applyControls} icon={<RetweetOutlined />} style={{marginTop: 8}}>
            Update Query
        </Button>
      </Space>
    </div>
  );
};

export default QueryControls;
