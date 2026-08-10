/**
 * Injection des données structurées JSON-LD.
 *
 * `JSON.stringify` sur un objet construit en TypeScript, jamais une chaîne
 * écrite à la main : c'est ce qui empêche une donnée non échappée — une
 * apostrophe dans un nom de commune, un guillemet dans une réponse de FAQ — de
 * casser le bloc entier, silencieusement, pour les robots seulement.
 *
 * `</script>` reste le seul cas que `JSON.stringify` ne protège pas : on le
 * neutralise explicitement.
 */
export function DonneesStructurees({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  const contenu = JSON.stringify(data).replace(/<\/script/gi, "<\\/script");

  return (
    <script
      type="application/ld+json"
      // Contenu construit côté serveur à partir de données de la base, pas
      // d'une saisie utilisateur libre rendue telle quelle.
      dangerouslySetInnerHTML={{ __html: contenu }}
    />
  );
}
