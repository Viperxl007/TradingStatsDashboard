import React from 'react';
import {
  Box,
  useColorMode
} from '@chakra-ui/react';
import { MiniConfidenceChartProps } from '../types/macroSentiment';

const MiniConfidenceChart: React.FC<MiniConfidenceChartProps> = ({
  data,
  width = 200,
  height = 40
}) => {
  const { colorMode } = useColorMode();

  if (!data || data.length === 0) {
    return (
      <Box 
        width={`${width}px`} 
        height={`${height}px`} 
        bg={colorMode === 'dark' ? 'gray.600' : 'gray.100'}
        borderRadius="md"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box fontSize="xs" color="gray.500">No data</Box>
      </Box>
    );
  }

  // Create SVG path for the confidence line
  const createPath = () => {
    if (data.length < 2) return '';

    const maxConfidence = Math.max(...data.map(d => d.overall_confidence));
    const minConfidence = Math.min(...data.map(d => d.overall_confidence));
    const range = maxConfidence - minConfidence || 1; // Avoid division by zero

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((point.overall_confidence - minConfidence) / range) * height;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Create gradient for the line based on confidence levels
  const getStrokeColor = () => {
    const avgConfidence = data.reduce((sum, d) => sum + d.overall_confidence, 0) / data.length;
    
    if (avgConfidence <= 25) return '#E53E3E'; // Red
    if (avgConfidence <= 50) return '#DD6B20'; // Orange
    if (avgConfidence <= 75) return '#D69E2E'; // Yellow
    return '#38A169'; // Green
  };

  const path = createPath();
  const strokeColor = getStrokeColor();

  return (
    <Box 
      width={`${width}px`} 
      height={`${height}px`}
      position="relative"
    >
      <svg
        width={width}
        height={height}
        style={{
          overflow: 'visible'
        }}
      >
        {/* Background grid lines */}
        <defs>
          <pattern
            id="grid"
            width="20"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 20 0 L 0 0 0 10"
              fill="none"
              stroke={colorMode === 'dark' ? '#4A5568' : '#E2E8F0'}
              strokeWidth="0.5"
              opacity="0.3"
            />
          </pattern>
        </defs>
        
        <rect
          width={width}
          height={height}
          fill="url(#grid)"
        />

        {/* Confidence line */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points */}
        {data.map((point, index) => {
          const maxConfidence = Math.max(...data.map(d => d.overall_confidence));
          const minConfidence = Math.min(...data.map(d => d.overall_confidence));
          const range = maxConfidence - minConfidence || 1;
          
          const x = (index / (data.length - 1)) * width;
          const y = height - ((point.overall_confidence - minConfidence) / range) * height;
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="2"
              fill={strokeColor}
              opacity="0.8"
            />
          );
        })}

        {/* Reference lines for 25%, 50%, 75% confidence */}
        {[25, 50, 75].map(level => {
          const y = height - (level / 100) * height;
          return (
            <line
              key={level}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke={colorMode === 'dark' ? '#4A5568' : '#CBD5E0'}
              strokeWidth="0.5"
              strokeDasharray="2,2"
              opacity="0.5"
            />
          );
        })}
      </svg>

      {/* Tooltip overlay (simplified) */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        cursor="pointer"
        title={`Confidence trend over ${data.length} data points`}
      />
    </Box>
  );
};

export default MiniConfidenceChart;