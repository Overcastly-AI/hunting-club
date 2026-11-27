import {
  DISPLAY_NAME_MAX,
  DISPLAY_NAME_PROBLEMS,
  displayNameProblem,
  displayNameSchema,
  emailStandInName,
  fitUtf8,
  initialsFor,
  INITIALS_MAX,
  initialsSchema,
  isEmailStandInName,
  normalizeDisplayName,
  RADIO_NAME_BYTES,
  storedDisplayNameSchema,
  storedInitialsSchema,
  suggestInitials,
  utf8Length,
} from '../names';
import {
  MemberJoinSchema,
  MemberProfileUpdateSchema,
  MemberSchema,
  parseMemberProfile,
} from '../club';

describe('utf8Length and fitUtf8', () => {
  it('counts bytes the way the radio does', () => {
    expect(utf8Length('Dale')).toBe(4);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('’')).toBe(3);
    expect(utf8Length('🦌')).toBe(4);
  });

  it('cuts on whole characters', () => {
    expect(fitUtf8('x'.repeat(40), RADIO_NAME_BYTES.long)).toHaveLength(39);
    expect(fitUtf8('é'.repeat(40), RADIO_NAME_BYTES.long)).toBe('é'.repeat(19));
    expect(fitUtf8('🦌a', 3)).toBe('');
  });
});

describe('display name rules', () => {
  it('trims and folds runs of spaces', () => {
    expect(normalizeDisplayName('  Jake \t  Smith\n')).toBe('Jake Smith');
    expect(displayNameSchema.parse('  Jake   Smith ')).toBe('Jake Smith');
  });

  it.each([
    'Jake Smith',
    'Élodie Ørsted',
    "Bud O'Neil",
    'Bud O’Neil',
    'Mary-Ann Lee Jr.',
    'Hunter 2',
  ])('accepts %j', (name) => {
    expect(displayNameProblem(name)).toBeNull();
    expect(displayNameSchema.safeParse(name).success).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['---', 'characters'],
    ['Jake <b>', 'characters'],
    ['Jake_Smith', 'characters'],
    ['Jake 🦌', 'characters'],
    ['Jake\u0000Smith', 'characters'],
    ['J'.repeat(DISPLAY_NAME_MAX + 1), 'tooLong'],
    // 20 characters but 40 bytes: within the character limit, over the radio's.
    ['é'.repeat(20), 'tooLong'],
  ] as const)('rejects %j as %s', (name, problem) => {
    expect(displayNameProblem(name)).toBe(problem);
    const result = displayNameSchema.safeParse(name);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(DISPLAY_NAME_PROBLEMS[problem]);
  });

  it('keeps every valid name within the radio long name', () => {
    expect(DISPLAY_NAME_MAX).toBeLessThanOrEqual(RADIO_NAME_BYTES.long);
    expect(displayNameProblem('J'.repeat(DISPLAY_NAME_MAX))).toBeNull();
    expect(displayNameProblem('é'.repeat(19))).toBeNull();
  });

  it('still reads a stored name saved before the rules', () => {
    expect(storedDisplayNameSchema.safeParse('jane+uat_1').success).toBe(true);
    expect(storedDisplayNameSchema.safeParse(' ').success).toBe(false);
  });
});

describe('email stand-in names', () => {
  it('is the local part as typed, or empty when that is no name', () => {
    expect(emailStandInName('jane.doe@example.com')).toBe('jane.doe');
    expect(emailStandInName('jane_doe@example.com')).toBe('');
    expect(emailStandInName('@example.com')).toBe('');
  });

  it('tells a stand-in from a chosen name', () => {
    expect(isEmailStandInName('jane.doe', 'jane.doe@example.com')).toBe(true);
    expect(isEmailStandInName('Jane.Doe', 'jane.doe@example.com')).toBe(true);
    expect(isEmailStandInName('Jane Doe', 'jane.doe@example.com')).toBe(false);
    expect(isEmailStandInName('jane.doe', undefined)).toBe(false);
  });
});

describe('initialsSchema', () => {
  it('takes 1 to 3 letters or numbers that fit the radio short name', () => {
    expect(initialsSchema.safeParse('JS').success).toBe(true);
    expect(initialsSchema.safeParse('ÉØ').success).toBe(true);
    expect(initialsSchema.safeParse('ÉØÜ').success).toBe(false); // 6 bytes
    expect(initialsSchema.safeParse('ABCD').success).toBe(false);
    expect(initialsSchema.safeParse('J.').success).toBe(false);
  });

  it('still reads stored initials of three accented letters, but never writes them', () => {
    expect(storedInitialsSchema.safeParse('ÉØÜ').success).toBe(true);
    expect(storedInitialsSchema.safeParse(' ').success).toBe(false);
    expect(initialsSchema.safeParse('ÉØÜ').success).toBe(false);
  });
});

describe('initialsFor', () => {
  it('reads an email local part as words, and leaves a name as it is', () => {
    expect(initialsFor('jane.doe@example.com')).toBe('JD');
    expect(initialsFor('jonesjaycob.uitest')).toBe('JU');
    expect(initialsFor('Dale Morgan')).toBe('DM');
    expect(initialsFor('')).toBe('');
  });
});

describe('suggestInitials', () => {
  it.each([
    ['Jake Smith', 'JS'],
    ['  jake   smith ', 'JS'],
    ['Mary Ann Lee Jones', 'MAL'],
    ['Jake', 'J'],
    ['Élodie Ørsted', 'ÉØ'],
    ['Élodie Ørsted Ünal', 'ÉØ'], // a third would overflow the radio's 4 bytes
    ['"Bud" O’Neil', 'BO'],
    ['', ''],
  ])('%j → %j', (name, initials) => {
    expect(suggestInitials(name)).toBe(initials);
  });

  it('never suggests more than the shared limit', () => {
    expect(suggestInitials('a b c d e f').length).toBe(INITIALS_MAX);
  });
});

describe('parseMemberProfile', () => {
  it('returns the profile as saved: name folded, initials upper case', () => {
    expect(parseMemberProfile({ displayName: '  Jake   Smith ', initials: ' js ' })).toEqual({
      displayName: 'Jake Smith',
      initials: 'JS',
    });
  });

  it('is null for a blank or refused name, or missing initials', () => {
    expect(parseMemberProfile({ displayName: '   ', initials: 'JS' })).toBeNull();
    expect(parseMemberProfile({ displayName: 'Jake_Smith', initials: 'JS' })).toBeNull();
    expect(
      parseMemberProfile({ displayName: 'J'.repeat(DISPLAY_NAME_MAX + 1), initials: 'J' }),
    ).toBeNull();
    expect(parseMemberProfile({ displayName: 'Jake', initials: '' })).toBeNull();
  });
});

describe('stored members', () => {
  const stored = {
    clubId: '00000000-0000-4000-8000-000000000001',
    userId: '64d824c8-a0d1-70a9-fdfc-1f8138e91b49',
    role: 'member',
    createdAt: '2026-11-26T00:00:00.000Z',
    updatedAt: '2026-11-26T00:00:00.000Z',
  };

  it('load with names and initials saved before the rules', () => {
    expect(
      MemberSchema.safeParse({ ...stored, displayName: 'jane+uat_1', initials: 'ÉØÜ' }).success,
    ).toBe(true);
  });

  it('cannot be written with them', () => {
    expect(MemberProfileUpdateSchema.safeParse({ initials: 'ÉØÜ' }).success).toBe(false);
    expect(MemberJoinSchema.safeParse({ displayName: 'Élodie', initials: 'ÉØÜ' }).success).toBe(
      false,
    );
  });
});
