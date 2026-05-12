import type { MatrixColumn } from './types';

const MATRIX_COLUMNS: MatrixColumn[] = ['Arch', 'ST', 'FO', 'SOE', 'FA', 'SP', 'PL', 'Mech'];

// Map ClickUp "Plan Type" dropdown value → portfolio-matrix column.
// Unmapped plan types still render in the Detailed capsule view; they just
// don't get a dot in the matrix.
const KEYWORD_TABLE: Array<[RegExp, MatrixColumn]> = [
  [/^arch/i, 'Arch'],
  [/^struct/i, 'ST'],
  [/^foundation/i, 'FO'],
  [/^soe\b/i, 'SOE'],
  [/support of excavation/i, 'SOE'],
  [/fire alarm/i, 'FA'],
  [/sprinkler/i, 'SP'],
  [/standpipe/i, 'SP'],
  [/plumbing/i, 'PL'],
  [/mechanical/i, 'Mech'],
  [/\bhvac\b/i, 'Mech'],
];

export function planTypeToColumn(planType: string | null | undefined): MatrixColumn | null {
  if (!planType) return null;
  for (const [re, col] of KEYWORD_TABLE) {
    if (re.test(planType)) return col;
  }
  return null;
}

export { MATRIX_COLUMNS };
