import { Drawer, Button, Divider, Typography, Tooltip, Select, Input } from 'antd';
import {ArrowLeftOutlined, DeleteOutlined, PlusOutlined, FilterOutlined} from '@ant-design/icons'
import React, {useState, useContext} from 'react';
import { addEdge } from 'react-flow-renderer';
import { PRED_COLOR_V2 } from '../../constants';
import { Context } from '../../Store';
import { PredicateDraw, PredicateCheckBox, SelectTag } from '../common';
import { getNodeId } from '../../utils/getNodeId';
import useVisualActions from '../../hooks/useVisualActions';
import DNFBuilder from './DNFBuilder';

const { Title } = Typography

const NodePredicateModal = ({
  visible,
  onClose,
  node,
  nodeId,
  targets,
  attributes,
  predicates,
  aggregations,
  dnf,
  addPredicate,
  deletePredicate,
  updatePredicate,
  currPos,
  isJoin,
  setIsJoin,
  propData,
  onDeleteNode
}) => {
  const VA = useVisualActions()
  const [childrenDrawer, setChildDrawer] = useState({});
  const [state, dispatch] = useContext(Context);

  const showChildrenDrawer = (attr) => {
    setChildDrawer({
      ...childrenDrawer,
      [attr]: true
    })
  };

  const onChildrenDrawerClose = (attr) => {
    setChildDrawer({
      ...childrenDrawer,
      [attr]: false
    })
  };

  const handleSaveDNF = (newDNF) => {
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'dnf', newVal: newDNF },
    });
  };

  const isNumeric = (attr) => {
      if (!propData || propData.length === 0) return true; 
      for (const row of propData) {
          const val = row[attr];
          if (val === undefined || val === null) continue;
          if (typeof val === 'number') return true;
          if (typeof val === 'object' && val.low !== undefined && val.high !== undefined) return true;
          return false;
      }
      return true; 
  }

  //* Add Target node (new)
  const addTarget = (destNode) => {
    // set connected of existing node to true
    dispatch({
      type: 'MODIFY_NODE_DATA',
      payload: { node: nodeId, prop: 'connected', newVal: true },
    });

    const destId = getNodeId();

    let newState = VA.add(state, "NODE", {
      data : {
        connected: true
      },
      id: destId,
      position: { x: currPos[0] + 200, y: currPos[1] },
      label: destNode
    })

    newState = VA.add(newState, "EDGE", {
      params: { source: nodeId, target: destId},
      destNode
    })

    dispatch({
      type: 'SET_GRAPH',
      payload: newState
    })
  };

  return (
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Title style={{marginBottom: 0}} level={3}>{node}</Title>
            <Tooltip title="Delete Node">
              <Button 
                type="text" 
                danger 
                icon={<DeleteOutlined />} 
                onClick={onDeleteNode}
              />
            </Tooltip>
          </div>
        }
        placement="left"
        closeIcon={<ArrowLeftOutlined/>}
        maskClosable={false}
        mask={false}
        onClose={onClose}
        visible={visible}
        push={false}
      >
        <Divider orientation="left">Selected Predicates</Divider>

        <div style={{padding: '0px 15px 10px'}}>
          {Object.keys(predicates).map((attr, i) => {
            const colour = PRED_COLOR_V2[attributes.indexOf(attr) % PRED_COLOR_V2.length]
            return (
              <div key={`pt-${i}`}>
                <SelectTag onClick={() => {showChildrenDrawer(attr); console.log("YES CLICKED")}} colour={colour.name} key={`${attr}-k`} text={attr} />
                <PredicateDraw
                  onClose={() => onChildrenDrawerClose(attr)}
                  attr={attr}
                  oldPredicate={{ attr: attr, preds: predicates[attr].data }}
                  updatePredicate={updatePredicate}
                  deletePredicate={deletePredicate}
                  propValues={propData
                    .filter((item) => Object.keys(item).includes(attr))
                    .map((item) => item[attr])
                  }
                  titleColor={colour.secondary}
                  visible={childrenDrawer[attr]}/>
              </div>
            )
          })}
        </div>

        <Divider orientation="left">Properties</Divider>

        <div style={{padding: '0px 15px 10px'}}>
          {attributes.map((attr, i) => (
              <PredicateCheckBox
                key={`${attr}-k`}
                title={attr}
                checked={Object.keys(predicates).indexOf(attr) !== -1}
                onAddPredicate={() => {
                  addPredicate(attr, PRED_COLOR_V2[i % PRED_COLOR_V2.length])
                  setChildDrawer({
                    ...childrenDrawer,
                    [attr]:true
                  })
                  }
                }
                onDeletePredicate={() => {
                  deletePredicate(attr)
                }}
                palette={PRED_COLOR_V2[i % PRED_COLOR_V2.length]} />
            ))
          }

        </div>

        <Divider orientation="left">Aggregations</Divider>
        <div style={{padding: '0px 15px 10px'}}>
           {
               (Array.isArray(aggregations) ? aggregations : []).map((agg, idx) => (
                   <div key={idx} style={{marginBottom: 8}}>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                       <Select 
                           placeholder="Attribute"
                           style={{flex: 1}}
                           value={agg.attribute}
                           onChange={(val) => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs[idx] = { ...agg, attribute: val };
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       >
                           {attributes.map(a => <Select.Option key={a} value={a}>{a}</Select.Option>)}
                       </Select>
                       <Select 
                           placeholder="Function"
                           style={{width: 100}}
                           value={agg.function}
                           onChange={(val) => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs[idx] = { ...agg, function: val };
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       >
                           <Select.Option value="COUNT">COUNT</Select.Option>
                           <Select.Option value="SUM">SUM</Select.Option>
                           <Select.Option value="AVG">AVG</Select.Option>
                           <Select.Option value="MIN">MIN</Select.Option>
                           <Select.Option value="MAX">MAX</Select.Option>
                           <Select.Option value="COLLECT">COLLECT</Select.Option>
                       </Select>
                       <Button 
                           icon={<FilterOutlined />}
                           type={agg.hasCondition ? 'primary' : 'default'}
                           onClick={() => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               if (!agg.hasCondition) {
                                   newAggs[idx] = { ...agg, hasCondition: true, alias: '', operator: '>', value: '' };
                               } else {
                                   newAggs[idx] = { ...agg, hasCondition: false };
                               }
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       />
                       <Button 
                           danger
                           icon={<DeleteOutlined />}
                           onClick={() => {
                               const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                               newAggs.splice(idx, 1);
                               dispatch({
                                   type: 'MODIFY_NODE_DATA',
                                   payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                               });
                           }}
                       />
                   </div>
                   
                   {agg.hasCondition && (
                       <div style={{display: 'flex', gap: 8, marginTop: 8, paddingLeft: 12, alignItems: 'center'}}>
                           <FilterOutlined style={{color: '#aaa'}}/>
                           <Input 
                               placeholder="Alias"
                               value={agg.alias}
                               onChange={(e) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, alias: e.target.value };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                               style={{flex: 1}}
                           />
                           <Select
                               style={{width: 80}}
                               value={agg.operator}
                               onChange={(val) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, operator: val };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                           >
                               {['=', '>', '>=', '<', '<=', '<>'].map(op => <Select.Option key={op} value={op}>{op}</Select.Option>)}
                           </Select>
                           <Input 
                               placeholder="Value"
                               value={agg.value}
                               onChange={(e) => {
                                   const newAggs = [...aggregations];
                                   newAggs[idx] = { ...agg, value: e.target.value };
                                   dispatch({ type: 'MODIFY_NODE_DATA', payload: { node: nodeId, prop: 'aggregations', newVal: newAggs } });
                               }}
                               style={{flex: 1}}
                           />
                       </div>
                   )}

                      {agg.attribute && ['SUM', 'AVG'].includes(agg.function) && !isNumeric(agg.attribute) && (
                          <div style={{color: 'red', fontSize: '12px', marginTop: 4}}>
                              Warning: Applying numeric aggregation to non-numeric type
                          </div>
                      )}
                   </div>
               ))
           }
           <Button 
               type="dashed" 
               onClick={() => {
                   const newAggs = [...(Array.isArray(aggregations) ? aggregations : [])];
                   newAggs.push({ attribute: attributes[0], function: 'COUNT' });
                   dispatch({
                       type: 'MODIFY_NODE_DATA',
                       payload: { node: nodeId, prop: 'aggregations', newVal: newAggs },
                   });
               }} 
               block 
               icon={<PlusOutlined />}
           >
               Add Aggregation
           </Button>
        </div>

        {/* <Divider orientation="left">Join : Optional Match</Divider>
        <div style={{padding: '0px 15px 10px'}}>
          <Button
            type={isJoin ? "primary" : "default"}
            onClick={() => {
              setIsJoin(!isJoin);
            }}
            style={{ width: '100%' }}
          >
            {isJoin ? "Joined" : "Join"}
          </Button>
        </div> */}

        <Divider orientation="left">DNF Query Builder</Divider>
        <DNFBuilder 
            attributes={attributes} 
            propData={propData} 
            initialData={dnf} 
            onSave={handleSaveDNF} 
        />

        <Divider orientation="left">Possible Targets</Divider>
        <div style={{padding: '0px 15px 10px'}}>
          {
            targets.map((target, i) => {
              return (
                <Button
                  style={{marginRight: 8, background: '#d7f0ffee', borderRadius: 10}}
                  key={`${i}`}
                  onClick={() => {
                    addTarget(target)
                  }} type="text">
                  {target}
                </Button>
              )
            })
          }
        </div>

      </Drawer>
  );
}

export default NodePredicateModal
