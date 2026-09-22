"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { clearHistory } from "@/lib/db/pomodoro";
import { DEFAULT_SETTINGS, SETTING_LIMITS, type PomodoroSettings } from "@/lib/pomodoro/timer";

import { notificationsSupported, requestNotifications } from "./alerts";

type NumericSetting = keyof typeof SETTING_LIMITS;

const NUMBER_FIELDS: { key: NumericSetting; label: string }[] = [
  { key: "focusMinutes", label: "Focus (minutes)" },
  { key: "shortBreakMinutes", label: "Short break (minutes)" },
  { key: "longBreakMinutes", label: "Long break (minutes)" },
  { key: "longBreakEvery", label: "Long break after" },
];

export function TimerSettings({
  settings,
  onChange,
  sound,
  onSoundChange,
  notifications,
  onNotificationsChange,
}: {
  settings: PomodoroSettings;
  onChange: (settings: PomodoroSettings) => void;
  sound: boolean;
  onSoundChange: (on: boolean) => void;
  notifications: boolean;
  onNotificationsChange: (on: boolean) => void;
}) {
  const [notice, setNotice] = useState("");
  const [generation, setGeneration] = useState(0);

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Timer settings
      </summary>
      <div className="flex flex-col gap-5 border-t p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUMBER_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`setting-${key}`} className="text-muted-foreground text-xs">
                {label}
              </Label>
              <Input
                id={`setting-${key}`}
                type="number"
                inputMode="numeric"
                className="h-9"
                min={SETTING_LIMITS[key].min}
                max={SETTING_LIMITS[key].max}
                // Uncontrolled, so a half-typed number is left alone; remounted
                // by "Restore defaults" so the reset shows.
                key={generation}
                defaultValue={settings[key]}
                onChange={(event) => {
                  const value = Math.round(Number(event.target.value));
                  const { min, max } = SETTING_LIMITS[key];
                  if (event.target.value !== "" && value >= min && value <= max) {
                    onChange({ ...settings, [key]: value });
                  }
                }}
              />
            </div>
          ))}
        </div>
        <p className="text-muted-foreground -mt-3 text-xs text-pretty">
          The long break comes after this many focus sessions. Changes apply from the next session;
          one already running keeps its length.
        </p>

        <div className="flex flex-col gap-3">
          <SwitchRow
            id="auto-breaks"
            label="Start breaks automatically"
            checked={settings.autoStartBreaks}
            onChange={(on) => onChange({ ...settings, autoStartBreaks: on })}
          />
          <SwitchRow
            id="auto-focus"
            label="Start focus automatically after a break"
            checked={settings.autoStartFocus}
            onChange={(on) => onChange({ ...settings, autoStartFocus: on })}
          />
          <SwitchRow
            id="sound"
            label="Chime when time is up"
            checked={sound}
            onChange={onSoundChange}
          />
          <SwitchRow
            id="notifications"
            label="Notify me when this page is in the background"
            checked={notifications}
            onChange={async (on) => {
              if (!on) {
                onNotificationsChange(false);
                return;
              }
              const allowed = await requestNotifications();
              onNotificationsChange(allowed);
              setNotice(
                allowed
                  ? ""
                  : notificationsSupported()
                    ? "Notifications are blocked for this site in your browser settings."
                    : "This browser cannot show notifications. The chime still plays.",
              );
            }}
          />
          {notice ? (
            <p role="status" className="text-muted-foreground text-xs">
              {notice}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onChange(DEFAULT_SETTINGS);
              setGeneration((value) => value + 1);
            }}
          >
            Restore defaults
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (window.confirm("Delete your whole focus history? Tasks are kept.")) {
                void clearHistory();
              }
            }}
          >
            Clear focus history
          </Button>
        </div>
      </div>
    </details>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={(on) => void onChange(on)} />
    </div>
  );
}
