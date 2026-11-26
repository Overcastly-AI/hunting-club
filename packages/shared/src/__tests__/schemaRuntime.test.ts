import { z } from 'zod';
import { validateWithoutEval } from '../schemaRuntime';

describe('validateWithoutEval', () => {
  it('turns off the eval-based fast path, and schemas still validate', () => {
    validateWithoutEval();
    expect(z.config().jitless).toBe(true);
    const schema = z.object({ name: z.string() });
    expect(schema.parse({ name: 'Creek Stand' })).toEqual({ name: 'Creek Stand' });
    expect(schema.safeParse({ name: 1 }).success).toBe(false);
  });
});
