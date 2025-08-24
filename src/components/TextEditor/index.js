import React, {useContext, useState} from 'react';
import { Button, Typography, message } from 'antd';
import {CopyOutlined} from '@ant-design/icons'
import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage } from "@codemirror/stream-parser";
import { cypher } from "@codemirror/legacy-modes/mode/cypher";
import { convertToGraph } from '../../utils/converToGraph';
import { Context } from '../../Store';
import { useStoreState } from 'react-flow-renderer';
import './index.css';
import { resetCurAvailId, undoResetNodeId } from '../../utils/getNodeId';
import useVisualActions from '../../hooks/useVisualActions';
import {PRED_COLOR_V2} from '../../constants'

const { Title } = Typography

export default function({text}){
  const [state, dispatch] = useContext(Context);
  const [cnlNodes, cnlEdges] = useStoreState((store) => [store.nodes, store.edges])
  const VA = useVisualActions()
  const [innerText, setInnerText] = useState(text)
  const onCopy = () => {
    if(innerText){
      navigator.clipboard.writeText(innerText).then(() => {
          message.info('Successfully Copied Query to Clipboard')
      })
    }
  }


  const handleSearch = () => {
    try {
      resetCurAvailId()
      let {nodes: midNodes, edges: midEdges} = convertToGraph(innerText, state)
      let nodes = []
      let newGraph = {
        ...state,
        nodes: [],
        edges: []
      }
      const nodePositionMap = {}
      for(const oldNode of cnlNodes) {
        nodePositionMap[oldNode.id] = oldNode.__rf.position
      }

      for (const [key, n] of Object.entries(midNodes)) {
        let possibleNeighbours = state.neighbours[n.label].map(function (rs) {
          return rs.label;
        });
        possibleNeighbours = [...new Set(possibleNeighbours)];
        const oldCopy = cnlNodes.find((el) => el.id === n.nodeId)
        let oldPosition = {x: 500, y: 200}
        let oldRanTheta
        if (oldCopy && n.label === oldCopy.data.label) {
          oldPosition = oldCopy.__rf.position
          oldRanTheta = oldCopy.ranTheta
        } else {
          let positions = Object.values(nodePositionMap)
          // console.log('pos', positions)
          //nodePositionMap[]
          let startHeight = 200
          while (positions.filter(pos => (startHeight - 100 < pos.y) && (startHeight + 100 > pos.y)).length > 0) {
            startHeight = startHeight + 120
          }
          oldPosition = {y: startHeight, x: 500}
          nodePositionMap[n.nodeId] = oldPosition
        }
        newGraph = VA.add(newGraph, "NODE", {
          id: n.nodeId,
          label: n.label,
          position: oldPosition,
          ranTheta: oldRanTheta,
          data: {
            connected: n.connected,
            rep: key,
          }
        })
        if(n.predicates) {
          for(const key in n.predicates) {
            const preds = n.predicates[key]
            const i = state.props[n.label].indexOf(key)
            const color = PRED_COLOR_V2[i % PRED_COLOR_V2.length]

            for(const [l, v] of preds) {
              newGraph = VA.add(newGraph, "PREDICATE", {
                attr: key,
                vals: [l, v],
                parent: n.nodeId,
                color,
              })
            }
          }
        }
      }
      for (const [key, e] of Object.entries(midEdges)) {
        newGraph = VA.add(newGraph, "EDGE", {
          params: {
            source: e.source,
            target: e.target,
          },
          addData: {
            rs: e.rs,
            rep: e.rep
          }
        })
        const targetNode = newGraph.nodes.find(el => el.id === e.target)
        const sourceNode = newGraph.nodes.find(el => el.id === e.source)
        if(!cnlNodes.find((el) => el.id === e.target)) {
          const newPos = {y: nodePositionMap[e.source].y, x: nodePositionMap[e.source].x + 200}
          targetNode.position = newPos
          nodePositionMap[e.target] = newPos
        }
        const edgeId = `e${e.source}-${e.target}`
        if(e.arrowHeadType) {
          newGraph = VA.update(newGraph, "EDGE", {
            edge: edgeId,
            prop: 'arrowHeadType',
            newVal: e.arrowHeadType
          })
        }

        if(e.predicates) {
          for(const key in e.predicates) {
            const preds = e.predicates[key]

            const {relationships} = newGraph.edges.find(el => el.id === edgeId).data
            let allRs = {}
            relationships.map(rsItem => {
              allRs[rsItem.type] = rsItem.props
            })
            const rsAttributes = e.rs ? allRs[e.rs] : []
            const i = rsAttributes.indexOf(key)
            const color = PRED_COLOR_V2[i % PRED_COLOR_V2.length]

            for(const [l, v] of preds) {
              newGraph = VA.add(newGraph, "PREDICATE", {
                attr: key,
                vals: [l, v],
                parent: edgeId,
                color,
                sourcePos: {
                  x: sourceNode.position.x + (sourceNode.radius * 2 + 4),
                  y: sourceNode.position.y + sourceNode.radius
                },
                targetPos: {
                 x: targetNode.position.x - 4,
                 y: targetNode.position.y + targetNode.radius
                }
              })
            }
          }
        }
      }

      dispatch({
        type: 'SET_GRAPH',
        payload: newGraph
      })
    } catch (e){
      undoResetNodeId()
      message.error(`Query unsupported by sierra, error message: ${e}` )
      throw ('error', e)
    }
  }

  return(
    <div style={{background: '#fff'}} className="text-container">
      <div style ={{display: 'flex', flexDirection: 'row', justifyContent:'space-between'}}>
        <Title level={5}>Cypher Query</Title>
        <CopyOutlined
          onClick={onCopy}
          style={{
            fontSize: '16px',
            margin: '7px 8px 0px auto'
          }}
          />
        <Button
          style={{
            fontSize: 13,
            height:30,
            borderRadius: 4,
          }}
          type="primary"
          // disabled={state.nodes.length === 0}
          onClick={handleSearch}
        >
          Translate
        </Button>
      </div>
      <CodeMirror
        value={text}
        height="200px"
        extensions={[StreamLanguage.define(cypher)]}
        onChange={(value) => {
          setInnerText(value);
        }}
      />

    </div>
  )
}
