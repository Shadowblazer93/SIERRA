import React, { useState, useEffect, useLayoutEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button, Form, Input, Switch, Select, Space, Typography, Divider, Row, Col, Modal, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, RetweetOutlined, PlusOutlined, DeleteOutlined, DragOutlined, EyeInvisibleOutlined, UserOutlined, CheckCircleFilled, PlayCircleOutlined, QuestionCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { supabase } from '../../supabaseClient';
import './index.css';

const { Text } = Typography;
const { Option } = Select;

const QueryControls = forwardRef(({
  options,
  onOptionsChange,
  orRepresentation,
  onChangeOrRepresentation,
  reducedEdgeCrossing,
  onChangeReducedEdgeCrossing,
  dnfLinksVisible,
  onToggleDnfLinks,
  dnfAndGroupingEnabled,
  onToggleDnfAndGrouping,
  onVisibleChange,
  darkModeEnabled,
  onToggleDarkMode,
  darkThemePreset,
  onThemePresetChange,
  themePresets,
  onOpenHelpGuide
}, ref) => {
  const [limit, setLimit] = useState(options.limit || '');
  const [skip, setSkip] = useState(options.skip || '');
  const [distinct, setDistinct] = useState(options.distinct || false);
  const [returnClause, setReturnClause] = useState(options.returnClause || '');
  const [returnItems, setReturnItems] = useState([]);
  const containerRef = useRef(null);
  
  // Dragging State
  const [position, setPosition] = useState({ x: 50, y: 10 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [legendVisible, setLegendVisible] = useState(false);
  const [changePasswordVisible, setChangePasswordVisible] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordForm] = Form.useForm();
  const [accountLabel, setAccountLabel] = useState('');
  const supportedCypherFeatures = [
    'MATCH patterns (nodes + relationships)',
    'WHERE predicates with AND/OR (including DNF)',
    'Directed/undirected relationships + types',
    'Variable-length paths (hops)',
    'Equi and theta joins',
    'Aggregations + GROUP BY',
    'WITH projections',
    'RETURN DISTINCT',
    'Query Controls (ORDER BY, SKIP, LIMIT)'
  ];

  useImperativeHandle(ref, () => ({
    toggleQueryControls: () => setVisible((prev) => !prev),
    openQueryControls: () => setVisible(true),
    openSettings: () => setSettingsVisible(true),
    openLegend: () => setLegendVisible(true)
  }), []);

  // Parse return clause string into individual items
  const parseReturnClause = (clause) => {
    if (!clause || typeof clause !== 'string') return [];
    return clause
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map((item, idx) => ({ 
        field: item, 
        id: Math.random().toString(36).substr(2, 9) 
      }));
  };

  // Convert return items back to clause string
  const itemsToReturnClause = (items) => {
    return items.map(item => item.field).join(', ');
  };

  useEffect(() => {
    if (onVisibleChange) {
      onVisibleChange(visible);
    }
  }, [visible, onVisibleChange]);

  useEffect(() => {
    let isMounted = true;

    const loadAccountLabel = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!isMounted) return;
        const fullName = user?.user_metadata?.full_name;
        const email = user?.email;
        setAccountLabel(fullName || email || '');
      } catch (error) {
        if (!isMounted) return;
        setAccountLabel('');
      }
    };

    loadAccountLabel();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      const fullName = user?.user_metadata?.full_name;
      const email = user?.email;
      setAccountLabel(fullName || email || '');
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Array management for WITH and ORDER BY
  const [withClauses, setWithClauses] = useState(options.withClauses || []);
  const [orderBys, setOrderBys] = useState(options.orderBys || []);

  // Update effect
  useEffect(() => {
    setLimit(options.limit || '');
    setSkip(options.skip || '');
    setDistinct(options.distinct || false);
    setReturnClause(options.returnClause || '');
    
    // Parse return clause into items
    const items = parseReturnClause(options.returnClause || '');
    setReturnItems(items);
    
    // Ensure clauses have IDs for React keys to work properly during deletion
    const withs = (options.withClauses || []).map(w => ({ ...w, id: w.id || Math.random().toString(36).substr(2, 9) }));
    setWithClauses(withs);
    
    const orders = (options.orderBys || []).map(o => ({ ...o, id: o.id || Math.random().toString(36).substr(2, 9) }));
    setOrderBys(orders);
  }, [options]);

  // Drag Effects
  useEffect(() => {
    const clampPosition = (nextPosition) => {
      const containerWidth = containerRef.current?.offsetWidth || 275;
      const containerHeight = containerRef.current?.offsetHeight || 0;
      const maxX = Math.max(0, window.innerWidth - containerWidth);
      const maxY = Math.max(0, window.innerHeight - containerHeight);

      return {
        x: Math.min(Math.max(nextPosition.x, 0), maxX),
        y: Math.min(Math.max(nextPosition.y, 0), maxY)
      };
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition(clampPosition({
        x: e.clientX - dragOffset.x,
        y: dragOffset.y - e.clientY
      }));
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

  useLayoutEffect(() => {
    if (!visible || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth || 275;
    const containerHeight = containerRef.current.offsetHeight || 0;
    const maxX = Math.max(0, window.innerWidth - containerWidth);
    const maxY = Math.max(0, window.innerHeight - containerHeight);

    setPosition((current) => ({
      x: Math.min(current.x, maxX),
      y: Math.min(current.y, maxY)
    }));
  }, [visible, limit, skip, distinct, returnItems, withClauses, orderBys]);

  const handleMouseDown = (e) => {
    // Only drag if clicking the header area (we'll implement this in render)
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY + position.y
    });
  };

  const applyControls = () => {
    onOptionsChange({
        limit,
        skip,
        distinct,
        withClauses,
        orderBys,
        returnClause: itemsToReturnClause(returnItems)
    });
  };

  const handleChangePassword = async (values) => {
    try {
      setChangePasswordLoading(true);
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        message.error(error.message || 'Failed to update password');
        return;
      }
      message.success('Password updated successfully.');
      changePasswordForm.resetFields();
      setChangePasswordVisible(false);
    } catch (error) {
      message.error('An error occurred while updating your password');
      console.error('Update password error:', error);
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      window.location.href = '/auth';
    } catch (error) {
      message.error('Failed to log out');
      console.error('Logout error:', error);
    }
  };

  // Track whether local controls differ from incoming `options` (unsaved changes)
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const normalize = (opts) => ({
      limit: (opts && opts.limit) != null ? String(opts.limit) : '',
      skip: (opts && opts.skip) != null ? String(opts.skip) : '',
      distinct: !!(opts && opts.distinct),
      returnClause: (opts && opts.returnClause) || '',
      withClauses: (opts && opts.withClauses || []).map(w => ({ expression: w.expression || '', alias: w.alias || '' })),
      orderBys: (opts && opts.orderBys || []).map(o => ({ field: o.field || '', direction: o.direction || 'ASC' }))
    });

    const local = normalize({ limit, skip, distinct, returnClause: itemsToReturnClause(returnItems), withClauses, orderBys });
    const incoming = normalize(options || {});

    try {
      setDirty(JSON.stringify(local) !== JSON.stringify(incoming));
    } catch (e) {
      setDirty(true);
    }
  }, [limit, skip, distinct, returnItems, withClauses, orderBys, options]);

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

  // RETURN Handlers
  const addReturnItem = () => {
    setReturnItems([...returnItems, { field: '', id: Math.random().toString(36).substr(2, 9) }]);
  };
  const removeReturnItem = (index) => {
    const newItems = [...returnItems];
    newItems.splice(index, 1);
    setReturnItems(newItems);
  };
  const updateReturnItem = (index, value) => {
    const newItems = [...returnItems];
    newItems[index].field = value;
    setReturnItems(newItems);
  };

  if (!visible) {
    return (
      <>
            <Modal
              title="Settings"
              visible={settingsVisible}
              onCancel={() => setSettingsVisible(false)}
              footer={null}
              centered
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: -15 }}>
                {/* <Text strong style={{fontSize:18, color:'#606060'}}>Help</Text> */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    type="default"
                    icon={<QuestionCircleOutlined style={{ display: 'flex', alignItems: 'center' }} />}
                    style={{ background: '#1890ff', color: 'white', flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      if (onOpenHelpGuide) onOpenHelpGuide();
                      setSettingsVisible(false);
                    }}
                  >
                    Guide
                  </Button>
                  <Button
                    type="default"
                    icon={<InfoCircleOutlined style={{ display: 'flex', alignItems: 'center' }} />}
                    style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => {
                      setLegendVisible(true);
                      setSettingsVisible(false);
                    }}
                  >
                    Info
                  </Button>
                  <Button
                    type="default"
                    icon={<PlayCircleOutlined style={{ display: 'flex', alignItems: 'center' }} />}
                    style={{ background: '#cc181e', color: 'white',flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => window.open('https://youtu.be/oqaR1wn9LQk?si=5FXNKCol68-TCjBI', '_blank')}
                  >
                    Demo Video
                  </Button>
                </div>
                <Divider style={{ margin: '0' }} />
                <Text strong style={{fontSize:18, color:'#606060'}}>Website</Text>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Dark Mode</Text>
                  </div>
                  <Switch
                    checked={!!darkModeEnabled}
                    onChange={(checked) => onToggleDarkMode && onToggleDarkMode(checked)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Theme</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Dark Reader preset.
                    </Text>
                  </div>
                  <Select
                    value={darkThemePreset || 'default'}
                    onChange={(value) => onThemePresetChange && onThemePresetChange(value)}
                    size="small"
                    style={{ width: 180 }}
                    disabled={!darkModeEnabled}
                  >
                    {(themePresets || []).map((preset) => (
                      <Option key={preset.id} value={preset.id}>
                        {preset.label || preset.id}
                      </Option>
                    ))}
                  </Select>
                </div>
                <Divider style={{ margin: '0' }} />
                <Text strong style={{fontSize:18, color:'#606060'}}>Graph</Text>
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
                    <Text strong>Reduced Edge Crossing</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Move linked predicates to the top to reduce edge crossing.
                    </Text>
                  </div>
                  <Switch
                    checked={!!reducedEdgeCrossing}
                    onChange={(checked) => onChangeReducedEdgeCrossing && onChangeReducedEdgeCrossing(checked)}
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
                    value={orRepresentation || 'sunflower'}
                    onChange={(value) => onChangeOrRepresentation && onChangeOrRepresentation(value)}
                    size="small"
                    style={{ width: 160 }}
                  >
                    <Option value="sunflower">Sunflower</Option>
                    <Option value="concentric-circles">Concentric circles</Option>
                  </Select>
                </div>
                <Divider style={{ margin: '0' }} />
                <Text strong style={{fontSize:18, color:'#606060'}}>Account</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserOutlined style={{ color: '#6b7280' }} />
                  <Text>
                    Logged in as {accountLabel || 'your account'}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Change Password</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Update your account password.
                    </Text>
                  </div>
                  <Button type="default" size="small" onClick={() => setChangePasswordVisible(true)}>
                    Change
                  </Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text strong>Log Out</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Sign out of SIERRA.
                    </Text>
                  </div>
                  <Button danger size="small" onClick={handleLogout}>
                    Log out
                  </Button>
                </div>
              </div>
            </Modal>
            <Modal
              title="Change Password"
              visible={changePasswordVisible}
              onCancel={() => {
                setChangePasswordVisible(false);
                changePasswordForm.resetFields();
              }}
              footer={null}
            >
              <Form form={changePasswordForm} layout="vertical" onFinish={handleChangePassword}>
                <Form.Item
                  label="New password"
                  name="password"
                  rules={[{ required: true, message: 'Please enter a new password' }]}
                >
                  <Input.Password placeholder="Enter a new password" />
                </Form.Item>
                <Form.Item
                  label="Confirm password"
                  name="confirm"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm your new password' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || value === getFieldValue('password')) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Passwords do not match'));
                      }
                    })
                  ]}
                >
                  <Input.Password placeholder="Confirm your new password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={changePasswordLoading} block>
                  Update password
                </Button>
              </Form>
            </Modal>
            <Modal
              title="Information"
              visible={legendVisible}
              onCancel={() => setLegendVisible(false)}
              footer={null}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Divider orientation="left" style={{ margin: '8px -20' }}>Graph Legend</Divider>
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
                <Divider orientation="left" style={{ margin: '8px -20' }}>Supported Cypher Features</Divider>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {supportedCypherFeatures.map((feature) => (
                    <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircleFilled style={{ color: '#52c41a' }} />
                      <Text>{feature}</Text>
                    </div>
                  ))}
                </div>
              </div>
            </Modal>
        </>
    );
  }

  return (
    <div 
        className="query-controls-container"
      ref={containerRef}
        style={{ 
            left: position.x, 
            bottom: position.y,
            right: 'auto',
            top: 'auto'
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
        
        <Row gutter={8} align="middle" justify="space-between">
             <Col><Text strong>RETURN</Text></Col>
             <Col>
                <Button size="small" type="dashed" onClick={addReturnItem} icon={<PlusOutlined />} />
             </Col>
        </Row>

        {returnItems.map((item, idx) => (
            <Row key={item.id || idx} gutter={4} style={{ marginBottom: 4 }} align="middle">
                <Col span={20}>
                    <Input 
                        placeholder="e.g., n, r, count(n)" 
                        value={item.field}
                        onChange={e => updateReturnItem(idx, e.target.value)}
                        size="small" 
                    />
                </Col>
                <Col span={4}>
                    <Button 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />} 
                        onClick={() => removeReturnItem(idx)} 
                    />
                </Col>
            </Row>
        ))}

        <Row gutter={8} align="middle" style={{ marginTop: 4 }}>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Direct edit:
            </Text>
            <Input 
                placeholder="n, r" 
                value={itemsToReturnClause(returnItems)} 
                onChange={e => {
                  setReturnClause(e.target.value);
                  setReturnItems(parseReturnClause(e.target.value));
                }}
                size="small"
                style={{ marginTop: 4 }}
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

        <Divider style={{ margin: '4px 0' }} />

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

        <div style={{ display: 'flex', flexDirection: 'column-reverse' }}>
          <Row gutter={8} align="middle" justify="space-between" style={{ marginTop: 4 }}>
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
        </div>

        <Button
          type="primary"
          block
          onClick={applyControls}
          icon={<RetweetOutlined />}
          style={{ marginTop: 8 }}
          disabled={!dirty}
        >
          Update Query
        </Button>
      </Space>
    </div>
  );
});

export default QueryControls;
