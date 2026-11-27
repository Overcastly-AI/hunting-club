import { STAND_TYPE_ICON_NAMES, type StandType, type StandTypeIconName } from '@huntclub/shared';
import { ArrowUpFromLine, Tent, TreePine, type LucideIcon } from 'lucide-react';

/** Lucide's components for the shared stand icon names (the app maps the same names). */
export const STAND_ICON_COMPONENTS: Record<StandTypeIconName, LucideIcon> = {
  TreePine,
  ArrowUpFromLine,
  Tent,
};

/** A stand type's icon, the same one the app draws. */
export const standIcon = (type: StandType): LucideIcon =>
  STAND_ICON_COMPONENTS[STAND_TYPE_ICON_NAMES[type]];
