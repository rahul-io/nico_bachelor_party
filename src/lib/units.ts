const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

export const feetInchesToCm = (feet: number, inches: number) => (feet * 12 + inches) * CM_PER_INCH;

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => Math.round(kg / KG_PER_LB);
