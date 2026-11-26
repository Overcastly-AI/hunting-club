/**
 * Club API (Lambda Function URL): JSON routes over @huntclub/club-data. Every route
 * but GET /plans needs a Cognito access token; permissions are club-data's authz.
 * Bodies are validated with the @huntclub/shared schemas (by club-data, or here for
 * API-only request shapes). Errors: `{ error: { code, message } }` (ApiErrorBody).
 */
import {
  ANONYMOUS,
  ClubDataError,
  type ClubData,
  SERVICE,
  type Actor,
  userActor,
} from '@huntclub/club-data';
import {
  API_PATHS,
  type ApiPath,
  CheckoutRequestSchema,
  ClubCreateRequestSchema,
  type ClubSecret,
  type ClubSecretResponse,
  ClubSecretPutRequestSchema,
  BASEMAPS,
  MAP_PACK_LIMITS,
  type MapPackBuild,
  MapPackRequestSchema,
  type MapPackRequestResponse,
  estimatePack,
  hasClubFeatures,
  polygonBounds,
  RedeemInviteRequestSchema,
} from '@huntclub/shared';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { TokenVerifier } from './auth';
import { type CheckoutConfig, createCheckout, type StripeApi } from './billing';
import { errorResponse, toErrorResponse } from './errors';
import {
  bearerToken,
  type FunctionUrlEvent,
  type Handler,
  jsonResponse,
  logLine,
  methodOf,
  rawBody,
} from './http';
import { matchRoute, type Route } from './router';

export interface ClubApiDeps {
  data: ClubData;
  verifier: TokenVerifier;
  /** Stripe for Checkout; resolved lazily so other routes never read the API key. */
  stripe: () => Promise<StripeApi>;
  checkout: CheckoutConfig;
  /** Starts the map-pack builder Lambda (async); absent until it is deployed. */
  startMapPackBuild?: (build: MapPackBuild) => Promise<void>;
  now?: () => Date;
  newId?: () => string;
}

interface Ctx {
  actor: Actor;
  /** Parsed JSON body (undefined when empty). */
  body: unknown;
  deps: ClubApiDeps;
}

/** Validates an API-only request body; failures are `invalid`. */
function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw new ClubDataError('invalid', result.error.issues[0]?.message);
  return result.data;
}

/** Entity inputs go straight to club-data, which validates them with the shared schemas. */
const input = <T>(body: unknown) => body as T;

const secretJson = (s: ClubSecret): ClubSecretResponse => ({
  ...s,
  channelKey: Buffer.from(s.channelKey).toString('base64'),
});

/** CRUD routes for one club collection with the same shape (stands, areas, harvests). */
function collectionRoutes<Create, Update>(
  paths: { collection: ApiPath; item: ApiPath },
  ops: {
    list: (actor: Actor, clubId: string) => Promise<unknown>;
    create: (actor: Actor, clubId: string, input: Create) => Promise<unknown>;
    update: (actor: Actor, clubId: string, id: string, patch: Update) => Promise<unknown>;
    remove: (actor: Actor, clubId: string, id: string) => Promise<void>;
  },
): Route<Ctx>[] {
  return [
    { method: 'GET', path: paths.collection, handle: (c, p) => ops.list(c.actor, p.clubId!) },
    {
      method: 'POST',
      path: paths.collection,
      status: 201,
      handle: (c, p) => ops.create(c.actor, p.clubId!, input(c.body)),
    },
    {
      method: 'PATCH',
      path: paths.item,
      handle: (c, p) => ops.update(c.actor, p.clubId!, p.id!, input(c.body)),
    },
    {
      method: 'DELETE',
      path: paths.item,
      status: 204,
      handle: (c, p) => ops.remove(c.actor, p.clubId!, p.id!),
    },
  ];
}

