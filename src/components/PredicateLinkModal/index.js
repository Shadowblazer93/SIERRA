import React, { useContext, useState, useEffect } from 'react';
import { Drawer, Typography, Button, Divider, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Context } from '../../Store';
import { OPERATORS } from '../../constants';

const { Title, Text } = Typography;
const { Option } = Select;

const PredicateLinkModal = ({
  visible,
  onClose,
  link,
  onDelete,
  onUpdate
}) => {
  const [joinType, setJoinType] = useState('Equi Join');
  const [operator, setOperator] = useState('=');

  useEffect(() => {
    if (link) {
      setJoinType(link.joinType || 'Equi Join');
      setOperator(link.operator || '=');
    }
  }, [link]);

  const { from, to } = link || {};

  const handleJoinTypeChange = (value) => {
    setJoinType(value);
    if (onUpdate) {
      onUpdate({ ...link, joinType: value, operator });
    }
  };

  const handleOperatorChange = (value) => {
    setOperator(value);
    if (onUpdate) {
      onUpdate({ ...link, joinType, operator: value });
    }
  };

  return (
    <Drawer
      title={<Title style={{ marginBottom: 0 }} level={3}>Join Predicate</Title>}
      placement="left"
      closeIcon={<ArrowLeftOutlined />}
      onClose={onClose}
      visible={visible}
      push={false}
      maskClosable={false}
      mask={false}
      width={363}
    >
      {link && (
        <div style={{ padding: '0px 15px 10px' }}>
          <Text strong>Source</Text>
          <div style={{ marginBottom: 10 }}>
            <div>Node ID: {from.nodeId}</div>
            <div>Attribute: {from.attr}</div>
          </div>
          
          <Divider />
          
          <Text strong>Target</Text>
          <div style={{ marginBottom: 10 }}>
            <div>Node ID: {to.nodeId}</div>
            <div>Attribute: {to.attr}</div>
          </div>

          <Divider />

          <Text strong>Join Type</Text>
          <div style={{ marginTop: 10, marginBottom: 20 }}>
            <Select 
              value={joinType} 
              style={{ width: '100%' }} 
              onChange={handleJoinTypeChange}
            >
              <Option value="Equi Join">Equi Join</Option>
              <Option value="Theta Join">Theta Join</Option>
            </Select>
          </div>

          {joinType === 'Theta Join' && (
            <>
              <Text strong>Operator</Text>
              <div style={{ marginTop: 10, marginBottom: 20 }}>
                <Select
                  value={operator}
                  style={{ width: '100%' }}
                  onChange={handleOperatorChange}
                >
                  {OPERATORS.map(op => (
                    <Option key={op} value={op}>{op}</Option>
                  ))}
                </Select>
              </div>
            </>
          )}

          <Divider />

          <Button 
            danger 
            onClick={() => {
              if (onDelete) onDelete();
              onClose();
            }} 
            block
          >
            Delete Link
          </Button>
        </div>
      )}
    </Drawer>
  );
};

export default PredicateLinkModal;
