import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * ⚠️ MODIFIÉ PAR RAPPORT À shadcn/ui — ne pas régénérer sans réappliquer :
 *  • hauteur portée de 32 px à 48 px (cible tactile, docs/03 §9) ;
 *  • taille de texte fixée à 17 px, sans le `md:text-sm` d'origine qui
 *    RÉDUISAIT le texte sur grand écran — l'inverse de ce dont notre audience
 *    a besoin (docs/03 §3.1) ;
 *  • rayon aligné sur le token `--radius-champ` (4 px).
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-[4px] border border-input bg-card px-3.5 py-2 text-[17px] transition-colors outline-none",
        "file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-[15px] file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
