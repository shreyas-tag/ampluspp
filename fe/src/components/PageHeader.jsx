import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';

function PageHeader({ title, subtitle, actionLabel, actionTo, onAction, leftSlot, rightSlot }) {
  return (
    <header className="page-header">
      <div className="page-title-wrap">
        <div className="page-title-row">
          <h1>{title}</h1>
          {leftSlot || null}
        </div>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-header-right">
        {rightSlot || null}
        {actionLabel
          ? actionTo
            ? (
              <Link to={actionTo} className="btn btn-primary">
                <Plus size={14} />
                {actionLabel}
              </Link>
              )
            : (
              <button className="btn btn-primary" onClick={onAction}>
                <Plus size={14} />
                {actionLabel}
              </button>
              )
          : null}
      </div>
    </header>
  );
}

export default PageHeader;
