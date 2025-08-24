import { Drawer, Button, Typography, Divider, Card, Form, Select, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowLeftOutlined} from '@ant-design/icons';
import React, {useState, useEffect} from 'react';

const neo4j = require('neo4j-driver');

const {Title, Text} = Typography
const {Option} = Select;

const PredicateSelectorCard = ({
  removePredicate,
  handleChange,
  options,
  isInt,
  index,
  predVal,
}) => {
  // console.log('pv:', predVal)
  return (
    <Card
      style={{marginBottom: 8}}
      size="small"
      title={`Predicate ${index + 1}`}
      extra={
        <Button
          size="small"
          shape="circle"
          onClick={() => {
            removePredicate(index)
          }}
          icon={<DeleteOutlined />} />
      }>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <div>
              <Text style={{marginRight: 55, marginLeft: 4}}>Op</Text>
              <Text>Value</Text>
            </div>
            <div>
              <Select
                onSelect={(val) => {
                  handleChange(index, 0, val.value)
                }}
                labelInValue
                value={{value:`${predVal.op}` ?? "0"}}
                placeholder="Op"
                style={{width: 59, marginRight: 16}}
                size="small"
              >
                {isInt ? (
                  <>
                    <Option value="0">=</Option>
                    <Option value="1">&gt;</Option>
                    <Option value="2">&gt;=</Option>
                    <Option value="3">&lt;</Option>
                    <Option value="4">&lt;=</Option>
                    <Option value="5">&lt;&gt;</Option>
                  </>

                ) : (
                  <>
                  <Option value="0">=</Option>
                  <Option value="5">&lt;&gt;</Option>
                  </>
                )}
              </Select>
              <Select
                onSelect={(val) => {
                  handleChange(index, 1, val)
                }}
                virtual={true}
                value={{value: predVal.value}}
                style={{width: 210}}
                size="small"
                showSearch
                placeholder="Value"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  `${option.children}`.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {options.map((v) => {
                  return(<Option key={v} value={v} >{v}</Option>)
                })}
              </Select>
            </div>
          </div>

    </Card>
  )
}

export default function({
  attr,
  onClose,
  visible,
  titleColor,
  oldPredicate,
  updatePredicate,
  deletePredicate,
  propValues
}){
  const [isInt, setIsInt] = useState(false);
  const [options, setOptions] = useState([]);
  const predicate = JSON.parse(JSON.stringify(oldPredicate))

  //* Runs only once, preparing options for select dropdown
  useEffect(() => {
    var isIntCpy = false;
    var optArr = propValues
      .map(function (item) {
        if (neo4j.isInt(item)) {
          setIsInt(true);
          isIntCpy = true;
          return neo4j.integer.toNumber(item);
        } else {
          return item;
        }
      });
    const distinctOpts = [...new Set(optArr)];
    setOptions(distinctOpts);
  }, []);

  const handleChange = (index, label, newVal) => {
    updatePredicate("modify", {index, label, newVal, attr: predicate.attr})
  };

  const addPredicate = () => {
    updatePredicate("add", {attr: predicate.attr, vals: ['0', '']})
  };

  const removePredicate = (i) => {
    if(i === 0 && predicate.preds.length === 1) {
      updatePredicate("delete", {attr: predicate.attr, index: i, deleteAll: true})
      onClose()
    } else {
      updatePredicate("delete", {attr: predicate.attr, index: i, deleteAll: false})
    }
  }

  return (
    <Drawer
      title={<Title style={{marginBottom: 0}}level={3}>Attribute: <span style={{color: titleColor}}>{attr}</span></Title>}
      placement="left"
      closable={true}
      maskClosable={false}
      mask={false}
      closeIcon={<ArrowLeftOutlined />}
      onClose={onClose}
      visible={visible}
      push={false}
    >
      <Divider orientation="left">
        Selected Predicates
        <Tooltip title="add new predicate">
          <Button
            style={{
              position: 'relative',
              top: -1,
              left: 6
            }}
            size="small"
            shape="circle"
            onClick={() => {
              addPredicate(attr)
            }}
            icon={<PlusOutlined />} />
        </Tooltip>
      </Divider>
      {
        predicate.preds.map((n, i) => {
          return (
            <PredicateSelectorCard
              key={`${i}`}
              onClose={onClose}
              predVal={{op: n[0], value: n[1]}}
              removePredicate={removePredicate}
              handleChange={handleChange}
              options={options}
              isInt={isInt}
              index={i}/>
          )
        })
      }

    </Drawer>
  )
}
