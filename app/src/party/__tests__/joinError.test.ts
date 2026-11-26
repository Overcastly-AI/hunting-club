import { PartyError, PartyFullError } from '@huntclub/core';
import { ChannelUrlError } from '@huntclub/mesh';

import { partyCopy } from '../copy';
import { joinErrorText } from '../joinError';

describe('joinErrorText', () => {
  it('words each way joining can fail', () => {
    expect(joinErrorText(new PartyFullError(3))).toBe(partyCopy.scan.full(3));
    expect(joinErrorText(new ChannelUrlError('bad'))).toBe(partyCopy.scan.notACode);
    expect(joinErrorText(new PartyError('radio-rejected', 'no'))).toBe(partyCopy.scan.failed);
    expect(joinErrorText(new Error('other'))).toBe(partyCopy.scan.failed);
  });
});
