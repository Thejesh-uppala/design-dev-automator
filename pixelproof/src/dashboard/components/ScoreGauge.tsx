import React from 'react';

interface ScoreGaugeProps {
  value: number | null;
  label: string;
  size?: number;
}

function getColor(value: number): string {
  if (value >= 80) return 'var(--green)';
  if (value >= 50) return 'var(--yellow)';
  return 'var(--red)';
}

export function ScoreGauge({ value, label, size = 120 }: ScoreGaugeProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const percent = value ?? 0;
  const dashOffset = circumference - (percent / 100) * circumference;
  const color = value !== null ? getColor(value) : 'var(--text-muted)';
  const displayText = value !== null ? `${value}%` : '--';

  return React.createElement(
    'div',
    { className: 'pp-gauge' },
    React.createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: `0 0 ${size} ${size}`,
      },
      React.createElement('circle', {
        cx: center,
        cy: center,
        r: radius,
        fill: 'none',
        stroke: 'var(--bg-tertiary)',
        strokeWidth,
      }),
      React.createElement('circle', {
        cx: center,
        cy: center,
        r: radius,
        fill: 'none',
        stroke: color,
        strokeWidth,
        strokeLinecap: 'round',
        strokeDasharray: circumference,
        strokeDashoffset: dashOffset,
        transform: `rotate(-90 ${center} ${center})`,
        style: { transition: 'stroke-dashoffset 0.5s ease' },
      }),
      React.createElement(
        'text',
        {
          x: center,
          y: center,
          textAnchor: 'middle',
          dominantBaseline: 'central',
          fill: color,
          fontSize: size / 5,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        },
        displayText,
      ),
    ),
    React.createElement(
      'span',
      { className: 'pp-gauge-label' },
      label,
    ),
  );
}
