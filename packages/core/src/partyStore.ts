/**
 * Party persistence port. The app implements PartyStore (SQLite for the
 * roster, secure storage for the join link, which holds the channel key);
 * core never touches storage directly.
 */

export interface PartyMember {
  /** Meshtastic node number. */
  node: number;
  /** First and last time we heard this radio on the party channel (ms). */
  firstHeard: number;
  lastHeard: number;
}

export interface StoredParty {
  id: string;
  /**
   * The party's join link (app form). It contains the channel key: keep it
   * in secure storage and never log it.
   */
  joinLink: string;
  role: 'creator' | 'member';
  /** When we created or joined (ms). */
  joinedAt: number;
  /** Party channel index on our radio (0: a free party is the primary channel). */
  channelIndex: number;
  /** Other members heard on the party channel (not us). */
  members: PartyMember[];
}

export interface PartyStore {
  load(): Promise<StoredParty | null>;
  save(party: StoredParty): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory PartyStore for tests and previews. */
export class MemoryPartyStore implements PartyStore {
  saves = 0;
  constructor(private party: StoredParty | null = null) {}

  async load(): Promise<StoredParty | null> {
    return this.party && structuredCopy(this.party);
  }

  async save(party: StoredParty): Promise<void> {
    this.saves++;
    this.party = structuredCopy(party);
  }

  async clear(): Promise<void> {
    this.party = null;
  }
}

const structuredCopy = (p: StoredParty): StoredParty => ({
  ...p,
  members: p.members.map((m) => ({ ...m })),
});
