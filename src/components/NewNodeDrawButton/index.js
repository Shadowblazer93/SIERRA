import React, { useState } from 'react';
import './index.css';
import { Drawer, Button, Collapse, Typography } from 'antd';
import { useContext } from 'react';
import { Context } from '../../Store'
import { CaretRightOutlined, PlusOutlined } from '@ant-design/icons';
import { USER_STUDY_ENTITIES } from '../../constants';
const {Panel} = Collapse;
const {Title, Text} = Typography;

const NewNodeDrawButton = ({addNode}) => {
  const [visible, setVisible] = useState(false);
  const [state, dispatch] = useContext(Context)
  const {entities, props} = state
  const showDrawer = () => {
    setVisible(true);
  };

  const onClose = () => {
    setVisible(false);
  };

  return (
    <>
      <Button
        style={{
          fontSize: 13,
          height:30,
          borderRadius: 4
        }}
        type="primary"
        onClick={showDrawer}>
        New Node
      </Button>
      <Drawer
        zIndex={10000}
        closeIcon={null}
        title={<Title style={{marginBottom: 0}}level={3} >Add A New Node</Title>}
        placement="left"
        onClose={onClose}
        visible={visible}
      >

        {entities.length ? (
          <Collapse
            bordered={false}
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
            className="site-collapse-custom-collapse"
          >

            {
            entities
              // .filter((node) => USER_STUDY_ENTITIES[userStudyDataset].has(node))
              .map((node, i) => {
              return (
                <Panel
                  header={(<Title style={{marginBottom: 0}}level={5} >{node}</Title>)}
                  key={`${i}`}
                  class
                  extra={
                    <div onClick={e => e.stopPropagation()}>
                      <Button
                        size="small"
                        shape='circle'
                        icon={<PlusOutlined />}
                        onClick={
                          () => {
                            addNode(node)
                            onClose()
                            }
                          }
                      />

                    </div>}
                  >
                  {<ul className='a'>
                    {props[node].map((p, i) => {
                      return (
                      <li key={`${i}`}>
                        <Text>{p}</Text>
                      </li>)
                    })}
                  </ul>}
                </Panel>
              )
            }) }
          </Collapse>

        ) : <div/> }
      </Drawer>
    </>
  );
  }

export default NewNodeDrawButton
