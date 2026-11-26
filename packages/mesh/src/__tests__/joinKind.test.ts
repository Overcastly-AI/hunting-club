import { join } from 'node:path';
import { buildSync } from 'esbuild';
import {
  channelSetWithKey,
  decodeJoinUrl,
  encodeJoinUrl,
  type JoinTarget,
} from '../codec/channelUrl';
import { CLUB_NAME_MAX } from '@huntclub/shared/limits';
import { ChannelUrlError } from '../codec/channelUrlError';
import { appJoinUrl, classifyJoinFragment, cleanClubName, joinClubName } from '../codec/joinKind';
import pkg from '../../package.json';

const channelSet = channelSetWithKey(new Uint8Array(32).fill(7));
const TARGETS: JoinTarget[] = [
  { kind: 'party', partyId: 'p-3f9a' },
  { kind: 'club', clubId: 'club-1', inviteToken: 'inv 1/2' },
];

function webFragment(target: JoinTarget): string {
  const url = encodeJoinUrl({ channelSet, target }, { form: 'web' });
  return url.slice(url.indexOf('#'));
}

describe('classifyJoinFragment', () => {
  it.each(TARGETS)('classifies a $kind link the same as decodeJoinUrl', (target) => {
    const hash = webFragment(target);
    expect(classifyJoinFragment(hash)).toEqual({ kind: target.kind });
    expect(classifyJoinFragment(hash.slice(1))).toEqual({ kind: target.kind });
    expect(decodeJoinUrl(`huntclub://join?${hash.slice(1)}`).target.kind).toBe(target.kind);
  });

  it.each([
    ['empty', ''],
    ['bare #', '#'],
    ['no channel data', '#party=p1'],
    ['empty channel data', '#cs=&party=p1'],
    ['no party or club', '#cs=AAAA'],
    ['club without invite', '#cs=AAAA&club=c1'],
    ['badly encoded', '#cs=AAAA&party=%E0%A4%A'],
  ])('returns null for %s', (_name, hash) => {
    expect(classifyJoinFragment(hash)).toBeNull();
  });

  it('checks only presence: the channel data is not decoded', () => {
    expect(classifyJoinFragment('#cs=not-protobuf&party=p1')).toEqual({ kind: 'party' });
  });
});

describe('appJoinUrl', () => {
  it.each(TARGETS)('opens a $kind web link in the app with the same invite', (target) => {
    const app = appJoinUrl(webFragment(target));
    expect(app).toBe(encodeJoinUrl({ channelSet, target }));
    expect(decodeJoinUrl(app!)).toEqual({ channelSet, target });
  });

  it('gives no app link for an incomplete fragment', () => {
    expect(appJoinUrl('#cs=AAAA')).toBeNull();
    expect(appJoinUrl('')).toBeNull();
  });
});

describe('the club name in a club invite', () => {
  const club = { kind: 'club', clubId: 'club-1', inviteToken: 'inv-1' } as const;

  it('travels in the fragment and reads back from it, through the one builder', () => {
    const target = { ...club, clubName: 'Oak Ridge & Pine Hollow' };
    const hash = webFragment(target);
    expect(joinClubName(hash)).toBe('Oak Ridge & Pine Hollow');
    expect(decodeJoinUrl(`huntclub://join?${hash.slice(1)}`).target).toEqual(target);
    expect(appJoinUrl(hash)).toBe(encodeJoinUrl({ channelSet, target }));
  });

  it('is absent from old links, which still read as club invites', () => {
    const hash = webFragment(club);
    expect(hash).not.toContain('name=');
    expect(joinClubName(hash)).toBeNull();
    expect(classifyJoinFragment(hash)).toEqual({ kind: 'club' });
    expect(decodeJoinUrl(`huntclub://join?${hash.slice(1)}`).target).toEqual(club);
  });

  it('is never read from a party link', () => {
    const party = webFragment({ kind: 'party', partyId: 'p1' });
    expect(joinClubName(`${party}&name=Oak`)).toBeNull();
  });

  it('turns a hostile name into plain text, or drops it', () => {
    expect(cleanClubName('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
    expect(cleanClubName('Oak\u202E\u200B Ridge\n\tClub')).toBe('Oak Ridge Club');
    expect(cleanClubName('  \u0000\u200F  ')).toBeNull();
    expect(cleanClubName('x'.repeat(CLUB_NAME_MAX))).toHaveLength(CLUB_NAME_MAX);
    expect(cleanClubName('x'.repeat(CLUB_NAME_MAX + 1))).toBeNull();
    const hash = webFragment(club);
    expect(joinClubName(`${hash}&name=${'x'.repeat(CLUB_NAME_MAX + 1)}`)).toBeNull();
    expect(joinClubName(`${hash}&name=%E0%A4%A`)).toBeNull();
  });

  it('refuses to build a link with an empty or overlong name', () => {
    for (const clubName of ['  ', 'x'.repeat(CLUB_NAME_MAX + 1)]) {
      expect(() => encodeJoinUrl({ channelSet, target: { ...club, clubName } })).toThrow(
        ChannelUrlError,
      );
    }
  });
});

describe('@huntclub/mesh/join-kind entry', () => {
  it('bundles without protobuf or the codec, and only the dependency-free limits from @huntclub/shared', () => {
    const entry = pkg.exports['./join-kind'];
    const result = buildSync({
      entryPoints: [join(__dirname, '../..', entry)],
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'neutral',
      logLevel: 'silent',
    });
    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.sort()).toEqual(
      [
        'shared/src/limits.ts',
        'src/codec/channelUrlError.ts',
        'src/codec/joinKind.ts',
        'src/codec/query.ts',
      ].map((f) => expect.stringContaining(f)),
    );
    const code = result.outputFiles[0]!.text;
    expect(code).not.toMatch(/protobuf|@huntclub\/shared|@bufbuild/);
  });
});
