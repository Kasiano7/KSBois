/**
 * Guides — docs/06 §1.4.
 *
 * Le contenu vit dans le CODE et non en base, et c'est un choix : il n'y a pas
 * d'éditeur de texte riche dans l'administration, et il n'y en aura pas avant
 * le lot 3. Mettre ces textes en base signifierait les rendre modifiables via
 * un champ brut, avec le risque de casser la mise en page — pour un contenu qui
 * change une fois par an.
 *
 * Ils ciblent des requêtes réelles (« combien de stères pour l'hiver »,
 * « taux d'humidité bois de chauffage ») et servent d'abord le référencement
 * local. Le terme « stère » y est employé librement : c'est ce que les gens
 * cherchent. Le m³ apparent reste l'unité des zones transactionnelles et
 * légales (PLAN.md §3.1).
 */

export interface SectionGuide {
  titre: string;
  paragraphes: string[];
  liste?: string[];
}

export interface Guide {
  slug: string;
  titre: string;
  /** Titre de page, ≤ 60 caractères une fois le nom de l'entreprise ajouté. */
  titreSeo: string;
  description: string;
  chapeau: string;
  publieLe: string;
  minutesLecture: number;
  sections: SectionGuide[];
  faq: Array<{ question: string; reponse: string }>;
}

