"use client";

import { useEffect, useState, type ReactNode } from "react";

interface AreaOption {
  value: string;
  label: string;
}

interface ReservationDynamicFieldsProps {
  areaOptionsByLocation: Record<string, readonly AreaOption[]>;
  timeOptionsByLocation: Record<string, readonly string[]>;
  defaultLocationSlug: string;
  areaLabel: string;
  areaHint: string;
  timeLabel: string;
  timePlaceholder: string;
}

export function ReservationDynamicFields({
  areaOptionsByLocation,
  timeOptionsByLocation,
  defaultLocationSlug,
  areaLabel,
  areaHint,
  timeLabel,
  timePlaceholder,
}: ReservationDynamicFieldsProps): ReactNode {
  const [selectedSlug, setSelectedSlug] = useState(defaultLocationSlug);

  useEffect(() => {
    const handler = () => {
      const checked = document.querySelector<HTMLInputElement>('input[name="locationSlug"]:checked');
      if (checked) {
        setSelectedSlug(checked.value);
      }
    };
    handler();
    document.addEventListener("change", handler);
    return () => document.removeEventListener("change", handler);
  }, []);

  const areas = areaOptionsByLocation[selectedSlug] ?? areaOptionsByLocation[defaultLocationSlug] ?? [];
  const times = timeOptionsByLocation[selectedSlug] ?? timeOptionsByLocation[defaultLocationSlug] ?? [];
  const singleArea = areas.length === 1 ? areas[0] : null;

  return (
    <>
      <label className="area-field" data-depends-on="location">
        <span className="label-row">
          {areaLabel}
          <span className="area-field-hint">{areaHint}</span>
        </span>
        {singleArea ? (
          <>
            <input type="hidden" name="area" value={singleArea.value} />
            <span className="area-field-single">{singleArea.label}</span>
          </>
        ) : (
          <select name="area" defaultValue={areas[0]?.value ?? ""}>
            {areas.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </label>
      <label>{timeLabel}
        <select name="reservationTime" required defaultValue="">
          <option value="" disabled>{timePlaceholder}</option>
          {times.map((time) => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
      </label>
    </>
  );
}
