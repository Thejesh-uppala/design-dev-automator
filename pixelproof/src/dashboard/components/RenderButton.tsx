import React from 'react';
import type { RenderStatus } from '../../scoring/types.js';

interface RenderButtonProps {
  file: string;
  exportName: string;
  renderStatus: RenderStatus;
  isRendering: boolean;
  onRender: (file: string, exportName: string) => void;
}

export function RenderButton({
  file,
  exportName,
  renderStatus,
  isRendering,
  onRender,
}: RenderButtonProps) {
  const label =
    renderStatus === 'rendered' || renderStatus === 'error'
      ? 'Re-render'
      : 'Render';

  return React.createElement(
    'button',
    {
      className: 'pp-btn pp-btn--primary',
      onClick: () => onRender(file, exportName),
      disabled: isRendering,
    },
    isRendering ? 'Rendering...' : label,
  );
}
