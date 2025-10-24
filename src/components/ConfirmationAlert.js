import React from 'react';
import ReactDOM from 'react-dom';

function ConfirmationAlert(props) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(128,128,128,0.75)',
        position: 'absolute',
        width: '100%',
        height: '100%',
        left: '0',
        top: '0',
        zIndex: '100',
      }}
    >
      <div className="alert alert-warning fade show center">
        <div className="alert-heading">
          <strong className="mr-auto">Warning</strong>
          <button type="button" className="ml-2 mb-1 close" aria-label="Close" onClick={() => props.hide()}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div className="toast-body">
          {props.msg}
          <strong>{props.attr ? props.attr : null}</strong>
        </div>
        {props.confirm ? (
          <div className="d-flex justify-content-around">
            <button type="button" className="px-5 ml-2 mb-1 btn btn-info" onClick={() => props.hide()}>
              No
            </button>
            <button
              type="button"
              className="px-5 ml-2 mb-1 btn btn-danger"
              onClick={() => {
                props.confirm();
                props.hide();
              }}
            >
              Yes
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ConfirmationAlert;
