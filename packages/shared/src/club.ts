// Club cloud entities (docs/SPEC.md, "Cloud data") as zod schemas.
//
// For each entity: the stored shape (`XSchema`, what the API returns) and the
// inputs clients may send (`XCreateSchema`, `XUpdateSchema`). Inputs are strict, so a
// client can never set server-owned fields (ids, mesh ids, club ids, timestamps,
// counters). Field groups are plain objects spread into each schema, so every rule
// is written once.
import { z } from 'zod';
import {
  HarvestSexSchema,
  InviteRoleSchema,
  MemberRoleSchema,
  StandTypeSchema,
  SubscriptionStatusSchema,
} from './enums';
import {
  LAT_LON_PAIR_MESSAGE,
  channelKeySchema,
  hasLatLonPair,
  idSchema,
  DISPLAY_NAME_MAX,
  initialsSchema,
  inviteTokenSchema,
  latitudeSchema,
  longitudeSchema,
  meshIdSchema,
  notesSchema,
  planIdSchema,
  polygonSchema,
  regionSchema,
  SPECIES_MAX,
  stripeEventIdSchema,
  timestampSchema,
  trimmedText,
  uint32Schema,
  userIdSchema,
} from './fields';

const timestamps = { createdAt: timestampSchema, updatedAt: timestampSchema };

// Plans ------------------------------------------------------------------------

export const PlanSchema = z.object({
  id: planIdSchema,
  name: trimmedText(60),
  /** Maximum admins + members (guests don't count). Absent = unlimited. */
  memberLimit: z.number().int().positive().optional(),
  active: z.boolean(),
  ...timestamps,
});
export type Plan = z.infer<typeof PlanSchema>;
export const PlanPutSchema = PlanSchema.omit({ createdAt: true, updatedAt: true }).strict();
export type PlanPut = z.input<typeof PlanPutSchema>;

// Clubs ------------------------------------------------------------------------

const clubEditable = {
  name: trimmedText(80),
  acreage: z.number().min(0).optional(),
  boundary: polygonSchema.optional(),
  region: regionSchema,
  overdueGraceMinutes: z.number().int().min(0).max(720),
};

export const ClubSchema = z.object({
  id: idSchema,
  ...clubEditable,
  createdBy: userIdSchema.optional(),
  ...timestamps,
});
export type Club = z.infer<typeof ClubSchema>;

/** Provisioning Lambda input: a new club. Defaults match a typical US club. */
export const ClubCreateSchema = z.strictObject({
  ...clubEditable,
  region: clubEditable.region.default('US'),
  overdueGraceMinutes: clubEditable.overdueGraceMinutes.default(30),
});
export type ClubCreate = z.input<typeof ClubCreateSchema>;

export const ClubUpdateSchema = z.strictObject(clubEditable).partial();
export type ClubUpdate = z.input<typeof ClubUpdateSchema>;

// Club secret (radio key) --------------------------------------------------------

export const ClubSecretSchema = z.object({
  clubId: idSchema,
  /** 256-bit Meshtastic channel PSK. Never log this value. */
  channelKey: channelKeySchema,
  keyVersion: z.number().int().positive(),
  ...timestamps,
});
export type ClubSecret = z.infer<typeof ClubSecretSchema>;

// Members ------------------------------------------------------------------------

const memberProfile = {
  displayName: trimmedText(DISPLAY_NAME_MAX),
  initials: initialsSchema,
  /** Meshtastic node number of the member's radio. */
  nodeId: uint32Schema.optional(),
};

/** Only guest passes expire. (Admins and members never do, so seat counts stay exact.) */
const memberAccess = {
  role: MemberRoleSchema,
  expiresAt: timestampSchema.optional(),
};
const onlyGuestsExpire = (m: { role?: string; expiresAt?: string | undefined }) =>
  m.expiresAt === undefined || m.role === 'guest';
const ONLY_GUESTS_EXPIRE = { message: 'only guest memberships can expire', path: ['expiresAt'] };

export const MemberSchema = z
  .object({
    clubId: idSchema,
    userId: userIdSchema,
    ...memberProfile,
    ...memberAccess,
    ...timestamps,
  })
  .refine(onlyGuestsExpire, ONLY_GUESTS_EXPIRE);
export type Member = z.infer<typeof MemberSchema>;

/** What a member may change about themselves (admins may change it for anyone). */
export const MemberProfileUpdateSchema = z.strictObject(memberProfile).partial();
export type MemberProfileUpdate = z.input<typeof MemberProfileUpdateSchema>;

