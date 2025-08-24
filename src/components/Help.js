import React, { useRef, useEffect } from 'react';
import { BsFillPlayFill, BsPlusCircle } from 'react-icons/bs';

function Help(props) {
  const wrapperRef = useRef(null);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside, false);
    return () => {
      document.removeEventListener('click', handleClickOutside, false);
    };
  }, []);

  const handleClickOutside = (event) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
      props.hide();
    }
  };

  return (
    <div ref={wrapperRef} className="help-modal">
      <button type="button" className="close hide-button" onClick={() => props.hide()}>
        &times;
      </button>
      <b>Adding Nodes</b>
      <br />
      Click <BsPlusCircle /> button to view list of nodes available in connected database.
      <br />
      <b>Drawing edges</b>
      <br />
      Draw edge from right handle of a source node to left handle of target node. Alternatively, select a target node
      from list of targets to add a neighbour.
      <br />
      <b>Adding predicates</b>
      <br />
      Click on the label of a node to view possible predicates to be added to it.
      <br />
      <b>Run Query</b>
      <br />
      Click on <BsFillPlayFill /> button when construction of graph is completed to perform query.
      <br />
    </div>
  );
}

export default Help;
