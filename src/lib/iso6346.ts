/**
 * ISO 6346 container number normalization and check-digit validator.
 */
export function normalizeContainerNumber(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function validateIso6346(containerNumber: string): {
  isValid: boolean;
  expectedCheckDigit?: number;
  actualCheckDigit?: number;
  message: string;
} {
  const norm = normalizeContainerNumber(containerNumber);
  if (!norm) {
    return { isValid: false, message: 'Container number is required' };
  }

  const regex = /^[A-Z]{4}\d{7}$/;
  if (!regex.test(norm)) {
    return {
      isValid: false,
      message: 'Format must be 4 letters followed by 6 digits and 1 check digit (e.g. MSCU1234566)',
    };
  }

  const letterValues: Record<string, number> = {
    A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19, J: 20,
    K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29, S: 30, T: 31,
    U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
  };

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const char = norm[i];
    const val = char >= '0' && char <= '9' ? Number(char) : letterValues[char];
    sum += val * Math.pow(2, i);
  }

  const remainder = sum % 11;
  const expectedCheckDigit = remainder === 10 ? 0 : remainder;
  const actualCheckDigit = Number(norm[10]);

  if (expectedCheckDigit !== actualCheckDigit) {
    return {
      isValid: false,
      expectedCheckDigit,
      actualCheckDigit,
      message: `Check digit mismatch: expected ${expectedCheckDigit}, got ${actualCheckDigit}`,
    };
  }

  return {
    isValid: true,
    expectedCheckDigit,
    actualCheckDigit,
    message: 'Valid ISO 6346 container number',
  };
}
