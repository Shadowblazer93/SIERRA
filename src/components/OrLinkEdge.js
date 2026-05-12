import React, { useContext, useRef, useState } from 'react';
import { Context } from '../Store';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hex) => {
  if (!hex) return null;
  const normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    const r = parseInt(normalized[0] + normalized[0], 16);
    const g = parseInt(normalized[1] + normalized[1], 16);
    const b = parseInt(normalized[2] + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return { r, g, b };
  }
  return null;
};

const rgbToHex = ({ r, g, b }) => {
  const toHex = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const adjustColor = (hex, amount) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex({
    r: rgb.r + 255 * amount,
    g: rgb.g + 255 * amount,
    b: rgb.b + 255 * amount
  });
};

function OrLinkEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const [isHovered, setIsHovered] = useState(false);
  const [state, dispatch] = useContext(Context);
  const dnfHoverEnterTimeout = useRef(null);
  const dnfHoverLeaveTimeout = useRef(null);
  const hoverHideTimeout = useRef(null);
  const dnfHoverActive = useRef(false);
  const startY = sourceY + 7;
  const endY = targetY + 7;
  const isSunflowerSameGroup = data?.orRepresentation === 'sunflower' && !!data?.isSameGroup;
  const midX = (sourceX + targetX) / 2;
  const midY = (startY + endY) / 2;
  const curveOffset = Math.max(18, Math.min(44, Math.abs(targetX - sourceX) * 0.24 + Math.abs(endY - startY) * 0.18));
  const edgePath = isSunflowerSameGroup
    ? `M ${sourceX}, ${startY} Q ${midX}, ${midY - curveOffset} ${targetX}, ${endY}`
    : `M ${sourceX}, ${startY}L ${targetX}, ${endY}`;
  const centerX = (sourceX + targetX) / 2;
  const centerY = (startY + endY) / 2;
  const color = (data && data.orGroupColor) ? data.orGroupColor : '#ff8c00';
  const gradientId = `or-link-gradient-${id}`;
  const gradientStart = adjustColor(color, 0.45);
  const gradientEnd = adjustColor(color, -0.35);
  const opacity = data?.opacity ?? 1;
  const showLabel = !data?.hideEdgeLabel && (isHovered || !!data?.isGroupHovering);

  React.useEffect(() => {
    return () => {
      if (dnfHoverEnterTimeout.current) {
        clearTimeout(dnfHoverEnterTimeout.current);
      }
      if (dnfHoverLeaveTimeout.current) {
        clearTimeout(dnfHoverLeaveTimeout.current);
      }
      if (hoverHideTimeout.current) {
        clearTimeout(hoverHideTimeout.current);
      }
      if (dnfHoverActive.current) {
        dnfHoverActive.current = false;
        dispatch({ type: 'DNF_HOVER_END' });
      }
    };
  }, [dispatch]);

  const beginHover = () => {
    if (hoverHideTimeout.current) {
      clearTimeout(hoverHideTimeout.current);
      hoverHideTimeout.current = null;
    }
    setIsHovered(true);
  };

  const endHover = () => {
    if (hoverHideTimeout.current) {
      clearTimeout(hoverHideTimeout.current);
    }
    hoverHideTimeout.current = setTimeout(() => {
      setIsHovered(false);
      hoverHideTimeout.current = null;
    }, 180);
  };

  const scheduleDnfHoverStart = () => {
    if (!state.dnfMode) return;
    if (dnfHoverActive.current) return;
    if (dnfHoverLeaveTimeout.current) {
      clearTimeout(dnfHoverLeaveTimeout.current);
    }
    if (dnfHoverEnterTimeout.current) {
      clearTimeout(dnfHoverEnterTimeout.current);
    }
    dnfHoverActive.current = true;
    dispatch({ type: 'DNF_HOVER_START' });
  };

  const scheduleDnfHoverEnd = () => {
    if (!state.dnfMode) return;
    if (!dnfHoverActive.current) return;
    if (dnfHoverEnterTimeout.current) {
      clearTimeout(dnfHoverEnterTimeout.current);
    }
    if (dnfHoverLeaveTimeout.current) {
      clearTimeout(dnfHoverLeaveTimeout.current);
    }
    dnfHoverLeaveTimeout.current = setTimeout(() => {
      dnfHoverActive.current = false;
      dispatch({ type: 'DNF_HOVER_END' });
    }, 2000);
  };

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={startY}
          x2={targetX}
          y2={endY}
        >
          <stop offset="0%" stopColor={gradientStart} />
          <stop offset="100%" stopColor={gradientEnd} />
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        style={{ stroke: 'transparent', strokeWidth: 10, cursor: 'default' }}
        onMouseEnter={() => {
          beginHover();
          scheduleDnfHoverStart();
        }}
        onMouseLeave={() => {
          endHover();
          scheduleDnfHoverEnd();
        }}
      />
      <path
        id={id}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: isSunflowerSameGroup ? 2.4 : 2,
          pointerEvents: 'none',
          opacity,
          transition: 'opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      {!data?.hideEdgeLabel && (
        <foreignObject
          width={30}
          height={24}
          x={centerX - 15}
          y={centerY - 34}
          requiredExtensions="http://www.w3.org/1999/xhtml"
          style={{
            overflow: 'visible',
            pointerEvents: showLabel ? 'auto' : 'none',
            opacity: showLabel ? 1 : 0,
            transition: 'opacity 180ms ease'
          }}
          onMouseEnter={() => {
            beginHover();
            scheduleDnfHoverStart();
          }}
          onMouseLeave={() => {
            endHover();
            scheduleDnfHoverEnd();
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%' }}>
            <div
              style={{
                width: 24,
                height: 18,
                borderRadius: 6,
                background: 'white',
                border: `2px solid ${color}`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: color,
                fontWeight: 800,
                fontSize: 10,
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                cursor: 'pointer'
              }}
              onClick={(event) => {
                if (data && data.onOrTextClick) {
                  data.onOrTextClick(event, data.orGroupId);
                }
              }}
            >
              OR
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

export default OrLinkEdge;
