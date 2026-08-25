"use client";

import { ICON_PICKER_LIST, COLOR_SWATCHES, getIcon } from "@/lib/budget/icons";

interface Props {
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

export default function IconColorPicker({ icon, color, onIconChange, onColorChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Icon</p>
        <div className="grid grid-cols-8 gap-1.5 max-h-32 overflow-y-auto p-1">
          {ICON_PICKER_LIST.map((name) => {
            const Icon = getIcon(name);
            const active = icon === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onIconChange(name)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors ${
                  active
                    ? "border-transparent text-white"
                    : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                }`}
                style={active ? { backgroundColor: color } : undefined}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">Color</p>
        <div className="flex flex-wrap gap-1.5">
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onColorChange(c)}
              className={`w-7 h-7 rounded-full transition-transform ${
                color === c ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
