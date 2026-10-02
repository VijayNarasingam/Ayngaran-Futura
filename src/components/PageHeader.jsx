/** Shared page header: breadcrumb, title, subtitle and right side actions. */
export function PageHeader({ crumb, title, subtitle, actions, children }) {
  return (
    <header className="page-head">
      <div className="page-head-text">
        {crumb ? <p className="crumb">{crumb}</p> : null}
        <h1>{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </header>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || action ? (
        <div className="panel-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted-sm">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="panel-body">{children}</div>
    </section>
  )
}
