import {
  AreaSchema,
  ClubSchema,
  InviteSchema,
  MemberSchema,
  StandSchema,
  SubscriptionSchema,
} from '@huntclub/shared';
import { mockClubApi, sampleData } from '../api/mock';

// The mock stands in for the real club API, so its data must be valid shared wire types.
describe('mock club API', () => {
  it('serves sample data that matches the shared schemas', () => {
    const data = sampleData();
    expect(() => ClubSchema.parse(data.club)).not.toThrow();
    for (const m of data.members) expect(() => MemberSchema.parse(m)).not.toThrow();
    for (const s of data.stands) expect(() => StandSchema.parse(s)).not.toThrow();
    for (const a of data.areas) expect(() => AreaSchema.parse(a)).not.toThrow();
    expect(() => SubscriptionSchema.parse(data.subscription)).not.toThrow();
  });

  it('creates invites that match the shared Invite schema', async () => {
    const invite = await mockClubApi().createInvite({
      role: 'member',
      expiresAt: '2027-01-01T00:00:00.000Z',
    });
    expect(() => InviteSchema.parse(invite)).not.toThrow();
  });

  it('validates new clubs with the shared create schema (defaults applied)', async () => {
    const club = await mockClubApi({ ...sampleData(), club: null }).createClub({
      club: { name: 'Pine Hollow' },
      admin: { displayName: 'Pat Lane', initials: 'PL' },
    });
    expect(ClubSchema.parse(club)).toMatchObject({ name: 'Pine Hollow', region: 'US' });
  });
});
