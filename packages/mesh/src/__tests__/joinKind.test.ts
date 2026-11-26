import { join } from 'node:path';
import { buildSync } from 'esbuild';
import {
  channelSetWithKey,
  decodeJoinUrl,
  encodeJoinUrl,
  type JoinTarget,
} from '../codec/channelUrl';
import { appJoinUrl, classifyJoinFragment } from '../codec/joinKind';
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

describe('@huntclub/mesh/join-kind entry', () => {
  it('bundles without protobuf, @huntclub/shared or the codec', () => {
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
      ['src/codec/channelUrlError.ts', 'src/codec/joinKind.ts', 'src/codec/query.ts'].map((f) =>
        expect.stringContaining(f),
      ),
    );
    const code = result.outputFiles[0]!.text;
    expect(code).not.toMatch(/protobuf|@huntclub\/shared|@bufbuild/);
  });
});
