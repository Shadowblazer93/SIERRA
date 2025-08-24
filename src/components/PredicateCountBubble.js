import React, { useEffect, useState } from 'react';

function PredicateCountBubble(props) {
  // size of property circle depends on number of predicates on propert
  const n = Object.keys(props.predicates).length
  const predRadius = 11;

  const predicateStyle = {
    background: '#ED1C24',
    position: 'absolute',
    // position of predicate depends on size of node
    top: props.nodeRad - parseInt(Math.round(props.nodeRad * Math.cos(0.785398))) - predRadius + 'px', // theta.push((2 * i * Math.PI) / n);
    left: props.nodeRad + parseInt(Math.round(props.nodeRad * Math.sin(0.785398))) - predRadius + 'px',
    width: predRadius * 2 + 'px',
    height: predRadius * 2 + 'px',
    border: '1px solid #FDFFFC',
    borderRadius: '50%',

  };
  // x + R * cos(theta + (i)2pi/kn)
  return (
      <div style={predicateStyle}>
        <p style={{position: 'relative', bottom: 1, fontSize: 13, color: '#FDFFFC'}}>{n}</p>
      </div>
  );
}

export default PredicateCountBubble;
