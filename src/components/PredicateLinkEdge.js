import React from 'react';
import { getBezierPath } from 'react-flow-renderer';

function PredicateLinkEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const edgePath = `M ${sourceX}, ${sourceY+7}L ${targetX}, ${targetY+7}`
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + 7 + targetY + 7) / 2;

  const joinType = data?.joinType;
  const operator = data?.operator;
  
  const isTheta = joinType === 'Theta Join';
  const labelContent = isTheta ? (operator || 'θ') : '=';
  
  const borderColor = isTheta ? '#faad14' : '#1890ff';
  const color = isTheta ? '#faad14' : '#1890ff';

  return (
    <g>
      {/* Invisible wide path for easier clicking */}
      <path
        d={edgePath}
        style={{ stroke: 'transparent', strokeWidth: 7, cursor: 'pointer' }}
        onClick={(event) => {
          if (data && data.onLinkClick) {
            data.onLinkClick(event, id);
          }
        }}
      />
      {/* Visible path */}
      <path
        id={id}
        style={{ stroke: '#8d3f8dff', strokeWidth: 2, strokeDasharray: '4 4', pointerEvents: 'none' }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      <foreignObject
        width={24}
        height={24}
        x={centerX - 12}
        y={centerY - 12}
        requiredExtensions="http://www.w3.org/1999/xhtml"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
           <div style={{ 
            width: 18,
            height: 18,
            borderRadius: 9,
            background: 'white',
            border: `2px solid ${borderColor}`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: color, 
            fontWeight: 800, 
            fontSize: 10,
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
          }}>
            {labelContent}
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

export default PredicateLinkEdge;
