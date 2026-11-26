import { defaultRandom, encodeJoinUrl, generatePartyChannelSet } from '@huntclub/mesh';
import type { Area, Billing, Club, ClubApi, Invite, Member, Stand } from './types';

/** Sample club for the skeleton pages until the club API exists (after #17). */
export interface MockData {
  club: Club | null;
  members: Member[];
  stands: Stand[];
  areas: Area[];
  billing: Billing | null;
}

export function sampleData(): MockData {
  return {
    club: { id: 'club-oak-ridge', name: 'Oak Ridge Hunt Club', acreage: 640 },
    members: [
      { id: 'm1', displayName: 'Dale Morgan', initials: 'DM', role: 'admin', expiresAt: null },
      { id: 'm2', displayName: 'Ruth Keller', initials: 'RK', role: 'member', expiresAt: null },
      {
        id: 'm3',
        displayName: 'Sam Ortiz',
        initials: 'SO',
        role: 'guest',
        expiresAt: '2026-12-31',
      },
    ],
    areas: [
      { id: 'a1', name: 'North 40', standCount: 2 },
      { id: 'a2', name: 'Creek Bottom', standCount: 1 },
    ],
    stands: [
      { id: 's1', name: 'Creek Stand', type: 'tree_stand', areaName: 'Creek Bottom', active: true },
      { id: 's2', name: 'Big Oak Ladder', type: 'ladder', areaName: 'North 40', active: true },
      { id: 's3', name: 'Field Blind', type: 'ground_blind', areaName: 'North 40', active: false },
    ],
    billing: { planName: 'Club', status: 'active', paidThrough: '2027-08-01' },
  };
}

const INVITE_DAYS = 14;

/** An in-memory ClubApi over sample (or test-supplied) data. */
export function mockClubApi(data: MockData = sampleData()): ClubApi {
  return {
    async getClub() {
      return data.club;
    },
    async createClub(name) {
      data.club = { id: `club-${Date.now()}`, name, acreage: null };
      data.billing = null;
      return data.club;
    },
    async listMembers() {
      return data.members;
    },
    async createInvite(): Promise<Invite> {
      if (!data.club) throw new Error('No club');
      // Club channel keys come from the club API later; the mock makes a fresh one.
      const channelSet = generatePartyChannelSet({ random: defaultRandom, name: 'Club' });
      const token = Array.from(defaultRandom(16), (b) => b.toString(16).padStart(2, '0')).join('');
      return {
        joinUrl: encodeJoinUrl(
          { channelSet, target: { kind: 'club', clubId: data.club.id, inviteToken: token } },
          { form: 'web' },
        ),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
      };
    },
    async listStands() {
      return data.stands;
    },
    async listAreas() {
      return data.areas;
    },
    async getBilling() {
      return data.billing;
    },
  };
}
