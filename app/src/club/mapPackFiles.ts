import { Directory, File, Paths } from 'expo-file-system';

import type { MapPackFiles } from './mapPacks';

/** Folder (in the app's documents) that holds downloaded club map packs. */
const FOLDER = 'club-map-packs';

const folder = () => new Directory(Paths.document, FOLDER);

/**
 * Club map pack archives on the phone (iOS and Android alike). A download goes
 * to a `.part` file and is renamed only once complete, so the map never opens a
 * half-written archive.
 */
export const appMapPackFiles: MapPackFiles = {
  async download(url, packId) {
    folder().create({ idempotent: true, intermediates: true });
    const part = new File(folder(), `${packId}.pmtiles.part`);
    const done = new File(folder(), `${packId}.pmtiles`);
    await File.downloadFileAsync(url, part, { idempotent: true });
    if (done.exists) done.delete();
    await part.move(done);
    return done.uri;
  },
  async remove(localUri) {
    const file = new File(localUri);
    if (file.exists) file.delete();
  },
};
