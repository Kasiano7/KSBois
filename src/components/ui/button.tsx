import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * ⚠️ ÉCHELLE DE TAILLES MODIFIÉE PAR RAPPORT À shadcn/ui — ne pas régénérer
 * ce fichier avec `shadcn add button --overwrite` sans réappliquer ces choix.
 *
 * Les tailles d'origine (h-8 = 32 px par défaut, h-7 en `sm`) sont très en
 * dessous du minimum de 44 × 44 px imposé par le design system (docs/03 §9).
 * Notre audience est majoritairement 55+, sur téléphone, souvent avec des mains
 * de travail : une cible de 32 px est une cible ratée.
 *
 * Ajout du variant `cta` : le bouton de conversion, en braise. Il reste
 * volontairement unique par écran (discipline de couleur, docs/03 §2.1).
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        /** Conversion : « Ajouter au panier », « Payer ». Un seul par écran. */
        cta: "bg-braise text-white hover:bg-[#a83f12]",
        /**
         * Action principale du parcours d'achat public, en sève.
         *
         * ⚠️ Écart de charte assumé (docs/03 §2.1 et §9 ter) : la maquette
         * client du 9 août 2026 place l'or sur le bouton de validation. Le
         * texte est en encre et non en blanc — blanc sur sève ne donne que 2:1
         * de contraste, encre sur sève dépasse 9:1.
         *
         * Réservé au registre PUBLIC. L'administration garde `cta` en braise.
         */
        or: "bg-seve text-encre hover:bg-[#c8942f]",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-muted hover:text-foreground aria-expanded:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85 focus-visible:ring-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        /** 44 px — le plancher tactile. Taille par défaut. */
        default: "h-11 gap-2 px-4 text-[15px]",
        /** 36 px — tableaux denses de l'ADMIN uniquement, jamais sur le site public. */
        sm: "h-9 gap-1.5 px-3 text-[14px]",
        /** 48 px */
        lg: "h-12 gap-2 px-6 text-[16px]",
        /** 56 px — bouton de conversion, pleine largeur sur mobile. */
        cta: "h-14 gap-2.5 px-8 text-[17px]",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
