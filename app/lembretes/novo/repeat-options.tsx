"use client";

import { useState } from "react";

const weekdays = [
  ["MO", "Seg"],
  ["TU", "Ter"],
  ["WE", "Qua"],
  ["TH", "Qui"],
  ["FR", "Sex"],
  ["SA", "Sáb"],
  ["SU", "Dom"],
] as const;

export function RepeatOptions() {
  const [repeats, setRepeats] = useState(false);

  return (
    <fieldset className="repeatBox">
      <label className="checkLabel">
        <input name="repeat" type="checkbox" checked={repeats} onChange={(event) => setRepeats(event.target.checked)} />
        <span><strong>Repetir</strong><small>Escolha em quais dias da semana este lembrete será enviado.</small></span>
      </label>
      {repeats && (
        <div className="weekdayPicker" role="group" aria-label="Dias da semana">
          {weekdays.map(([value, label]) => (
            <label key={value}>
              <input name="weekdays" type="checkbox" value={value} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
