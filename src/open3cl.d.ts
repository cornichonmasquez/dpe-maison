// Déclarations minimales du moteur Open3CL (JavaScript sans types).
declare module '@open3cl/engine' {
  export function calcul_3cl(dpe: unknown, options?: { sanitize?: boolean }): any;
  export function calcul_3cl_xml(xml: string): any;
}
declare module '@open3cl/engine/7_inertie.js' {
  export class Inertie {
    calculateInertie(enveloppe: unknown): { enum_classe_inertie_id: string | number } & Record<string, unknown>;
  }
}
