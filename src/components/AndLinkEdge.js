import React from 'react';

function AndLinkEdge({ id, sourceX, sourceY, targetX, targetY, data }) {
  const startY = sourceY + 7;
  const endY = targetY + 7;
  const color = data?.color || '#1f8a5b';
  const opacity = data?.opacity ?? 1;

  const dx = targetX - sourceX;
  const dy = endY - startY;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;

  const ux = dx / length;
  const uy = dy / length;
  const px = -uy;
  const py = ux;

  const chevronSize = 3;
  const chevronStep = 8;
  const startOffset = chevronSize;
  const endOffset = length - chevronSize;

  const chevrons = [];
  for (let dist = startOffset; dist <= endOffset; dist += chevronStep) {
    const tipX = sourceX + ux * dist;
    const tipY = startY + uy * dist;
    const baseX = tipX - ux * chevronSize;
    const baseY = tipY - uy * chevronSize;
    const leftX = baseX + px * chevronSize;
    const leftY = baseY + py * chevronSize;
    const rightX = baseX - px * chevronSize;
    const rightY = baseY - py * chevronSize;

    chevrons.push(
      <path
        key={`chevron-${id}-${dist}`}
        d={`M ${leftX} ${leftY} L ${tipX} ${tipY} L ${rightX} ${rightY}`}
        className="and-link-edge"
        style={{
          stroke: color,
          strokeWidth: 2,
          fill: 'none',
          opacity,
          transition: 'opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: 'none'
        }}
      />
    );
  }

  return <g style={{ pointerEvents: 'none' }}>{chevrons}</g>;
}

export default AndLinkEdge;
