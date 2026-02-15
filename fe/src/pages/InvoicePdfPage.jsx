import { useEffect, useState } from 'react';
import { ArrowLeft, Download, RotateCcw, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../api/client';
import PageHeader from '../components/PageHeader';

function InvoicePdfPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [invoiceNo, setInvoiceNo] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let mounted = true;
    let currentUrl = '';

    const loadPdf = async () => {
      setLoading(true);
      setError('');
      try {
        const [invoiceRes, pdfRes] = await Promise.all([
          api.get(`/invoices/${id}`),
          api.get(`/invoices/${id}/pdf`, { responseType: 'blob' })
        ]);

        if (!mounted) return;

        const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
        const nextUrl = URL.createObjectURL(blob);
        currentUrl = nextUrl;

        setInvoiceNo(invoiceRes?.data?.invoice?.invoiceNo || '');
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
        setZoom(1);
        setRotation(0);
      } catch (err) {
        if (!mounted) return;
        setError(apiErrorMessage(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPdf();

    return () => {
      mounted = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [id]);

  const goBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
      return;
    }
    navigate('/invoices');
  };

  const adjustZoom = (delta) => {
    setZoom((prev) => Math.min(2.5, Math.max(0.6, Number((prev + delta).toFixed(2)))));
  };

  const rotate = (delta) => {
    setRotation((prev) => {
      const next = (prev + delta) % 360;
      return next < 0 ? next + 360 : next;
    });
  };

  const resetView = () => {
    setZoom(1);
    setRotation(0);
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const anchor = document.createElement('a');
    anchor.href = pdfUrl;
    anchor.download = `${invoiceNo || 'invoice'}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  return (
    <section className="page">
      <PageHeader
        title={`Invoice PDF${invoiceNo ? ` - ${invoiceNo}` : ''}`}
        subtitle="Review and download invoice PDF in-app."
        rightSlot={(
          <div className="toolbar-row">
            <button className="btn btn-secondary btn-compact" onClick={goBack}>
              <ArrowLeft size={14} />
              Back
            </button>
            <button className="btn btn-primary btn-compact" onClick={downloadPdf} disabled={!pdfUrl}>
              <Download size={14} />
              Download
            </button>
          </div>
        )}
      />

      <article className="card p-0 overflow-hidden">
        <div className="pdf-viewer-shell">
          <div className="pdf-toolbar">
            <div className="pdf-toolbar-group">
              <button className="btn btn-secondary btn-compact" onClick={() => adjustZoom(-0.1)} disabled={!pdfUrl}>
                <ZoomOut size={14} />
              </button>
              <span className="pagination-status">{Math.round(zoom * 100)}%</span>
              <button className="btn btn-secondary btn-compact" onClick={() => adjustZoom(0.1)} disabled={!pdfUrl}>
                <ZoomIn size={14} />
              </button>
              <button className="btn btn-secondary btn-compact" onClick={() => rotate(-90)} disabled={!pdfUrl}>
                <RotateCcw size={14} />
              </button>
              <button className="btn btn-secondary btn-compact" onClick={() => rotate(90)} disabled={!pdfUrl}>
                <RotateCw size={14} />
              </button>
              <button className="btn btn-secondary btn-compact" onClick={resetView} disabled={!pdfUrl}>
                Reset
              </button>
            </div>
          </div>

          <div className="pdf-stage">
            {loading ? <p className="muted-text">Loading invoice PDF...</p> : null}
            {!loading && error ? <p className="error-text">{error}</p> : null}
            {!loading && !error && !pdfUrl ? <p className="muted-text">No PDF available.</p> : null}
            {!loading && !error && pdfUrl ? (
              <div className="pdf-frame-wrap">
                <iframe
                  src={pdfUrl}
                  title="Invoice PDF"
                  className="pdf-frame"
                  style={{ transform: `scale(${zoom}) rotate(${rotation}deg)` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </article>
    </section>
  );
}

export default InvoicePdfPage;
