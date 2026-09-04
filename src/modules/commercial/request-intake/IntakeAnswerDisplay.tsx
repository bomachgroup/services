export function IntakeMultiselectAnswer({ value }: { value: unknown }) {
  const items = Array.isArray(value)
    ? value.map((item) => String(item)).filter((item) => item.length > 0)
    : []

  if (items.length === 0) return <b>—</b>

  return (
    <div className="commercial-answer-chips">
      {items.map((item) => (
        <span key={item} className="commercial-answer-chip">
          {item}
        </span>
      ))}
    </div>
  )
}
