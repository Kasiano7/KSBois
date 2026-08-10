/**
 * Départements français : centre approximatif et rayon de couverture.
 *
 * Sert UNIQUEMENT à savoir quels départements interroger sur geo.api.gouv.fr
 * quand on cherche les communes autour d'un dépôt. Sans cette table, il faudrait
 * télécharger les 35 000 communes de France (4,8 Mo, ~25 s) à chaque analyse.
 *
 * `rayonKm` est la distance entre le centre calculé et la commune la PLUS
 * ÉLOIGNÉE du département : le test « distance(dépôt, centre) ≤ rayonKm + rayon
 * recherché » ne peut donc jamais écarter un département qui contient une
 * commune éligible. C'est un filtre sûr, pas une approximation.
 *
 * Données dérivées du centre des communes publié par geo.api.gouv.fr
 * (source officielle Etalab). À régénérer si les fusions de communes déplacent
 * sensiblement un centre — en pratique, jamais.
 */

export interface DepartementReference {
  code: string;
  lat: number;
  lng: number;
  /** Distance du centre à la commune la plus éloignée du département. */
  rayonKm: number;
}

export const DEPARTEMENTS_FRANCE: readonly DepartementReference[] = [
  { code: "01", lat: 46.0899, lng: 5.3201, rayonKm: 69 },
  { code: "02", lat: 49.5554, lng: 3.5302, rayonKm: 76 },
  { code: "03", lat: 46.3518, lng: 3.1835, rayonKm: 68 },
  { code: "04", lat: 44.0751, lng: 6.1451, rayonKm: 77 },
  { code: "05", lat: 44.5794, lng: 6.1319, rayonKm: 70 },
  { code: "06", lat: 43.8478, lng: 7.1058, rayonKm: 53 },
  { code: "07", lat: 44.783, lng: 4.4573, rayonKm: 68 },
  { code: "08", lat: 49.6147, lng: 4.6544, rayonKm: 61 },
  { code: "09", lat: 42.9682, lng: 1.5247, rayonKm: 58 },
  { code: "10", lat: 48.3015, lng: 4.1841, rayonKm: 61 },
  { code: "11", lat: 43.1205, lng: 2.3339, rayonKm: 70 },
  { code: "12", lat: 44.2874, lng: 2.5989, rayonKm: 72 },
  { code: "13", lat: 43.5579, lng: 5.2297, rayonKm: 65 },
  { code: "14", lat: 49.1516, lng: -0.3242, rayonKm: 69 },
  { code: "15", lat: 45.0472, lng: 2.6539, rayonKm: 59 },
  { code: "16", lat: 45.7004, lng: 0.1514, rayonKm: 67 },
  { code: "17", lat: 45.7738, lng: -0.6495, rayonKm: 86 },
  { code: "18", lat: 47.0333, lng: 2.5216, rayonKm: 70 },
  { code: "19", lat: 45.3149, lng: 1.8436, rayonKm: 67 },
  { code: "21", lat: 47.3802, lng: 4.7907, rayonKm: 71 },
  { code: "22", lat: 48.4836, lng: -2.8551, rayonKm: 68 },
  { code: "23", lat: 46.0923, lng: 2.0334, rayonKm: 53 },
  { code: "24", lat: 45.0635, lng: 0.7424, rayonKm: 69 },
  { code: "25", lat: 47.2275, lng: 6.3671, rayonKm: 73 },
  { code: "26", lat: 44.694, lng: 5.1332, rayonKm: 72 },
  { code: "27", lat: 49.1412, lng: 1.0036, rayonKm: 60 },
  { code: "28", lat: 48.4389, lng: 1.39, rayonKm: 54 },
  { code: "29", lat: 48.294, lng: -4.1351, rayonKm: 73 },
  { code: "2A", lat: 41.9023, lng: 8.9493, rayonKm: 58 },
  { code: "2B", lat: 42.4386, lng: 9.28, rayonKm: 63 },
  { code: "30", lat: 44.0235, lng: 4.1973, rayonKm: 72 },
  { code: "31", lat: 43.3346, lng: 1.1378, rayonKm: 84 },
  { code: "32", lat: 43.6627, lng: 0.462, rayonKm: 61 },
  { code: "33", lat: 44.817, lng: -0.3447, rayonKm: 100 },
  { code: "34", lat: 43.5876, lng: 3.4228, rayonKm: 73 },
  { code: "35", lat: 48.1882, lng: -1.6349, rayonKm: 68 },
  { code: "36", lat: 46.7705, lng: 1.6106, rayonKm: 55 },
  { code: "37", lat: 47.2607, lng: 0.6648, rayonKm: 60 },
  { code: "38", lat: 45.3182, lng: 5.4878, rayonKm: 73 },
  { code: "39", lat: 46.7683, lng: 5.6756, rayonKm: 59 },
  { code: "40", lat: 43.81, lng: -0.7348, rayonKm: 80 },
  { code: "41", lat: 47.6483, lng: 1.3068, rayonKm: 73 },
  { code: "42", lat: 45.7221, lng: 4.1965, rayonKm: 64 },
  { code: "43", lat: 45.1401, lng: 3.7618, rayonKm: 55 },
  { code: "44", lat: 47.3381, lng: -1.6804, rayonKm: 66 },
  { code: "45", lat: 47.9622, lng: 2.341, rayonKm: 61 },
  { code: "46", lat: 44.6449, lng: 1.633, rayonKm: 53 },
  { code: "47", lat: 44.3916, lng: 0.4809, rayonKm: 54 },
  { code: "48", lat: 44.5502, lng: 3.4896, rayonKm: 53 },
  { code: "49", lat: 47.3796, lng: -0.4871, rayonKm: 68 },
  { code: "50", lat: 49.1076, lng: -1.3446, rayonKm: 71 },
  { code: "51", lat: 48.9614, lng: 4.1937, rayonKm: 62 },
  { code: "52", lat: 48.1111, lng: 5.2569, rayonKm: 70 },
  { code: "53", lat: 48.1454, lng: -0.6711, rayonKm: 56 },
  { code: "54", lat: 48.7823, lng: 6.1682, rayonKm: 95 },
  { code: "55", lat: 49.0167, lng: 5.3826, rayonKm: 66 },
  { code: "56", lat: 47.8101, lng: -2.7807, rayonKm: 77 },
  { code: "57", lat: 49.0468, lng: 6.6223, rayonKm: 72 },
  { code: "58", lat: 47.1441, lng: 3.4907, rayonKm: 63 },
  { code: "59", lat: 50.4173, lng: 3.2592, rayonKm: 105 },
  { code: "60", lat: 49.4298, lng: 2.4218, rayonKm: 60 },
  { code: "61", lat: 48.6399, lng: 0.1028, rayonKm: 70 },
  { code: "62", lat: 50.4594, lng: 2.3379, rayonKm: 68 },
  { code: "63", lat: 45.7314, lng: 3.1734, rayonKm: 68 },
  { code: "64", lat: 43.324, lng: -0.6631, rayonKm: 90 },
  { code: "65", lat: 43.1361, lng: 0.2095, rayonKm: 55 },
  { code: "66", lat: 42.6075, lng: 2.557, rayonKm: 64 },
  { code: "67", lat: 48.6762, lng: 7.5462, rayonKm: 59 },
  { code: "68", lat: 47.8007, lng: 7.2742, rayonKm: 55 },
  { code: "69", lat: 45.8539, lng: 4.6639, rayonKm: 52 },
  { code: "70", lat: 47.6273, lng: 6.1003, rayonKm: 56 },
  { code: "71", lat: 46.6179, lng: 4.6221, rayonKm: 71 },
  { code: "72", lat: 48.0412, lng: 0.2257, rayonKm: 55 },
  { code: "73", lat: 45.5427, lng: 6.1842, rayonKm: 74 },
  { code: "74", lat: 46.0704, lng: 6.2975, rayonKm: 52 },
  { code: "75", lat: 48.8589, lng: 2.347, rayonKm: 6 },
  { code: "76", lat: 49.666, lng: 0.9833, rayonKm: 68 },
  { code: "77", lat: 48.6624, lng: 2.916, rayonKm: 66 },
  { code: "78", lat: 48.8527, lng: 1.8396, rayonKm: 44 },
  { code: "79", lat: 46.5013, lng: -0.3049, rayonKm: 64 },
  { code: "80", lat: 49.9407, lng: 2.3105, rayonKm: 69 },
  { code: "81", lat: 43.8035, lng: 2.1128, rayonKm: 61 },
  { code: "82", lat: 44.0628, lng: 1.2157, rayonKm: 61 },
  { code: "83", lat: 43.4315, lng: 6.2179, rayonKm: 54 },
  { code: "84", lat: 44.0117, lng: 5.1626, rayonKm: 53 },
  { code: "85", lat: 46.6513, lng: -1.2544, rayonKm: 89 },
  { code: "86", lat: 46.6085, lng: 0.4146, rayonKm: 68 },
  { code: "87", lat: 45.8863, lng: 1.2378, rayonKm: 54 },
  { code: "88", lat: 48.2336, lng: 6.322, rayonKm: 67 },
  { code: "89", lat: 47.8519, lng: 3.6098, rayonKm: 68 },
  { code: "90", lat: 47.6252, lng: 6.9332, rayonKm: 21 },
  { code: "91", lat: 48.5507, lng: 2.2625, rayonKm: 33 },
  { code: "92", lat: 48.8447, lng: 2.2531, rayonKm: 12 },
  { code: "93", lat: 48.9104, lng: 2.4666, rayonKm: 12 },
  { code: "94", lat: 48.7829, lng: 2.4569, rayonKm: 13 },
  { code: "95", lat: 49.0764, lng: 2.1496, rayonKm: 38 },
  { code: "971", lat: 16.1547, lng: -61.5487, rayonKm: 53 },
  { code: "972", lat: 14.6622, lng: -61.0382, rayonKm: 33 },
  { code: "973", lat: 4.5221, lng: -53.0446, rayonKm: 189 },
  { code: "974", lat: -21.1273, lng: 55.5083, rayonKm: 32 },
  { code: "976", lat: -12.8176, lng: 45.1476, rayonKm: 19 },
];