/** Admin-only: role and guest-pass expiry. */
export const MemberAccessUpdateSchema = z
  .strictObject(memberAccess)
  .refine(onlyGuestsExpire, ONLY_GUESTS_EXPIRE);
export type MemberAccessUpdate = z.input<typeof MemberAccessUpdateSchema>;

/** Admin adds someone to the roster directly. */
export const MemberAddSchema = z
  .strictObject({
    userId: userIdSchema,
    ...memberProfile,
    role: MemberRoleSchema.default('member'),
    expiresAt: memberAccess.expiresAt,
  })
  .refine(onlyGuestsExpire, ONLY_GUESTS_EXPIRE);
export type MemberAdd = z.input<typeof MemberAddSchema>;

/** The joining user's profile when redeeming an invite. */
export const MemberJoinSchema = z.strictObject({
  displayName: memberProfile.displayName,
  initials: memberProfile.initials,
});
export type MemberJoin = z.input<typeof MemberJoinSchema>;

// Subscriptions and Stripe events --------------------------------------------------

const subscriptionFields = {
  clubId: idSchema,
  stripeCustomerId: z.string().min(1).max(255),
  stripeSubscriptionId: z.string().min(1).max(255),
  planId: planIdSchema,
  status: SubscriptionStatusSchema,
  paidThrough: timestampSchema.optional(),
};

export const SubscriptionSchema = z.object({ ...subscriptionFields, ...timestamps });
export type Subscription = z.infer<typeof SubscriptionSchema>;

/** One verified Stripe webhook event, reduced to the subscription it syncs. */
export const StripeEventApplySchema = z.strictObject({
  eventId: stripeEventIdSchema,
  ...subscriptionFields,
});
export type StripeEventApply = z.input<typeof StripeEventApplySchema>;

export const StripeEventSchema = z.object({
  eventId: stripeEventIdSchema,
  processedAt: timestampSchema,
});
export type StripeEvent = z.infer<typeof StripeEventSchema>;

// Invites ---------------------------------------------------------------------------

const inviteGrant = {
  role: InviteRoleSchema,
  /** Guest passes only: when the resulting membership expires. */
  memberExpiresAt: timestampSchema.optional(),
  expiresAt: timestampSchema,
  maxUses: z.number().int().positive().optional(),
};
const onlyGuestPassesExpire = (i: { role?: string; memberExpiresAt?: string | undefined }) =>
  i.memberExpiresAt === undefined || i.role === 'guest';
const ONLY_GUEST_PASSES_EXPIRE = {
  message: 'only guest invites set a membership expiry',
  path: ['memberExpiresAt'],
};

export const InviteSchema = z
  .object({
    id: idSchema,
    clubId: idSchema,
    token: inviteTokenSchema,
    ...inviteGrant,
    uses: z.number().int().min(0),
    createdBy: userIdSchema.optional(),
    ...timestamps,
  })
  .refine(onlyGuestPassesExpire, ONLY_GUEST_PASSES_EXPIRE)
  .refine((i) => i.maxUses === undefined || i.uses <= i.maxUses, {
    message: 'uses cannot exceed maxUses',
    path: ['uses'],
  });
export type Invite = z.infer<typeof InviteSchema>;

export const InviteCreateSchema = z
  .strictObject({ ...inviteGrant, role: inviteGrant.role.default('member') })
  .refine(onlyGuestPassesExpire, ONLY_GUEST_PASSES_EXPIRE);
export type InviteCreate = z.input<typeof InviteCreateSchema>;

// Areas and stands -------------------------------------------------------------------

const placeFields = {
  name: trimmedText(60),
  notes: notesSchema.optional(),
  active: z.boolean(),
};
/** Server-owned fields of stands and areas. meshId and clubId never change. */
const placeIdentity = { id: idSchema, clubId: idSchema, meshId: meshIdSchema };

const areaEditable = { ...placeFields, boundary: polygonSchema };

export const AreaSchema = z.object({ ...placeIdentity, ...areaEditable, ...timestamps });
export type Area = z.infer<typeof AreaSchema>;
export const AreaCreateSchema = z.strictObject({
  ...areaEditable,
  active: placeFields.active.default(true),
});
export type AreaCreate = z.input<typeof AreaCreateSchema>;
export const AreaUpdateSchema = z.strictObject(areaEditable).partial();
export type AreaUpdate = z.input<typeof AreaUpdateSchema>;

const standEditable = {
  ...placeFields,
  areaId: idSchema.optional(),
  type: StandTypeSchema,
  lat: latitudeSchema,
  lon: longitudeSchema,
};

