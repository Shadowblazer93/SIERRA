import React, {useState, useContext} from 'react';
import {Button, Drawer, Typography, Select, Divider, Tag, Tooltip} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons'
import { InputNumber, Checkbox } from 'antd';
import { PRED_COLOR_V2 } from '../../constants';
import {Context} from '../../Store';
import { PredicateCheckBox, PredicateDraw, SelectTag } from '../common';
const {Title, Text} = Typography;
const {Option} = Select;

const EdgeModal = ({
  source,
  destination,
  onClose,
  isDirected,
  toggleDirected,
  rs,
  allRs,
  updateEdgeRs,
  updateEdgeCardinality,
  updateEdgeIsOptional,
  predicates,
  addPredicate,
  updatePredicate,
  deletePredicate,
  propData,
  visible
}) => {
  //..
  const [state, dispatch] = useContext(Context);
  const [childrenDrawer, setChildDrawer] = useState({});
  const [cardinality, setCardinality] = useState({ min: 1, max: 1 });
  const [cardOp, setCardOp] = useState('=');
  const [isOptional, setIsOptional] = useState(false);
  const [cardinalityProps, setCardinalityProps] = useState([]);
  const rsOptions = Object.keys(allRs ?? {})
  const rsAttributes = rs && allRs[rs] ? allRs[rs] : []

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

  return (

    <Drawer
        title={<Title style={{marginBottom: 0}}level={3}>{source} - {destination}</Title>}
        placement="left"
        closeIcon={<ArrowLeftOutlined />}
        onClose={onClose}
        visible={visible}
        push={false}
        maskClosable={false}
        mask={false}
      >
        <>
          <div style={{padding: '0px 15px 10px'}}>
            <Tooltip title={`Toggle Edge: ${!isDirected ? "Directed" : "Undirected"}`}>
              <Button
                style={{borderRadius: 4}}
                onClick={() => {toggleDirected()}}
              >
                {isDirected ? "Directed" : "Undirected"}
              </Button>
            </Tooltip>
          </div>

          {isDirected && (
            <>
              <Divider orientation="left">Relationship</Divider>

              <div style={{padding: '0px 15px 10px'}}>
                <Select
                  onSelect={(val) => {
                    updateEdgeRs(val.value)
                  }}
                  labelInValue
                  value={{value: rs}}
                  style={{width: '80%'}}
                  // size="small"
                >
                  <Option value="">None</Option>
                  {rsOptions.map(r => {
                    return (
                      <Option key={r} value={r}>{r}</Option>
                    )
                    })
                  }

                </Select>
              </div>
            </>
          )}

          {isDirected && (rs !== "") && rsAttributes.length > 0 &&
            (
              <>
              <Divider orientation="left">Selected Predicates</Divider>
              <div style={{padding: '0px 15px 10px'}}>
                {Object.keys(predicates).map((attr, i) => {
                  const colour = PRED_COLOR_V2[rsAttributes.indexOf(attr) % PRED_COLOR_V2.length]
                  return (
                    <div key={`pt-${i}`}>
                      <SelectTag onClick={() => {showChildrenDrawer(attr)}} colour={colour.name} key={`${attr}-k`} text={attr} />
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
                {rsAttributes.map((attr, i) => (
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
        </>
          )

        }

        {/*Joins*/}
          <Divider orientation="left">Joins : Optional Match</Divider>
          <div style={{padding: '0px 15px 10px'}}>
            <Checkbox
              checked={isOptional}
              onChange={e => {
                console.log(e);
                setIsOptional(e.target.checked);
                updateEdgeIsOptional(e.target.checked);
                e.target.checked = isOptional;
              }}
            >
              Join (use OPTIONAL MATCH)
            </Checkbox>
          </div>

        {/* Cardinality */}
          <Divider orientation="left">Cardinality</Divider>
          <div style={{padding: '0px 15px 10px', display: 'flex', alignItems: 'center', gap: 8}}>
            <InputNumber
              min={0}
              value={cardinality.min}
              disabled={cardinality.max !== 1} // lock if max is set
              onChange={(val) => {
                const newCard = { min: val, max: 1 };
                setCardinality(newCard);
                updateEdgeCardinality({ ...newCard, op: cardOp });
              }}
              style={{width: 60}}
            />
            to
            <InputNumber
              min={0}
              value={cardinality.max}
              disabled={cardinality.min !== 1} // lock if min is set
              onChange={(val) => {
                const newCard = { min: 1, max: val };
                setCardinality(newCard);
                updateEdgeCardinality({ ...newCard, op: cardOp });
              }}
              style={{width: 60}}
            />
            <Select value={cardOp} onChange={(val) => {
              setCardOp(val);
              updateEdgeCardinality({ ...cardinality, op: val });
            }} style={{ width: 80 }}>
              <Option value="=">{'='}</Option>
              <Option value=">">{'>'}</Option>
              <Option value="<">{'<'}</Option>
              <Option value="<>">{'!='}</Option>
            </Select>
            <Button
              style={{marginLeft: 16}}
              onClick={() => {
                const resetCard = { min: 1, max: 1 };
                setCardinality(resetCard);
                setCardOp('=');
                updateEdgeCardinality({ ...resetCard, op: '=' });
              }}
            >
              Reset
            </Button>
          </div>
        </>
    </Drawer>
  )
}

export default EdgeModal