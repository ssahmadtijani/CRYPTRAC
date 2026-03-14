/**
 * ExportButton — Universal export dropdown button.
 * Downloads the export directly to the user's browser.
 */

import { useState, useRef, useEffect } from 'react';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface Props {
  endpoint: string;
  filename: string;
  formats?: ExportFormat[];
  disabled?: boolean;
  className?: string;
}

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  pdf: 'PDF',
};

const FORMAT_ICONS: Record<ExportFormat, string> = {
  csv: '📄',
  json: '{}',
  pdf: '📑',
};

export default function ExportButton({
  endpoint,
  filename,
  formats = ['csv', 'json', 'pdf'],
  disabled = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    setError(null);
    setOpen(false);

    try {
      const token = localStorage.getItem('token');
      const sep = endpoint.includes('?') ? '&' : '?';
      const url = `/api/v1${endpoint}${sep}format=${format}`;

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const ext = format;
      const downloadName = `${filename}.${ext}`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`export-btn-container ${className}`} ref={containerRef}>
      <button
        className="btn btn-secondary export-btn"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled || loading !== null}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {loading ? (
          <>
            <span className="spinner spinner-sm" />
            Exporting…
          </>
        ) : (
          <>⬇ Export</>
        )}
      </button>

      {open && (
        <div className="export-dropdown" role="menu">
          {formats.map((fmt) => (
            <button
              key={fmt}
              className="export-dropdown-item"
              onClick={() => void handleExport(fmt)}
              role="menuitem"
            >
              <span className="edf-icon">{FORMAT_ICONS[fmt]}</span>
              <span className="edf-label">{FORMAT_LABELS[fmt]}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="export-error">{error}</div>
      )}
    </div>
  );
}
