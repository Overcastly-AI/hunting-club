// Convenience accessors over the generated schema types (same names the Supabase CLI
// suggests), plus the enum value lists. Everything here derives from
// database.types.ts, which is generated from supabase/migrations: change the SQL, not this.
import { Constants, type Database } from './database.types';

export type { Database, Json } from './database.types';

type PublicSchema = Database['public'];

export type TableName = keyof PublicSchema['Tables'];
export type Tables<T extends TableName> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type MemberRole = Enums<'member_role'>;
export type StandType = Enums<'stand_type'>;
export type HarvestSex = Enums<'harvest_sex'>;
export type SubscriptionStatus = Enums<'subscription_status'>;

export const MEMBER_ROLES = Constants.public.Enums.member_role;
export const STAND_TYPES = Constants.public.Enums.stand_type;
export const HARVEST_SEXES = Constants.public.Enums.harvest_sex;
export const SUBSCRIPTION_STATUSES = Constants.public.Enums.subscription_status;

/** Error codes raised by the `redeem_invite` RPC (the exception message). */
export const REDEEM_INVITE_ERRORS = Constants.public.Enums.redeem_invite_error;
export type RedeemInviteError = Enums<'redeem_invite_error'>;
