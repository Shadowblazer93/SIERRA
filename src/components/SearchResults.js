import React, { useRef, useEffect, useState } from 'react';
import * as Constants from '../constants';
const neo4j = require('neo4j-driver');

const normalizeNeo4jValue = (value) => {
  if (neo4j.isInt(value)) {
    return neo4j.integer.inSafeRange(value)
      ? neo4j.integer.toNumber(value)
      : neo4j.integer.toString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNeo4jValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = normalizeNeo4jValue(value[key]);
      return acc;
    }, {});
  }

  return value;
};

function SearchResults(props) {
  const getColumnColor = (index) => {
    if (!props.result || props.result.length === 0) return '#fff';
    const key = props.result[0].keys[index];
    if (props.colMap && props.colMap[key]) {
      return props.colMap[key];
    }
    var charIndex = key.charCodeAt(0) - 97;
    return Constants.COLORS[charIndex % Constants.COLORS.length];
  }

  const wrapperRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const [isClosing, setIsClosing] = useState(false);

  const formatCsvValue = (value) => {
    if (value && value.properties) {
      return JSON.stringify(normalizeNeo4jValue(value.properties));
    }

    if (value && value.segments) {
      return `Path length: ${value.length}`;
    }

    return JSON.stringify(normalizeNeo4jValue(value));
  };

  const escapeCsvValue = (value) => {
    const text = value == null ? '' : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const downloadCsv = () => {
    if (!props.result || props.result.length === 0) return;

    const firstRecord = props.result[0];
    const headers = firstRecord._fields.map((val, index) => {
      if (val && val.labels) return val.labels;
      if (val && val.segments) return 'Path';
      return firstRecord.keys[index];
    });

    const rows = props.result.map((record) => (
      record._fields.map((val) => escapeCsvValue(formatCsvValue(val))).join(',')
    ));

    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...rows
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `query-results-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  useEffect(() => {
    document.addEventListener('click', handleClickOutside, false);
    return () => {
      document.removeEventListener('click', handleClickOutside, false);
    };
  }, []);

  useEffect(() => () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
    }
  }, []);

  const handleClickOutside = (event) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
      requestClose();
    }
  };

  const requestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      props.hide();
    }, 180);
  };

  return (
    <div ref={wrapperRef}>
      {/* <div
        className="p-4"
        style={{
          position: 'absolute',
          right: '0',
          top: '0',
          width: '15%',
          backgroundColor: '#F5F5F5',
          height: '100vh',
          zIndex: '30',
        }}
      >
        <h3>Query String</h3>
        {props.query}
      </div> */}
      <div className={`result-modal-center${isClosing ? ' is-closing' : ''}`}>
        {/* <div className="result-modal-header">
          <h3>Results</h3>
        </div> */}

        <div className="result-modal-body">
          {props.result.length > 0 ? (
            <table className="w-100">
              <thead>
                <tr>
                  {props.result[0]._fields.map(function (val, index) {
                    let headerText = "";
                    if (val && val.labels) {
                      headerText = val.labels;
                    } else if (val && val.segments) {
                      headerText = "Path";
                    } else {
                      headerText = props.result[0].keys[index];
                    }
                    return (
                      // set colour of column headers to respective colour of node in constructed query graph
                      <td key={index} style={{ background: getColumnColor(index) }}>
                        <b>{headerText}</b>
                      </td>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {props.result.map(function (record, index) {
                  return (
                    <tr key={index}>
                      {record._fields.map(function (val, index) {
                        let content = null;
                        if (val && val.properties) {
                          content = Object.keys(val.properties).map(function (key, i) {
                            return (
                              <div key={i} style={{ textAlign: 'left' }}>
                                <b>{key}:</b>{' '}
                                {JSON.stringify(normalizeNeo4jValue(val.properties[key]))}
                              </div>
                            );
                          });
                        } else if (val && val.segments) {
                           content = <div>Path (length: {val.length})</div>;
                         } else {
                           content = JSON.stringify(normalizeNeo4jValue(val));
                        }
                        return (
                        // set colour of column to respective colour of node in constructed query graph
                          <td key={index} className="px-2" style={{ background: getColumnColor(index) }}>
                            {content}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div>
              <i>No results found</i>
            </div>
          )}
        </div>

        <div className="result-modal-footer">
          <button
            type="button"
            className="btn btn-primary"
            onClick={downloadCsv}
            disabled={!props.result || props.result.length === 0}
          >
            <span className="result-modal-button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 3a1 1 0 0 1 1 1v9.17l2.59-2.58a1 1 0 1 1 1.41 1.42l-4.3 4.29a1 1 0 0 1-1.4 0l-4.3-4.29a1 1 0 1 1 1.41-1.42L11 13.17V4a1 1 0 0 1 1-1z" />
                <path d="M5 19a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1z" />
              </svg>
            </span>
            Save to .csv
          </button>
          <button type="button" className="btn btn-secondary" onClick={requestClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchResults;
