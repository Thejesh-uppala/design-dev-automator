import React from 'react';

interface ColorSwatchProps {
  color: string;
}

export function ColorSwatch({ color }: ColorSwatchProps) {
  return React.createElement('span', {
    className: 'pp-swatch',
    style: { backgroundColor: color },
    title: color,
  });
}
