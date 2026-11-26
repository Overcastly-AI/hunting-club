import type { SqlDatabase } from './types';

/** The radio this phone reconnects to on launch. */
export type PairedRadio = {
  /** Android MAC address or iOS peripheral UUID. */
  peripheralId: string;
  name: string;
  pairedAt: number;
};

type Row = { peripheral_id: string; name: string; paired_at: number };

export async function loadPairedRadio(db: SqlDatabase): Promise<PairedRadio | null> {
  const row = await db.getFirstAsync<Row>(
    'SELECT peripheral_id, name, paired_at FROM paired_radio WHERE id = 1',
  );
  return row ? { peripheralId: row.peripheral_id, name: row.name, pairedAt: row.paired_at } : null;
}

export async function savePairedRadio(db: SqlDatabase, radio: PairedRadio): Promise<void> {
  await db.runAsync(
    `INSERT INTO paired_radio (id, peripheral_id, name, paired_at) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       peripheral_id = excluded.peripheral_id, name = excluded.name, paired_at = excluded.paired_at`,
    radio.peripheralId,
    radio.name,
    radio.pairedAt,
  );
}

export async function clearPairedRadio(db: SqlDatabase): Promise<void> {
  await db.runAsync('DELETE FROM paired_radio');
}
