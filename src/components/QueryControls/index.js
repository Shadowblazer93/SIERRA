import React, { useState, useEffect } from 'react';
import { Button, Input, Switch, Select, Space, Typography, Divider, Row, Col } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, RetweetOutlined, PlusOutlined, DeleteOutlined, DragOutlined, EyeInvisibleOutlined, EditOutlined } from '@ant-design/icons';
import './index.css';

const { Text } = Typography;
const { Option } = Select;

const QueryControls = ({ options, onOptionsChange }) => {
  const [limit, setLimit] = useState(options.limit || '');
  const [skip, setSkip] = useState(options.skip || '');
  const [distinct, setDistinct] = useState(options.distinct || false);
  const [returnClause, setReturnClause] = useState(options.returnClause || '');
  
  // Dragging State
  const [position, setPosition] = useState({ x: 45, y: window.innerHeight - 340 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

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
            <Button 
                type="primary" 
                shape="default" 
                icon={<EditOutlined />} 
                size="middle"
                onClick={() => setVisible(true)}
                style={{ cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
            />
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