export const StandSchema = z.object({ ...placeIdentity, ...standEditable, ...timestamps });
export type Stand = z.infer<typeof StandSchema>;
export const StandCreateSchema = z.strictObject({
  ...standEditable,
  active: placeFields.active.default(true),
});
export type StandCreate = z.input<typeof StandCreateSchema>;
export const StandUpdateSchema = z.strictObject(standEditable).partial();
export type StandUpdate = z.input<typeof StandUpdateSchema>;

// Harvests (only the ones a member shared with the club are stored) --------------------

const harvestEditable = {
  species: trimmedText(SPECIES_MAX),
  sex: HarvestSexSchema,
  lat: latitudeSchema.optional(),
  lon: longitudeSchema.optional(),
  standId: idSchema.optional(),
  areaId: idSchema.optional(),
  notes: notesSchema.optional(),
  /** Lets the hunter withdraw a share without deleting the record. */
  shared: z.boolean(),
  harvestedAt: timestampSchema,
};

export const HarvestSchema = z
  .object({
    id: idSchema,
    clubId: idSchema,
    userId: userIdSchema,
    ...harvestEditable,
    ...timestamps,
  })
  .refine(hasLatLonPair, LAT_LON_PAIR_MESSAGE);
export type Harvest = z.infer<typeof HarvestSchema>;
export const HarvestCreateSchema = z
  .strictObject({
    ...harvestEditable,
    sex: harvestEditable.sex.default('unknown'),
    shared: harvestEditable.shared.default(true),
  })
  .refine(hasLatLonPair, LAT_LON_PAIR_MESSAGE);
export type HarvestCreate = z.input<typeof HarvestCreateSchema>;
export const HarvestUpdateSchema = z
  .strictObject(harvestEditable)
  .partial()
  .refine(hasLatLonPair, LAT_LON_PAIR_MESSAGE);
export type HarvestUpdate = z.input<typeof HarvestUpdateSchema>;

// Map packs (written by the map-pack Lambda) -------------------------------------------

const zoomSchema = z.number().int().min(0).max(22);

/** [west, south, east, north] in degrees. */
export const boundsSchema = z
  .tuple([longitudeSchema, latitudeSchema, longitudeSchema, latitudeSchema])
  .refine(([, south, , north]) => south < north, { message: 'south must be below north' });

/** What a pack covers; fixed when its build starts. */
const mapPackFields = {
  bounds: boundsSchema,
  minZoom: zoomSchema,
  maxZoom: zoomSchema,
  /** Tile source id (BASEMAPS[...].source). */
  source: z.string().min(1).max(200),
};
/** Filled in when the build finishes. */
const mapPackReadyFields = {
  sizeBytes: z.number().int().min(0),
  builtAt: timestampSchema,
};
/** Longest failure reason stored on a pack (a short sentence, never a stack trace). */
export const MAP_PACK_REASON_MAX = 200;
export const zoomRangeOrdered = (p: { minZoom: number; maxZoom: number }) => p.minZoom <= p.maxZoom;
export const ZOOM_RANGE_ORDERED = { message: 'minZoom must not exceed maxZoom', path: ['minZoom'] };

const mapPackEntity = {
  id: idSchema,
  clubId: idSchema,
  ...mapPackFields,
  /** packs/<clubId>/<id>.pmtiles (mapPackKey); served once the pack is ready. */
  s3Key: z.string().min(1).max(1024),
  ...timestamps,
};

/**
 * A club map pack: `building` while the builder runs (it expires if the builder dies),
 * then `ready` (downloadable) or `failed` (with a short reason).
 */
export const MapPackSchema = z
  .discriminatedUnion('status', [
    z.object({ ...mapPackEntity, status: z.literal('building'), expiresAt: timestampSchema }),
    z.object({ ...mapPackEntity, status: z.literal('ready'), ...mapPackReadyFields }),
    z.object({
      ...mapPackEntity,
      status: z.literal('failed'),
      reason: z.string().min(1).max(MAP_PACK_REASON_MAX),
    }),
  ])
  .refine(zoomRangeOrdered, ZOOM_RANGE_ORDERED);
export type MapPack = z.infer<typeof MapPackSchema>;
export type MapPackStatus = MapPack['status'];

/** Starting a build (the API, for an admin): what the pack will cover. */
export const MapPackStartSchema = z
  .strictObject(mapPackFields)
  .refine(zoomRangeOrdered, ZOOM_RANGE_ORDERED);
export type MapPackStart = z.input<typeof MapPackStartSchema>;

/** Finishing a build (the builder Lambda). */
export const MapPackReadySchema = z.strictObject(mapPackReadyFields);
export type MapPackReady = z.input<typeof MapPackReadySchema>;
