/** A channel or join link that cannot be used. Dependency-free (see joinKind.ts). */
export class ChannelUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChannelUrlError';
  }
}
