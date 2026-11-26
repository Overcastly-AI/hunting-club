import { classifyDisconnect, classifyError } from '../bleErrors';

describe('classifyDisconnect', () => {
  it.each([
    [{ status: 133 }, 'gatt133'],
    [{ status: 5 }, 'auth'],
    [{ status: 15 }, 'auth'],
    [{ status: 137 }, 'auth'],
    [{ status: 8 }, 'other'],
    [{ domain: 'CBATTErrorDomain', code: 5 }, 'auth'],
    [{ domain: 'CBATTErrorDomain', code: 15 }, 'auth'],
    [{ domain: 'CBErrorDomain', code: 14 }, 'auth'],
    [{ domain: 'CBErrorDomain', code: 6 }, 'other'],
    [{}, 'other'],
  ])('%j → %s', (info, expected) => {
    expect(classifyDisconnect(info)).toBe(expected);
  });
});

describe('classifyError', () => {
  it.each([
    ['Error reading 2c55 status=5', 'auth'],
    ['Error writing f75c status=133', 'gatt133'],
    ['Connection error 133', 'gatt133'],
    ['Authentication is insufficient.', 'auth'],
    ['Encryption is insufficient.', 'auth'],
    [new Error('Device disconnected'), 'other'],
  ])('%s → %s', (error, expected) => {
    expect(classifyError(error)).toBe(expected);
  });
});
