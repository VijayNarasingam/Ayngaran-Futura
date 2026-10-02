const INPUT_TYPES = {
  text: 'text',
  tel: 'tel',
  email: 'email',
  number: 'number',
  currency: 'number',
  percent: 'number',
  date: 'date',
}

export const normaliseOptions = (options) =>
  (options || []).map((option) => (typeof option === 'string' ? { value: option, label: option } : option))

/** Converts form strings into the right JS types before saving. */
export const coerceValues = (values, fields) => {
  const out = {}
  fields.forEach((field) => {
    if (field.computed) return
    const raw = values[field.key]
    const text = raw === undefined || raw === null ? '' : String(raw).trim()
    if (text === '') {
      out[field.key] = ''
      return
    }
    if (['number', 'currency', 'percent'].includes(field.type)) {
      const parsed = parseFloat(text)
      out[field.key] = Number.isFinite(parsed) ? parsed : ''
      return
    }
    out[field.key] = text
  })
  return out
}

export function FormField({ field, value, error, onChange }) {
  const inputId = `field-${field.key}`
  const options = normaliseOptions(typeof field.options === 'function' ? field.options() : field.options)
  const isStatic = field.computed || field.readonly
  const current = value === undefined || value === null ? '' : String(value)
  const onChangeValue = (next) => onChange(field.key, next)

  let control
  if (field.type === 'textarea') {
    control = (
      <textarea
        id={inputId}
        className="input input-area"
        rows={3}
        placeholder={field.placeholder}
        value={current}
        onChange={(event) => onChangeValue(event.target.value)}
      />
    )
  } else if (field.type === 'select') {
    control = (
      <select
        id={inputId}
        className="input"
        value={current}
        onChange={(event) => onChangeValue(event.target.value)}
      >
        <option value="">{field.placeholder || 'Select'}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    )
  } else if (field.type === 'datalist') {
    const listId = `list-${field.key}`
    control = (
      <>
        <input
          id={inputId}
          className="input"
          list={listId}
          autoComplete="off"
          placeholder={field.placeholder}
          value={current}
          onChange={(event) => onChangeValue(event.target.value)}
        />
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.value} value={option.value} />
          ))}
        </datalist>
      </>
    )
  } else {
    control = (
      <input
        id={inputId}
        className={`input ${isStatic ? 'input-static' : ''}`.trim()}
        type={isStatic ? 'text' : INPUT_TYPES[field.type] || 'text'}
        step={field.step || (field.type === 'currency' || field.type === 'percent' ? '0.01' : undefined)}
        min={field.min}
        readOnly={isStatic}
        tabIndex={isStatic ? -1 : undefined}
        placeholder={field.placeholder}
        value={current}
        onChange={(event) => onChangeValue(event.target.value)}
      />
    )
  }

  return (
    <div className={`field ${field.span ? `span-${field.span}` : ''}`.trim()}>
      <label className="field-label" htmlFor={inputId}>
        {field.label}
        {field.required ? <span className="req"> *</span> : null}
        {isStatic ? <span className="auto-tag">auto</span> : null}
      </label>
      {control}
      {field.hint ? <p className="field-hint">{field.hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  )
}

export function FormGrid({ fields, values, errors = {}, onChange, before, after }) {
  return (
    <div className="form-grid">
      {before}
      {fields.map((field) => (
        <FormField
          key={`${field.key}-${values.__typeKey || ''}`}
          field={field}
          value={field.computed ? field.computed(values) : values[field.key]}
          error={errors[field.key]}
          onChange={onChange}
        />
      ))}
      {after}
    </div>
  )
}

/** Validates a fields array against form values; returns an errors map. */
export const validateValues = (values, fields) => {
  const errors = {}
  fields.forEach((field) => {
    if (!field.required || field.computed || field.readonly) return
    const value = values[field.key]
    if (value === undefined || value === null || String(value).trim() === '') {
      errors[field.key] = `${field.label} is required.`
    }
  })
  return errors
}
