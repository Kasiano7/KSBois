import { cn } from "@/lib/utils";

/**
 * Jauge d'humidité mesurée — élément signature secondaire (docs/03 §4.1).
 *
 * Aucun concurrent ne publie une mesure DATÉE. C'est une preuve, pas une
 * promesse, et c'est ce qui justifie un prix supérieur. La jauge ne s'affiche
 * que si une mesure existe réellement.
 */

interface JaugeHumiditeProps {
  pct: number;
  dateMesure: string | null;
  lot: string | null;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const MAX_AFFICHE = 50;

export function JaugeHumidite({ pct, dateMesure, lot, className }: JaugeHumiditeProps) {
  const position = Math.min(100, (pct / MAX_AFFICHE) * 100);
  const classe = pct <= 20 ? "sec" : pct <= 35 ? "mi-sec" : "vert";
  const libelle =
    classe === "sec"
      ? "Prêt à brûler"
      : classe === "mi-sec"
        ? "À finir de sécher environ 6 mois"
        : "Fraîchement coupé — séchage 18 à 24 mois";

  return (
    <div className={cn("bg-aubier rounded-[6px] p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p className="text-[15px] whitespace-nowrap">
          <span className="font-semibold">Humidité mesurée : {pct} %</span>
        </p>
        <span
          className={cn(
            "shrink-0 rounded-[3px] px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap",
            classe === "sec" && "bg-succes/15 text-succes",
            classe === "mi-sec" && "bg-seve/25 text-encre",
            classe === "vert" && "bg-alerte/15 text-alerte",
          )}
        >
          {libelle}
        </span>
      </div>

      <div
        className="relative mt-3 h-2.5"
        role="img"
        aria-label={`Humidité mesurée à ${pct} pour cent, classée ${classe}`}
      >
        {/* Trois segments : sec / mi-sec / vert */}
        <div className="absolute inset-0 flex gap-0.5 overflow-hidden rounded-full">
          <div className="bg-succes/35" style={{ width: "40%" }} />
          <div className="bg-seve/45" style={{ width: "30%" }} />
          <div className="bg-alerte/30" style={{ width: "30%" }} />
        </div>
        {/* Le curseur de la mesure */}
        <div
          className="border-aubier bg-encre absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="text-cendre mt-2 flex justify-between text-[11px] tabular-nums">
        <span>0 %</span>
        <span>20 %</span>
        <span>35 %</span>
        <span>{MAX_AFFICHE} %</span>
      </div>

      {(dateMesure || lot) && (
        <p className="text-cendre mt-2.5 text-[13px]">
          {[
            dateMesure && `Mesuré au testeur le ${dateFormatter.format(new Date(dateMesure))}`,
            lot,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
