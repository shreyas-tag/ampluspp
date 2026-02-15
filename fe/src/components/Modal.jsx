function Modal({ isOpen, title, onClose, children, zIndex = 100, cardClassName = '', bodyClassName = '' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex }} onClick={onClose}>
      <div className={`modal-card ${cardClassName}`.trim()} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}>
            x
          </button>
        </div>
        <div className={`modal-body ${bodyClassName}`.trim()}>{children}</div>
      </div>
    </div>
  );
}

export default Modal;
