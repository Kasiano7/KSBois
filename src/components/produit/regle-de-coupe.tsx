"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * LA RÈGLE DE COUPE — élément signature du site (docs/03-DESIGN-SYSTEM.md §4)
 *
 * Les bûches sont dessinées à l'ÉCHELLE RÉELLE RELATIVE : celle de 50 cm fait
 * exactement deux fois la longueur de celle de 25 cm. Ce n'est pas une
 * décoration, c'est la réponse à la vraie question d'achat — « est-ce que ça
 * rentre dans mon poêle ? »
 *
 * Accessibilité : la sémantique est portée par un vrai groupe de boutons radio.
 * Le dessin n'est qu'une couche de présentation (aria-hidden).
 */

export interface CutLengthOption {
  id: string;
  cm: number;
  label: string;
  hint?: string;
  isAvailable?: boolean;
}

interface RegleDeCoupeProps {
  options: CutLengthOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

export function RegleDeCoupe({ options, value, onChange, className }: RegleDeCoupeProps) {
  const groupId = useId();
  const maxCm = Math.max(...options.map((o) => o.cm));
  const selected = options.find((o) => o.id === value) ?? options[0];

  return (
    <fieldset className={cn("border-0 p-0", className)}>
      <legend className="micro-label text-cendre mb-4">Longueur de coupe</legend>

      <div className="space-y-1.5">
        {options.map((option) => {
          const inputId = `${groupId}-${option.id}`;
          const isSelected = option.id === value;
          const isAvailable = option.isAvailable !== false;
          // Échelle réelle : la largeur est strictement proportionnelle.
          const widthPct = (option.cm / maxCm) * 100;

          return (
            <div key={option.id} className="relative">
              <input
                type="radio"
                id={inputId}
                name={groupId}
                value={option.id}
                checked={isSelected}
                disabled={!isAvailable}
                onChange={() => onChange(option.id)}
                className="peer sr-only"
              />
              <label
                htmlFor={inputId}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-[4px] py-2 pr-3 pl-2",
                  "transition-colors duration-150",
                  "peer-focus-visible:outline-braise peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                  isSelected ? "bg-sapin/6" : "hover:bg-encre/4",
                  !isAvailable && "cursor-not-allowed opacity-40",
                )}
              >
                <span
                  className={cn(
                    "tabulaire w-14 shrink-0 text-right text-[15px] font-semibold tabular-nums",
                    isSelected ? "text-encre" : "text-cendre",
                  )}
                >
                  {option.label}
                </span>

                {/* La bûche, dessinée à l'échelle */}
                <span className="relative block h-7 flex-1" aria-hidden="true">
                  <span
                    className={cn(
                      "absolute top-0 left-0 h-full rounded-r-[3px] rounded-l-[2px]",
                      "transition-[width,background-color] duration-200",
                      isSelected ? "bg-[#6B4A2E]" : "bg-[#8A7259]",
                    )}
                    style={{
                      width: `${widthPct}%`,
                      backgroundImage:
                        "repeating-linear-gradient(90deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 7px)",
                    }}
                  >
                    {/* Face de coupe : les cernes, en ellipses (vue de trois quarts) */}
                    <span className="absolute inset-y-0 right-0 flex w-[13px] items-center justify-center overflow-hidden rounded-r-[3px] bg-[#C9AA84]">
                      <span className="absolute block h-[22px] w-[11px] rounded-[50%] border border-[#8A6B47]/60" />
                      <span className="absolute block h-[13px] w-[6px] rounded-[50%] border border-[#8A6B47]/60" />
                      <span className="absolute block h-[4px] w-[2px] rounded-[50%] bg-[#7A5B3A]" />
                    </span>
                  </span>
                </span>
              </label>
            </div>
          );
        })}
      </div>

      {/* Règle graduée — repère d'échelle commun à toutes les bûches */}
      <div className="mt-2 ml-[4.75rem] pr-3" aria-hidden="true">
        <div className="border-aubier-bord relative h-4 border-t">
          {options.map((option) => (
            <span
              key={option.id}
              className="bg-aubier-bord absolute top-0 h-[5px] w-px"
              style={{ left: `${(option.cm / maxCm) * 100}%` }}
            />
          ))}
          <span className="text-cendre absolute top-[6px] left-0 text-[10px] tabular-nums">0</span>
          <span className="text-cendre absolute top-[6px] right-0 text-[10px] tabular-nums">
            {options.find((o) => o.cm === maxCm)?.label ?? `${maxCm} cm`}
          </span>
        </div>
      </div>

      {selected?.hint && (
        <p className="text-cendre mt-3 text-[15px]">
          <span className="text-encre font-semibold">{selected.cm} cm</span> — {selected.hint}
        </p>
      )}
    </fieldset>
  );
}
