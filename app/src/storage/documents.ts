import { Directory, File, Paths } from 'expo-file-system';

/**
 * Small files the app keeps in its documents folder (map styles, the cached
 * forecast). The one place the app writes and reads them, on iOS and Android.
 */
function documentFile(folder: string, name: string): File {
  return new File(new Directory(Paths.document, folder), name);
}

/** Writes `contents` to documents/<folder>/<name>, creating the folder; returns the file:// URI. */
export async function writeDocument(
  folder: string,
  name: string,
  contents: string,
): Promise<string> {
  new Directory(Paths.document, folder).create({ idempotent: true, intermediates: true });
  const file = documentFile(folder, name);
  await file.write(contents);
  return file.uri;
}

/** The file's text, or null if it doesn't exist or can't be read. */
export async function readDocument(folder: string, name: string): Promise<string | null> {
  try {
    const file = documentFile(folder, name);
    return file.exists ? await file.text() : null;
  } catch {
    return null;
  }
}
