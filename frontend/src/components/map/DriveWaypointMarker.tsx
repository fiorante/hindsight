import React, { useState } from 'react'
import { usePlayhead } from '../providers/TimelinePlayheadProvider'
interface DriveWaypointMarkerProps {
  id: string
  x: number
  y: number
  label: string
  sol: string
}
export const DriveWaypointMarker: React.FC<DriveWaypointMarkerProps> = ({
  id,
  x,
  y,
  label,
  sol,
}) => {
  // Ensure x and y are valid numbers
  const validX = typeof x === 'number' && !isNaN(x) ? x : 0;
  const validY = typeof y === 'number' && !isNaN(y) ? y : 0;
  const { setHoveredElement } = usePlayhead()
  const [isHovered, setIsHovered] = useState(false)
  const handleMouseEnter = () => {
    setIsHovered(true)
    setHoveredElement(id)
  }
  const handleMouseLeave = () => {
    setIsHovered(false)
    setHoveredElement(null)
  }
  return (
    <g
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        cursor: 'pointer',
      }}
    >
      <circle
        cx={validX}
        cy={validY}
        r="0.004"
        fill={isHovered ? '#ff9900' : '#ff5500'}
        stroke="#ffffff"
        strokeWidth="0.001"
      />
      {isHovered && (
        <g>
          <rect
            x={validX + 0.005}
            y={validY - 0.02}
            width="0.05"
            height="0.02"
            rx="0.003"
            fill="white"
            opacity="0.9"
          />
          <text
            x={validX + 0.03}
            y={validY - 0.01}
            fontSize="0.008"
            textAnchor="middle"
            fill="#333"
          >
            {label}
          </text>
          <text
            x={validX + 0.03}
            y={validY - 0.003}
            fontSize="0.006"
            textAnchor="middle"
            fill="#666"
          >
            Sol {sol}
          </text>
        </g>
      )}
    </g>
  )
}
