"use client"

import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        // ⚠️ MODIFIÉ : 15 px et semi-gras. Le design system interdit un libellé
        // de champ sous 15 px (docs/03 §3.1) — un placeholder ne remplace jamais
        // un label, il doit donc être lisible.
        "flex items-center gap-2 text-[15px] leading-none font-semibold select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
