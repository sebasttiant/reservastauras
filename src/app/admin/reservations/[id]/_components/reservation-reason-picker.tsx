"use client";

import { useId, useMemo, useState } from "react";

interface ReservationReasonPickerProps {
  variant: "reject" | "cancel";
  required?: boolean;
}

const REASON_PRESETS: Array<{ value: string; label: string }> = [
  { value: "Por solicitud del cliente", label: "Por solicitud del cliente" },
  { value: "No hay disponibilidad para la fecha solicitada", label: "No hay disponibilidad para la fecha solicitada" },
  { value: "No fue posible contactar al cliente", label: "No fue posible contactar al cliente" },
  { value: "Información incompleta de la reserva", label: "Información incompleta de la reserva" },
];

const DEFAULT_LABEL: Record<ReservationReasonPickerProps["variant"], string> = {
  reject: "Motivo del rechazo",
  cancel: "Motivo de la cancelación",
};

const CUSTOM_OPTION_VALUE = "__custom__";

export function ReservationReasonPicker({ variant, required = false }: ReservationReasonPickerProps) {
  const selectId = useId();
  const customId = useId();
  const [selected, setSelected] = useState<string>("");
  const [customValue, setCustomValue] = useState<string>("");

  const isCustom = selected === CUSTOM_OPTION_VALUE;
  const hiddenValue = useMemo(() => {
    if (!selected) return "";
    if (isCustom) return customValue.trim();
    return selected;
  }, [selected, isCustom, customValue]);

  return (
    <div className="reason-picker">
      <label htmlFor={selectId}>
        {DEFAULT_LABEL[variant]}
        {required ? "" : " (opcional)"}
      </label>
      <select
        id={selectId}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
        required={required}
      >
        <option value="">Seleccioná un motivo…</option>
        {REASON_PRESETS.map((preset) => (
          <option key={preset.value} value={preset.value}>
            {preset.label}
          </option>
        ))}
        <option value={CUSTOM_OPTION_VALUE}>Otro</option>
      </select>

      {isCustom ? (
        <label htmlFor={customId} className="reason-picker-custom">
          Motivo personalizado
          <textarea
            id={customId}
            name="reasonCustom"
            value={customValue}
            onChange={(event) => setCustomValue(event.target.value)}
            placeholder="Describí brevemente el motivo…"
            rows={2}
            required={required}
          />
        </label>
      ) : null}

      <input type="hidden" name="reason" value={hiddenValue} />
    </div>
  );
}
