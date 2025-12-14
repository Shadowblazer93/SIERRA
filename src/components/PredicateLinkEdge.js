import React from 'react';
import { getBezierPath } from 'react-flow-renderer';

function PredicateLinkEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const edgePath = `M ${sourceX}, ${sourceY}L ${targetX}, ${targetY}`

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
    </g>
  );
}

export default PredicateLinkEdge;
