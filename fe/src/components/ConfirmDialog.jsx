import Modal from './Modal';

function ConfirmDialog({
  isOpen,
  title = 'Confirm action',
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  zIndex = 140
}) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} zIndex={zIndex}>
      <p className="muted-text">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
