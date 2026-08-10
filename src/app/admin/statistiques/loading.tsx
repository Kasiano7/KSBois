import { Skeleton } from "@/components/ui/skeleton";

export default function ChargementStatistiques() {
  return (
    <main
      className="mx-auto w-full max-w-[1560px] p-5 sm:p-8"
      aria-busy="true"
      aria-label="Chargement des statistiques"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-11 w-64" />
          <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        </div>
        <Skeleton className="h-12 w-full max-w-[420px] rounded-[12px]" />
      </div>

      <div className="mt-11 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-[14px]" />
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.9fr_1fr]">
        <Skeleton className="h-[420px] rounded-[14px]" />
        <Skeleton className="h-[420px] rounded-[14px]" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-[14px]" />
        ))}
      </div>
    </main>
  );
}
