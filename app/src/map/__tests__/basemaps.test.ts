// The map style: USGS tiles, with the club's downloaded map pack drawn on top.
import { opacity } from '../../theme';
import { CLUB_PACK_SOURCE, BASEMAPS, baseOf, basemapStyle } from '../basemaps';

const pack = {
  localUri: 'file:///docs/club-map-packs/p1.pmtiles',
  bounds: [-94.1, 45.9, -93.9, 46.1] as [number, number, number, number],
  minZoom: 10,
  maxZoom: 16,
};

it('without a club pack: background and the USGS layer only', () => {
  const style = basemapStyle('topo');
  expect(Object.keys(style.sources)).toEqual([BASEMAPS.topo.source]);
  expect(style.layers.map((l) => l.id)).toEqual(['background', BASEMAPS.topo.source]);
});

it('with a club pack: reads the PMTiles file from the phone, above the USGS layer', () => {
  const style = basemapStyle('topo', pack);
  expect(style.sources[CLUB_PACK_SOURCE]).toEqual({
    type: 'raster',
    url: 'pmtiles://file:///docs/club-map-packs/p1.pmtiles',
    tileSize: 256,
    minzoom: 10,
    maxzoom: 16,
    bounds: [-94.1, 45.9, -93.9, 46.1],
    attribution: BASEMAPS.topo.credit,
  });
  expect(style.layers.map((l) => l.id)).toEqual([
    'background',
    BASEMAPS.topo.source,
    CLUB_PACK_SOURCE,
  ]);
  // The USGS source stays: it fills anything the pack does not cover.
  expect(style.sources[BASEMAPS.topo.source]).toEqual(
    basemapStyle('topo').sources[BASEMAPS.topo.source],
  );
});

it('Hybrid: the topo map over the aerial, the club pack between them', () => {
  const style = basemapStyle('hybrid', pack);
  expect(style.layers.map((l) => l.id)).toEqual([
    'background',
    BASEMAPS.aerial.source,
    CLUB_PACK_SOURCE,
    BASEMAPS.topo.source,
  ]);
  const topo = style.layers.find((l) => l.id === BASEMAPS.topo.source);
  expect(topo).toMatchObject({ paint: { 'raster-opacity': opacity.hybridTopo } });
  expect(baseOf('hybrid')).toBe('aerial');
});
