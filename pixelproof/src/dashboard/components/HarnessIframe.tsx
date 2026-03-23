import React, { useEffect, useState } from 'react';

interface HarnessIframeProps {
  file: string;
  exportName: string;
  port: number;
}

export function HarnessIframe({ file, exportName, port }: HarnessIframeProps) {
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'render-error') {
        setRenderError(event.data.error || 'Unknown render error');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const src = `http://localhost:${port}/harness?component=${encodeURIComponent(file)}&export=${encodeURIComponent(exportName)}`;

  return React.createElement(
    'div',
    null,
    renderError &&
      React.createElement(
        'div',
        {
          className: 'pp-card',
          style: {
            color: 'var(--red)',
            background: 'rgba(239, 68, 68, 0.1)',
            marginBottom: 12,
          },
        },
        `Render error: ${renderError}`,
      ),
    React.createElement('iframe', {
      src,
      style: {
        width: '100%',
        height: 400,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'white',
      },
      title: 'Component Preview',
    }),
  );
}