function routes(data: ClubData): Route<Ctx>[] {
  return [
    {
      method: 'GET',
      path: API_PATHS.plans,
      access: 'public',
      handle: () => data.listPlans(ANONYMOUS),
    },

    // Clubs
    { method: 'GET', path: API_PATHS.myClubs, handle: (c) => data.listMyClubs(c.actor) },
    {
      method: 'POST',
      path: API_PATHS.clubs,
      status: 201,
      // Provisioning: the caller becomes the first admin. Features stay locked until
      // the Stripe webhook records an entitled subscription.
      handle: (c) => {
        const req = parse(ClubCreateRequestSchema, c.body);
        const userId = c.actor.kind === 'user' ? c.actor.userId : '';
        return data.createClub(SERVICE, { club: req.club, admin: { ...req.admin, userId } });
      },
    },
    { method: 'GET', path: API_PATHS.club, handle: (c, p) => data.getClub(c.actor, p.clubId!) },
    {
      method: 'PATCH',
      path: API_PATHS.club,
      handle: (c, p) => data.updateClub(c.actor, p.clubId!, input(c.body)),
    },

    // Roster
    {
      method: 'GET',
      path: API_PATHS.members,
      handle: (c, p) => data.listMembers(c.actor, p.clubId!),
    },
    {
      method: 'POST',
      path: API_PATHS.members,
      status: 201,
      handle: (c, p) => data.addMember(c.actor, p.clubId!, input(c.body)),
    },
    {
      method: 'PATCH',
      path: API_PATHS.member,
      handle: (c, p) => data.updateMemberProfile(c.actor, p.clubId!, p.userId!, input(c.body)),
    },
    {
      method: 'PUT',
      path: API_PATHS.memberAccess,
      handle: (c, p) => data.setMemberAccess(c.actor, p.clubId!, p.userId!, input(c.body)),
    },
    {
      method: 'DELETE',
      path: API_PATHS.member,
      status: 204,
      handle: (c, p) => data.removeMember(c.actor, p.clubId!, p.userId!),
    },

    // Invites
    {
      method: 'GET',
      path: API_PATHS.invites,
      handle: (c, p) => data.listInvites(c.actor, p.clubId!),
    },
    {
      method: 'POST',
      path: API_PATHS.invites,
      status: 201,
      handle: (c, p) => data.createInvite(c.actor, p.clubId!, input(c.body)),
    },
    {
      method: 'DELETE',
      path: API_PATHS.invite,
      status: 204,
      handle: (c, p) => data.deleteInvite(c.actor, p.clubId!, p.inviteId!),
    },
    {
      method: 'POST',
      path: API_PATHS.redeemInvite,
      handle: (c) => {
        const { token, ...profile } = parse(RedeemInviteRequestSchema, c.body);
        return data.redeemInvite(c.actor, token, profile);
      },
    },

    // Places and harvests (mesh ids are assigned by club-data)
    ...collectionRoutes(
      { collection: API_PATHS.stands, item: API_PATHS.stand },
      {
        list: data.listStands,
        create: data.createStand,
        update: data.updateStand,
        remove: data.deleteStand,
      },
    ),
    ...collectionRoutes(
      { collection: API_PATHS.areas, item: API_PATHS.area },
      {
        list: data.listAreas,
        create: data.createArea,
        update: data.updateArea,
        remove: data.deleteArea,
      },
    ),
    ...collectionRoutes(
      { collection: API_PATHS.harvests, item: API_PATHS.harvest },
      {
        list: data.listHarvests,
        create: data.createHarvest,
        update: data.updateHarvest,
        remove: data.deleteHarvest,
      },
    ),
    {
      method: 'GET',
      path: API_PATHS.mapPacks,
      handle: (c, p) => data.listMapPacks(c.actor, p.clubId!),
    },
    {
      // Admin: build a map pack of the club's property (one basemap) in the background.
      method: 'POST',
      path: API_PATHS.mapPacks,
      status: 202,
      handle: async (c, p): Promise<MapPackRequestResponse> => {
        const club = await data.getClubForMapPack(c.actor, p.clubId!);
        const now = c.deps.now?.() ?? new Date();
        if (!hasClubFeatures(await data.getEntitlement(c.actor, club.id), now)) {
          throw new ClubDataError(
            'club_inactive',
            'new map packs need an active club subscription',
          );
        }
        const request = parse(MapPackRequestSchema, c.body ?? {});
        if (!club.boundary) throw new ClubDataError('invalid', 'draw the property line first');
        const bounds = polygonBounds(club.boundary);
        const estimate = estimatePack(
          bounds,
          request.minZoom,
          request.maxZoom,
          request.basemap,
          MAP_PACK_LIMITS,
        );
        if (estimate.overLimit) {
          throw new ClubDataError(
            'invalid',
            `the property is too big for one pack (${estimate.overLimit})`,
          );
        }
        if (!c.deps.startMapPackBuild) {
          throw new ClubDataError('not_configured', 'map packs are not set up yet');
        }
        // Records the pack as building and takes the club's build lock (409 if busy).
        const { minZoom, maxZoom, basemap } = request;
        const pack = await data.startMapPackBuild(
          c.actor,
          club.id,
          { bounds, minZoom, maxZoom, source: BASEMAPS[basemap].source },
          { id: (c.deps.newId ?? randomUUID)() },
        );
        try {
          await c.deps.startMapPackBuild({ clubId: club.id, packId: pack.id, bounds, ...request });
        } catch (error) {
          // Free the club again; the pack shows why.
          await data.failMapPack(SERVICE, club.id, pack.id, 'the build could not be started');
          throw error;
        }
        return { packId: pack.id, tiles: estimate.tiles, bytes: estimate.bytes };
      },
    },

    // Radio key (admins only; base64 in JSON)
    {
      method: 'GET',
      path: API_PATHS.secret,
      handle: async (c, p) => secretJson(await data.getClubSecret(c.actor, p.clubId!)),
    },
    {
      method: 'PUT',
      path: API_PATHS.secret,
      handle: async (c, p) => {
        const { channelKey } = parse(ClubSecretPutRequestSchema, c.body);
        const key = Uint8Array.from(Buffer.from(channelKey, 'base64'));
        return secretJson(await data.setClubSecret(c.actor, p.clubId!, key));
      },
    },

    // Billing
    {
      method: 'GET',
      path: API_PATHS.entitlement,
      handle: (c, p) => data.getEntitlement(c.actor, p.clubId!),
    },
    {
      method: 'GET',
      path: API_PATHS.subscription,
      handle: (c, p) => data.getSubscription(c.actor, p.clubId!),
    },
    {
      method: 'POST',
      path: API_PATHS.checkout,
      handle: async (c, p) => {
        const club = await data.getBillableClub(c.actor, p.clubId!);
        const { planId } = parse(CheckoutRequestSchema, c.body);
        const plan = (await data.listPlans(ANONYMOUS)).find((pl) => pl.id === planId);
        if (!plan) throw new ClubDataError('invalid', 'unknown plan');
        const priceId = c.deps.checkout.prices[planId];
        if (!priceId) throw new ClubDataError('not_configured', 'no Stripe price for this plan');
        const url = await createCheckout(await c.deps.stripe(), {
          clubId: club.id,
          planId,
          priceId,
          config: c.deps.checkout,
        });
        return { url };
      },
    },
  ];
}

