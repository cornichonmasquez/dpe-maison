import { CATALOGUE, appliquerChantiers } from '../src/travaux/catalogue.ts';
import { calculer } from '../src/engine/calculate.ts';
import { maisonTemoin } from '../test/fixtures/maison-temoin-saisie.ts';
import { petiteMaison } from '../test/fixtures/petite-maison.ts';

for (const [nom, m] of [['maison témoin (gaz, 2 niveaux)', maisonTemoin], ['petite maison 1975 (gaz standard)', petiteMaison()]] as const) {
  const base = calculer(m, { dateCalcul: '2026-10-11' });
  console.log(`\n== ${nom} : ${base.energiePrimaireM2} kWh, ${base.gesM2} kg, ${base.etiquetteFinale}`);
  for (const c of CATALOGUE) {
    if (!c.applicable(m)) { console.log('  -', c.id.padEnd(18), 'non applicable'); continue; }
    try {
      const r = calculer(appliquerChantiers(m, new Set([c.id])), { dateCalcul: '2026-10-11' });
      const d = r.energiePrimaireM2 - base.energiePrimaireM2;
      console.log('  ✓', c.id.padEnd(18), String(d > 0 ? '+' + d : d).padStart(5), 'kWh/m²', `${r.gesM2} kg`.padStart(8), r.etiquetteFinale);
    } catch (e: any) {
      console.log('  ✖', c.id.padEnd(18), e.message.slice(0, 90));
    }
  }
}