export const GUIDES: Guide[] = [
  {
    slug: "combien-de-bois-pour-l-hiver",
    titre: "Combien de bois faut-il pour passer l'hiver ?",
    titreSeo: "Combien de stères de bois pour l'hiver ?",
    description:
      "Estimer la quantité de bois de chauffage nécessaire selon la surface, l'isolation et le type d'appareil. Repères concrets et erreurs fréquentes.",
    chapeau:
      "C'est la question qu'on nous pose le plus. Il n'existe pas de réponse universelle, mais il existe de bons repères — et deux ou trois erreurs qui coûtent cher.",
    publieLe: "2026-08-10",
    minutesLecture: 5,
    sections: [
      {
        titre: "Les repères de base",
        paragraphes: [
          "Pour un chauffage d'appoint dans une maison correctement isolée, comptez 3 à 5 m³ apparents par hiver. Pour un chauffage principal, la fourchette monte à 8 à 15 m³ apparents selon la surface et l'isolation.",
          "Ces chiffres supposent du bois sec. Du bois humide brûle mal, chauffe moins et vous en consommerez davantage pour le même confort — parfois 30 % de plus.",
        ],
        liste: [
          "Appoint, maison isolée de 100 m² : 3 à 5 m³ apparents",
          "Chauffage principal, maison isolée de 100 m² : 8 à 12 m³ apparents",
          "Chauffage principal, maison ancienne peu isolée : 12 à 18 m³ apparents",
          "Poêle utilisé les soirs d'hiver seulement : 2 à 3 m³ apparents",
        ],
      },
      {
        titre: "Ce qui fait vraiment varier la consommation",
        paragraphes: [
          "L'isolation pèse plus que la surface. Une maison de 150 m² bien isolée consomme souvent moins qu'une maison de 90 m² sans isolation des combles.",
          "Le rendement de l'appareil compte tout autant. Un insert récent restitue 70 à 80 % de l'énergie du bois ; une cheminée ouverte, 10 à 15 %. À confort égal, le rapport de consommation est du simple au quintuple.",
          "Enfin, l'essence du bois change la donne : le chêne et le hêtre dégagent plus d'énergie à volume égal que le peuplier ou le sapin.",
        ],
      },
      {
        titre: "L'erreur la plus fréquente : commander trop juste",
        paragraphes: [
          "Beaucoup de clients commandent au plus juste en octobre, puis rappellent en janvier. C'est le pire moment : les stocks de bois sec sont bas partout, les délais s'allongent et les prix sont au plus haut.",
          "Le bois sec ne se dégrade pas s'il est correctement stocké. Prévoir large, c'est acheter au bon prix et ne pas dépendre de la disponibilité en plein hiver.",
        ],
      },
    ],
    faq: [
      {
        question: "Un stère et un mètre cube apparent, est-ce la même chose ?",
        reponse:
          "Pas tout à fait. Le stère correspond à 1 m³ apparent de rondins d'un mètre. Recoupé plus court, le bois s'empile plus dense : 1 m³ apparent de bûches de 33 cm contient la matière d'environ 1,43 stère. C'est pourquoi nous vendons en mètres cubes apparents, la seule unité légale depuis 1977.",
      },
      {
        question: "Vaut-il mieux commander en une fois ou en plusieurs livraisons ?",
        reponse:
          "En une fois, si vous avez la place. Chaque livraison a un coût fixe, et le tarif au mètre cube baisse avec le volume commandé.",
      },
      {
        question: "Combien de temps le bois se conserve-t-il ?",
        reponse:
          "Plusieurs années s'il est abrité de la pluie et ventilé. Du bois sec stocké correctement reste sec ; c'est le contact avec le sol et la pluie qui le dégrade.",
      },
    ],
  },
  {
    slug: "taux-d-humidite-du-bois",
    titre: "Le taux d'humidité, le seul critère qui compte vraiment",
    titreSeo: "Taux d'humidité du bois de chauffage",
    description:
      "Pourquoi l'humidité du bois de chauffage détermine son pouvoir calorifique, comment la mesurer, et ce que veut dire « bois sec » chez un vendeur sérieux.",
    chapeau:
      "« Bois sec » ne veut rien dire tant que personne n'a mesuré. Voici ce que recouvre le terme, et comment vérifier vous-même.",
    publieLe: "2026-08-10",
    minutesLecture: 4,
    sections: [
      {
        titre: "Trois classes, trois usages",
        paragraphes: [
          "La réglementation distingue trois classes selon l'humidité sur masse brute. Elles ne s'utilisent pas de la même façon.",
        ],
        liste: [
          "Sec, 20 % d'humidité ou moins : prêt à brûler immédiatement",
          "Mi-sec, entre 20 et 35 % : à finir de sécher six mois à un an",
          "Vert, plus de 35 % : fraîchement coupé, 18 à 24 mois de séchage",
        ],
      },
      {
        titre: "Ce que coûte le bois humide",
        paragraphes: [
          "Brûler du bois à 35 % d'humidité, c'est consacrer une partie de l'énergie à évaporer l'eau qu'il contient au lieu de chauffer la pièce. Le pouvoir calorifique réel chute d'environ un tiers.",
          "L'autre coût est invisible : la combustion incomplète encrasse le conduit, produit du bistre et augmente le risque de feu de cheminée. Un ramoneur reconnaît immédiatement une installation alimentée en bois humide.",
        ],
      },
      {
        titre: "Comment vérifier soi-même",
        paragraphes: [
          "Un testeur d'humidité coûte une vingtaine d'euros. Fendez une bûche et mesurez au cœur, pas en surface : l'extérieur d'une bûche stockée dehors est toujours plus sec que l'intérieur.",
          "Sans appareil, quelques indices : le bois sec est plus léger, il sonne clair quand on cogne deux bûches, son écorce se détache facilement, et ses extrémités présentent des fentes radiales.",
        ],
      },
    ],
    faq: [
      {
        question: "Comment savoir si le bois livré est vraiment sec ?",
        reponse:
          "Demandez la mesure. Nous indiquons le taux d'humidité mesuré au testeur, avec la date de mesure et le lot concerné. Un vendeur qui écrit « bois sec » sans jamais donner de chiffre ne mesure probablement pas.",
      },
      {
        question: "Le bois sec est-il plus cher ?",
        reponse:
          "À l'achat oui, à l'usage non. Il faut environ un tiers de bois humide en plus pour la même chaleur, sans compter l'encrassement du conduit.",
      },
    ],
  },
  {
    slug: "bien-stocker-son-bois",
    titre: "Bien stocker son bois de chauffage",
    titreSeo: "Comment stocker son bois de chauffage",
    description:
      "Où et comment empiler son bois pour qu'il reste sec : abri, ventilation, distance au sol, orientation. Les erreurs qui gâchent une livraison.",
    chapeau:
      "Un bois livré sec peut redevenir humide en un hiver s'il est mal stocké. Trois règles suffisent à l'éviter.",
    publieLe: "2026-08-10",
    minutesLecture: 4,
    sections: [
      {
        titre: "Trois règles qui suffisent",
        paragraphes: [
          "Le bois a besoin d'être protégé de la pluie par le dessus, décollé du sol, et traversé par l'air. Le reste est du confort.",
        ],
        liste: [
          "Couvrir le dessus seulement : une bâche qui enveloppe le tas emprisonne l'humidité",
          "Surélever de 10 cm au minimum : palettes, madriers, ou lit de graviers",
          "Laisser 10 cm entre le tas et le mur, pour que l'air circule",
          "Orienter le tas face au vent dominant plutôt qu'à l'abri",
        ],
      },
      {
        titre: "Où empiler",
        paragraphes: [
          "Un abri ouvert sur trois côtés est l'idéal. À défaut, le long d'un mur exposé au sud ou à l'ouest, avec une tôle ou une bâche posée en toiture et débordant largement.",
          "Évitez le garage fermé et la cave : sans ventilation, le bois ne sèche pas et peut moisir. Évitez aussi le contact direct avec la terre, qui fait remonter l'humidité par capillarité.",
        ],
      },
      {
        titre: "Préparer la livraison",
        paragraphes: [
          "Le jour de la livraison, dégagez l'accès et repérez l'emplacement de déchargement. Un camion chargé a besoin d'un passage large et d'un sol stable.",
          "Si le chemin est étroit, en pente, ou si le déchargement doit se faire à un endroit précis, signalez-le à la commande : c'est prévu dans le formulaire, et cela évite la livraison ratée.",
        ],
      },
    ],
    faq: [
      {
        question: "Faut-il bâcher le bois ?",
        reponse:
          "Uniquement le dessus. Une bâche qui descend jusqu'au sol transforme le tas en serre : l'humidité monte du sol et ne s'évacue plus.",
      },
      {
        question: "Combien de place prend un mètre cube apparent ?",
        reponse:
          "Environ un mètre de large sur un mètre de haut et un mètre de profondeur, une fois rangé. En vrac, prévoyez un tiers de volume en plus avant rangement.",
      },
    ],
  },
  {
    slug: "quelle-longueur-de-buche-choisir",
    titre: "Quelle longueur de bûche choisir ?",
    titreSeo: "Quelle longueur de bûche pour votre poêle ?",
    description:
      "25, 33, 40 ou 50 cm : comment choisir la longueur de bûche adaptée à son poêle, son insert ou sa chaudière, et pourquoi le prix varie avec la coupe.",
    chapeau:
      "La bonne longueur, c'est celle qui entre dans votre foyer avec de la marge. Voici comment la déterminer sans se tromper.",
    publieLe: "2026-08-10",
    minutesLecture: 3,
    sections: [
      {
        titre: "Mesurer avant de commander",
        paragraphes: [
          "Mesurez la largeur intérieure de votre foyer, puis retirez 5 cm. C'est votre longueur maximale : une bûche qui touche les parois se charge mal et abîme le vermiculite.",
          "En cas de doute, prenez plus court. Une bûche trop longue est inutilisable ; une bûche plus courte brûle parfaitement.",
        ],
        liste: [
          "25 cm : petits poêles, foyers compacts, appoint",
          "33 cm : la longueur la plus courante, convient à la majorité des poêles et inserts",
          "40 cm : grands inserts et foyers larges",
          "50 cm : chaudières bois et cheminées ouvertes",
        ],
      },
      {
        titre: "Pourquoi le prix varie avec la longueur",
        paragraphes: [
          "Plus la coupe est courte, plus il y a de passages à la scie et de manutention pour un même volume de bois. Le prix au mètre cube apparent est donc plus élevé en 25 cm qu'en 50 cm.",
          "Il y a une seconde raison, moins évidente : le bois court s'empile plus dense. Un mètre cube apparent de bûches de 25 cm contient plus de matière — donc plus d'énergie — qu'un mètre cube apparent de bûches d'un mètre.",
        ],
      },
    ],
    faq: [
      {
        question: "Peut-on mélanger plusieurs longueurs ?",
        reponse:
          "Oui, et c'est même pratique : des bûches courtes pour lancer le feu, des plus longues pour tenir la nuit. Il suffit de le préciser à la commande.",
      },
      {
        question: "Le prix au mètre cube est plus cher en 25 cm, est-ce normal ?",
        reponse:
          "Oui. Une coupe courte demande davantage de sciage et de manutention, et le bois court s'empile plus dense — vous recevez plus de matière pour le même volume apparent.",
      },
    ],
  },
];

export function getGuide(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
