import { Modal } from './Modal.jsx'

/** Destructive-action confirmation. */
export function ConfirmDialog({ open, title = 'Please confirm', message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  if (!open) return null
  return (
    <Modal
      size="sm"
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            <i className="bi bi-trash3" aria-hidden="true" /> {confirmLabel}
          </button>
        </>
      }
    >
      <p className="confirm-text">{message}</p>
    </Modal>
  )
}
