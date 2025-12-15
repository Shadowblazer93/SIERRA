import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Input, Button, Space, Typography, Divider, InputNumber, Select } from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons'
import { COLORS_HEX, OPERATORS } from '../constants';

const { Title } = Typography;
const { Option } = Select;

function getRandomColor() {
  // return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const idx = Math.floor(Math.random() * COLORS_HEX.length);
  return COLORS_HEX[idx];
}

function formatValue(val) {
  if (val && typeof val === 'object' && 'low' in val && 'high' in val) {
    return val.low.toString();
  }
  return val;
}

const CardinalityPropsModal = ({
  visible,
  onClose,
  cardinalityProps,
  onSave,
  cardinality = { min: 1, max: 1 },
  onChangeCardinality,
  propData = []
}) => {
  const [propsList, setPropsList] = useState(cardinalityProps || []);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newOperator, setNewOperator] = useState('=');
  const [newColor, setNewColor] = useState(getRandomColor());
  const [localCardinality, setLocalCardinality] = useState(cardinality);
  const [localOp, setLocalOp] = useState(cardinality?.op ?? '=');

  const availableProperties = useMemo(() => {
    return Array.from(new Set(propData.flatMap(obj => Object.keys(obj))));
  }, [propData]);

  const availableValues = useMemo(() => {
    if (!newKey) return [];
    const values = propData
      .map(obj => formatValue(obj[newKey]))
      .filter(val => val !== undefined && val !== null);
    return Array.from(new Set(values));
  }, [newKey, propData]);

  useEffect(() => {
    setPropsList(cardinalityProps || []);
  }, [cardinalityProps, visible]);

  useEffect(() => {
    const incoming = { min: (cardinality?.min ?? 1), max: (cardinality?.max ?? 1), op: (cardinality?.op ?? '=') };
    // guard updates by comparing primitive values to avoid infinite loops
    if (
      localCardinality?.min !== incoming.min ||
      localCardinality?.max !== incoming.max ||
      localOp !== incoming.op
    ) {
      setLocalCardinality({ min: incoming.min, max: incoming.max });
      setLocalOp(incoming.op);
    }
  }, [cardinality, visible, localCardinality, localOp]);

  const addProp = () => {
    if (!newKey) return;
    setPropsList([...propsList, { key: newKey, value: newValue, color: newColor, operator: newOperator }]);
    setNewKey('');
    setNewValue('');
    setNewOperator('=');
    setNewColor(getRandomColor());
  };

  const removeProp = (idx) => {
    setPropsList(propsList.filter((_, i) => i !== idx));
  };

  const handleMinChange = (val) => {
    const newCard = { ...localCardinality, min: val ?? 1 };
    setLocalCardinality(newCard);
    if (typeof onChangeCardinality === 'function') onChangeCardinality({ ...newCard, op: localOp });
  };

  const handleMaxChange = (val) => {
    const newCard = { ...localCardinality, max: val ?? 1 };
    setLocalCardinality(newCard);
    if (typeof onChangeCardinality === 'function') onChangeCardinality({ ...newCard, op: localOp });
  };

  const resetCardinality = () => {
    const reset = { min: 1, max: 1 };
    setLocalCardinality(reset);
    setLocalOp('=');
    if (typeof onChangeCardinality === 'function') onChangeCardinality({ ...reset, op: '=' });
  };

  const handleOpChange = (val) => {
    setLocalOp(val);
    if (typeof onChangeCardinality === 'function') onChangeCardinality({ ...localCardinality, op: val });
  };

  const handleSave = () => {
    onSave(propsList);
    onClose();
  };

  return (
    <Drawer
      title={<Title style={{marginBottom: 0}}level={3}>Edit Relationship Properties</Title>}
      placement="left"
      closeIcon={<ArrowLeftOutlined />}
      onClose={onClose}
      visible={visible}
      push={false}
      maskClosable={false}
      mask={false}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            Cancel
          </Button>
          <Button type="primary" onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Title level={5} style={{ marginBottom: 0 }}>Cardinality</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <InputNumber
            min={0}
            value={localCardinality?.min ?? 1}
            disabled={localOp === '='}
            onChange={handleMinChange}
            style={{width: 80}}
          />
          to
          <InputNumber
            value={localCardinality?.max ?? 1}
            // disabled={localCardinality?.min !== 1}
            onChange={handleMaxChange}
            style={{width: 80}}
          />
          <Select value={localOp} onChange={handleOpChange} style={{ width: 80 }}>
            <Option value="=">{'='}</Option>
            <Option value="range">{'range'}</Option>
          </Select>
          <Button
            style={{marginLeft: 8}}
            onClick={resetCardinality}
          >
            Reset
          </Button>
        </div>
        <hr style={{ width: '100%', margin: '12px 0' }} />

        <Title level={5} style={{ marginBottom: 0 }}>Selected Properties</Title>
        {propsList.map((prop, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: prop.color || '#eee', border: '1px solid #333'
            }} />
            <span><b>{prop.key}</b> {prop.operator || '='} {formatValue(prop.value)}</span>
            <Button size="small" danger onClick={() => removeProp(idx)}>Remove</Button>
          </div>
        ))}
        <hr style={{ width: '100%', margin: '12px 0' }} />
        
        <Title level={5} style={{ marginBottom: 0 }}>Available Properties</Title>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {availableProperties.length > 0 ? (
            availableProperties.map(key => (
              <Button 
                key={key} 
                size="small" 
                onClick={() => { setNewKey(key); setNewValue(''); }}
              >
                {key}
              </Button>
            ))
          ) : (
            <span style={{ color: '#999' }}>No properties found in database.</span>
          )}
        </div>

        <Title level={5} style={{ marginBottom: 0 }}>Add New Property</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Select
              placeholder="Key"
              value={newKey || undefined}
              onChange={val => { setNewKey(val); setNewValue(''); }}
              style={{ width: 120 }}
              showSearch
            >
              {availableProperties.map(key => (
                <Option key={key} value={key}>{key}</Option>
              ))}
            </Select>
            <Select value={newOperator} onChange={setNewOperator} style={{ width: 60 }}>
              {OPERATORS.map(op => <Option key={op} value={op}>{op}</Option>)}
            </Select>
            <Select
              placeholder="Value"
              value={newValue || undefined}
              onChange={setNewValue}
              style={{ width: 120 }}
              showSearch
              disabled={!newKey}
            >
              {availableValues.map((val, i) => (
                <Option key={`${val}-${i}`} value={val}>{String(val)}</Option>
              ))}
            </Select>
            <Input
            type="color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            style={{ width: 40, padding: 0, border: 'none', background: 'none' }}
            />
      </div>
        <Button type="primary" onClick={addProp} disabled={!newKey}>Add Property</Button>
      </Space>
    </Drawer>
  );
};

export default CardinalityPropsModal