function parseJson(event: FunctionUrlEvent): unknown {
  const text = rawBody(event).toString('utf8');
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ClubDataError('invalid', 'body is not JSON');
  }
}

export function createClubApi(deps: ClubApiDeps): Handler {
  const table = routes(deps.data);
  return async (event) => {
    const method = methodOf(event);
    const path = event.rawPath ?? '/';
    const match = matchRoute(table, method, path);
    let status = 0;
    try {
      if (!match.route) {
        status = match.methodNotAllowed ? 405 : 404;
        return match.methodNotAllowed
          ? { ...errorResponse('not_found', 'method not allowed'), statusCode: 405 }
          : errorResponse('not_found', 'no such route');
      }
      let actor: Actor = ANONYMOUS;
      if (match.route.access !== 'public') {
        const token = bearerToken(event);
        const sub = token ? await deps.verifier.verify(token).catch(() => undefined) : undefined;
        if (!sub) throw new ClubDataError('not_authenticated', 'a valid access token is required');
        actor = userActor(sub);
      }
      const result = await match.route.handle(
        { actor, body: parseJson(event), deps },
        match.params,
      );
      status = match.route.status ?? 200;
      return status === 204 ? jsonResponse(204) : jsonResponse(status, result);
    } catch (error) {
      const response = toErrorResponse(error);
      status = response.statusCode;
      return response;
    } finally {
      // Route pattern, not the raw path: ids stay out of the logs.
      logLine({ msg: 'club-api', method, route: match.route?.path ?? 'unmatched', status });
    }
  };
}
