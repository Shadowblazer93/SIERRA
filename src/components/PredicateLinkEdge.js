import React from 'react';
import { getBezierPath } from 'react-flow-renderer';

function PredicateLinkEdge({ id, sourceX, sourceY, targetX, targetY }) {
  const edgePath = `M ${sourceX}, ${sourceY}L ${targetX}, ${targetY}`

  // Debug log (optional)
  console.log("LINKING:", sourceX, sourceY, targetX, targetY);

  return (
    <path
      id={id}
      style={{ stroke: '#8d3f8dff', strokeWidth: 2, strokeDasharray: '4 4' }}
      className="react-flow__edge-path"
      d={edgePath}
    />
  );
}

export default PredicateLinkEdge;
