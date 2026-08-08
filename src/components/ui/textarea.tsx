import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // ⚠️ MODIFIÉ : `md:text-sm` retiré (le texte ne doit pas rétrécir sur
        // grand écran), taille fixée à 17 px, rayon aligné sur --radius-champ.
        "flex field-sizing-content min-h-24 w-full rounded-[4px] border border-input bg-card px-3.5 py-2.5 text-[17px] transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
