import React, { useState, useEffect, useMemo } from 'react';
import { Button, Select, Input, Space, Typography, Card, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { OPERATORS } from '../../constants';

const { Text } = Typography;
const { Option } = Select;

function formatValue(val) {
  if (val && typeof val === 'object' && 'low' in val && 'high' in val) {
    return val.low.toString();
  }
  return val;
}

const DNFBuilder = ({ attributes, propData, initialData, onSave }) => {
  const [rows, setRows] = useState(initialData || []);

  useEffect(() => {
      if (initialData) {
          setRows(initialData);
      }
  }, [initialData]);

  const handleSave = (newRows) => {
      setRows(newRows);
      onSave(newRows);
  };

  const addRow = () => {
    const newRows = [...rows, { id: Date.now(), predicates: [{ id: Date.now(), attr: undefined, op: '=', val: undefined }] }];
    handleSave(newRows);
  };

  const removeRow = (rowId) => {
    const newRows = rows.filter(r => r.id !== rowId);
    handleSave(newRows);
  };

  const addPredicate = (rowId) => {
    const newRows = rows.map(r => {
      if (r.id === rowId) {
        return { ...r, predicates: [...r.predicates, { id: Date.now(), attr: undefined, op: '=', val: undefined }] };
      }
      return r;
    });
    handleSave(newRows);
  };

  const removePredicate = (rowId, predId) => {
    const newRows = rows.map(r => {
      if (r.id === rowId) {
        const newPreds = r.predicates.filter(p => p.id !== predId);
        // If no predicates left, remove the row? Or keep empty? Let's keep empty for now or remove row if user wants.
        // Actually, if it's the last predicate, maybe we shouldn't remove it automatically, let user remove row.
        return { ...r, predicates: newPreds };
      }
      return r;
    });
    handleSave(newRows);
  };

  const updatePredicate = (rowId, predId, field, value) => {
    const newRows = rows.map(r => {
      if (r.id === rowId) {
        const newPreds = r.predicates.map(p => {
          if (p.id === predId) {
            return { ...p, [field]: value };
          }
          return p;
        });
        return { ...r, predicates: newPreds };
      }
      return r;
    });
    handleSave(newRows);
  };

  const getUniqueValues = (attr) => {
    if (!propData || !attr) return [];
    const values = propData
      .map(obj => formatValue(obj[attr]))
      .filter(val => val !== undefined && val !== null);
    return Array.from(new Set(values));
  };

  return (
    <div style={{ padding: '0 15px 10px' }}>
      {rows.map((row, rowIndex) => (
        <div key={row.id}>
          {rowIndex > 0 && <Divider>OR</Divider>}
          <Card 
            size="small" 
            title={`Clause ${rowIndex + 1}`} 
            extra={<Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRow(row.id)} />}
            style={{ marginBottom: 10, background: '#f9f9f9' }}
          >
            {row.predicates.map((pred, predIndex) => (
              <div key={pred.id} style={{ marginBottom: 8 }}>
                {predIndex > 0 && <div style={{ textAlign: 'center', fontSize: 10, color: '#999', margin: '4px 0' }}>AND</div>}
                <Space style={{ display: 'flex' }} align="start">
                  <Select
                    placeholder="Attribute"
                    style={{ width: 78 }}
                    value={pred.attr}
                    onChange={(val) => updatePredicate(row.id, pred.id, 'attr', val)}
                  >
                    {attributes.map(attr => (
                      <Option key={attr} value={attr}>{attr}</Option>
                    ))}
                  </Select>
                  <Select
                    value={pred.op}
                    style={{ width: 63 }}
                    onChange={(val) => updatePredicate(row.id, pred.id, 'op', val)}
                  >
                    {Object.keys(OPERATORS).map(op => (
                      <Option key={op} value={op}>{OPERATORS[op]}</Option>
                    ))}
                  </Select>
                  <Select
                    placeholder="Value"
                    style={{ width: 70 }}
                    value={formatValue(pred.val)}
                    onChange={(val) => updatePredicate(row.id, pred.id, 'val', val)}
                    disabled={!pred.attr}
                    showSearch
                  >
                    {getUniqueValues(pred.attr).map((val, i) => (
                      <Option key={`${val}-${i}`} value={val}>{String(val)}</Option>
                    ))}
                  </Select>
                  <Button 
                    icon={<DeleteOutlined />} 
                    danger 
                    size="small"
                    onClick={() => removePredicate(row.id, pred.id)}
                  />
                </Space>
              </div>
            ))}
            <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addPredicate(row.id)} style={{ marginTop: 8 }}>
              AND
            </Button>
          </Card>
        </div>
      ))}
      <Button type="primary" block icon={<PlusOutlined />} onClick={addRow}>
        Add OR Clause
      </Button>
    </div>
  );
};

export default DNFBuilder;
