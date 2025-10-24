import React, { useState, useEffect } from 'react';
import { Drawer, Input, Button, Space, Typography } from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons'
import { COLORS } from '../constants';

const { Title } = Typography;

function getRandomColor() {
  // return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const idx = Math.floor(Math.random() * COLORS.length);
  return COLORS[idx];
}

const CardinalityPropsModal = ({
  visible,
  onClose,
  cardinalityProps,
  onSave
}) => {
  const [propsList, setPropsList] = useState(cardinalityProps || []);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newColor, setNewColor] = useState(getRandomColor());

  useEffect(() => {
    setPropsList(cardinalityProps || []);
  }, [cardinalityProps, visible]);

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
    //   title={<Title level={4} style={{ margin: 0 }}>Edit Relationship Properties</Title>}
    //   placement="right"
    //   onClose={onClose}
    //   open={visible}
    //   width={350}
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
