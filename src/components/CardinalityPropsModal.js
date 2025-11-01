import React, { useState, useEffect } from 'react';
import { Drawer, Input, Button, Space, Typography, Divider, InputNumber, Select } from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons'
import { COLORS_HEX } from '../constants';

const { Title } = Typography;
const { Option } = Select;

function getRandomColor() {
  // return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const idx = Math.floor(Math.random() * COLORS_HEX.length);
  return COLORS_HEX[idx];
}

const CardinalityPropsModal = ({
  visible,
  onClose,
  cardinalityProps,
  onSave,
  cardinality = { min: 1, max: 1 },
  onChangeCardinality
}) => {
  const [propsList, setPropsList] = useState(cardinalityProps || []);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newColor, setNewColor] = useState(getRandomColor());
  const [localCardinality, setLocalCardinality] = useState(cardinality);
  const [localOp, setLocalOp] = useState(cardinality?.op ?? '=');

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
    setPropsList([...propsList, { key: newKey, value: newValue, color: newColor }]);
    setNewKey('');
    setNewValue('');
    setNewColor(getRandomColor());
  };

  const removeProp = (idx) => {
    setPropsList(propsList.filter((_, i) => i !== idx));
  };

  const handleMinChange = (val) => {
    const newCard = { min: val ?? 1, max: 1 };
    setLocalCardinality(newCard);
    if (typeof onChangeCardinality === 'function') onChangeCardinality({ ...newCard, op: localOp });
  };

  const handleMaxChange = (val) => {
    const newCard = { min: 1, max: val ?? 1 };
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
            disabled={localCardinality?.max !== 1}
            onChange={handleMinChange}
            style={{width: 80}}
          />
          to
          <InputNumber
            min={0}
            value={localCardinality?.max ?? 1}
            disabled={localCardinality?.min !== 1}
            onChange={handleMaxChange}
            style={{width: 80}}
          />
          <Select value={localOp} onChange={handleOpChange} style={{ width: 80 }}>
            <Option value="=">{'='}</Option>
            <Option value=">">{'>'}</Option>
            <Option value="<">{'<'}</Option>
            <Option value="<>">{'!='}</Option>
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
            <span><b>{prop.key}</b>: {prop.value}</span>
            <Button size="small" danger onClick={() => removeProp(idx)}>Remove</Button>
          </div>
        ))}
        <hr style={{ width: '100%', margin: '12px 0' }} />
        
        <Title level={5} style={{ marginBottom: 0 }}>Add New Property</Title>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
            placeholder="Property Key"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            style={{ width: 120 }}
            />
            <Input
            placeholder="Property Value"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            style={{ width: 120 }}
            />
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
