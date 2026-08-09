import { Skeleton } from "@/components/ui/skeleton";

export default function ChargementStatistiques() {
  return (
    <main className="mx-auto w-full max-w-[1500px] p-5 sm:p-8" aria-busy="true" aria-label="Chargement des statistiques">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="mt-4 h-5 w-full max-w-xl" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-[8px]" />)}
      </div>
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48 rounded-[8px]" />)}
      </div>
    </main>
  );
}
