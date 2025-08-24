import React, { useEffect, useState } from 'react';

function Predicate(props) {
  // size of property circle depends on number of predicates on property
  const predRadius = props.radius;
  const predicateStyle = {
    background: props.color.secondary,
    position: 'absolute',
    // position of predicate depends on size of node
    top: props.position.y + 'px', // theta.push((2 * i * Math.PI) / n);
    left: props.position.x + 'px',
    width: predRadius * 2 + 'px',
    height: predRadius * 2 + 'px',
    border: '1px solid black',
    borderRadius: '50%',
  };
  return (
      <div style={predicateStyle}/>
  );
}

export default Predicate;
