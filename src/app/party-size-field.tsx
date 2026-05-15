"use client";

import { useState } from "react";

const PARTY_SIZE_ALERT_ID = "partySize-alert";

interface PartySizeFieldProps {
  label: string;
  alertCopy: string;
  defaultValue: number;
}

export function PartySizeField({ label, alertCopy, defaultValue }: PartySizeFieldProps) {
  const [isAlertVisible, setIsAlertVisible] = useState(false);

  return (
    <div className="field-with-hint party-size-field">
      <label htmlFor="partySize">{label}</label>
      <input
        id="partySize"
        name="partySize"
        type="number"
        min={1}
        max={30}
        defaultValue={defaultValue}
        required
        aria-describedby={isAlertVisible ? PARTY_SIZE_ALERT_ID : undefined}
        onChange={(event) => setIsAlertVisible(event.currentTarget.value.trim().length > 0)}
      />
      <div
        id={PARTY_SIZE_ALERT_ID}
        className="party-size-alert"
        data-visible={isAlertVisible ? "true" : "false"}
        role="status"
        aria-live="polite"
        aria-hidden={!isAlertVisible}
      >
        {isAlertVisible ? (
          <>
            <span className="party-size-alert-icon" aria-hidden="true">ⓘ</span>
            <span className="party-size-alert-copy">{alertCopy}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
