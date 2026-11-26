// Typed client for the club API (packages/api). One client for the app and the web
// admin: paths come from API_PATHS, request bodies are checked and responses parsed
// with the same zod schemas the server uses.
import { z } from 'zod';
import { API_PATHS, type ApiPath, apiPath } from './apiPaths';
import {
  type ApiErrorBody,
  type CheckoutRequest,
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  type ClubCreateRequest,
  ClubCreateRequestSchema,
  ClubSecretResponseSchema,
  EntitlementSchema,
  type MapPackRequest,
  MapPackRequestResponseSchema,
  MapPackRequestSchema,
  MyClubSchema,
  type RedeemInviteRequest,
  RedeemInviteRequestSchema,
} from './api';
import {
  AreaSchema,
  HarvestSchema,
  ClubSchema,
  type InviteCreate,
  InviteCreateSchema,
  InviteSchema,
  MapPackSchema,
  MemberSchema,
  PlanSchema,
  StandSchema,
  SubscriptionSchema,
} from './club';
import { CLUB_API_ERRORS, type ClubApiError } from './enums';
import { type FetchLike, readJson } from './http';

/** A failed API call: the server's error code, or `network` / `bad_response`. */
export class ClubApiRequestError extends Error {
  constructor(
    readonly code: ClubApiError | 'network' | 'bad_response',
    readonly status: number,
    message: string = code,
  ) {
    super(message);
    this.name = 'ClubApiRequestError';
  }
}

export interface ClubApiClientOptions {
  /** Club API base URL (no trailing slash). */
  baseUrl: string;
  fetch: FetchLike;
  /** Current access token (undefined when signed out: only public routes work). */
  accessToken: () => Promise<string | undefined>;
  /** Called once on a 401; return true after refreshing the token to retry. */
  refresh?: () => Promise<boolean>;
}

const errorCode = (body: unknown): ClubApiError | undefined => {
  const code = (body as Partial<ApiErrorBody> | undefined)?.error?.code;
  return CLUB_API_ERRORS.find((c) => c === code);
};

export function createClubApiClient(options: ClubApiClientOptions) {
  async function call<S extends z.ZodType>(
    method: string,
    template: ApiPath,
    params: Record<string, string>,
    response: S,
    body?: unknown,
  ): Promise<z.output<S>> {
    const attempt = async () => {
      const token = await options.accessToken();
      const headers: Record<string, string> = { accept: 'application/json' };
      if (token) headers.authorization = `Bearer ${token}`;
      if (body !== undefined) headers['content-type'] = 'application/json';
      try {
        return await options.fetch(`${options.baseUrl}${apiPath(template, params)}`, {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      } catch {
        throw new ClubApiRequestError('network', 0, 'no connection to the club service');
      }
    };
    let res = await attempt();
    if (res.status === 401 && options.refresh && (await options.refresh())) res = await attempt();
    let json: unknown;
    try {
      json = await readJson(res);
    } catch {
      throw new ClubApiRequestError('bad_response', res.status);
    }
    if (res.status >= 400) {
      const code = errorCode(json) ?? 'bad_response';
      throw new ClubApiRequestError(
        code,
        res.status,
        (json as ApiErrorBody | undefined)?.error?.message,
      );
    }
    const parsed = response.safeParse(json);
    if (!parsed.success) throw new ClubApiRequestError('bad_response', res.status);
    return parsed.data;
  }

  const club = (clubId: string) => ({ clubId });
  return {
    listPlans: () => call('GET', API_PATHS.plans, {}, z.array(PlanSchema)),
    listMyClubs: () => call('GET', API_PATHS.myClubs, {}, z.array(MyClubSchema)),
    /** Starts a club; the caller becomes its first admin. */
    createClub: async (request: ClubCreateRequest) =>
      call('POST', API_PATHS.clubs, {}, ClubSchema, ClubCreateRequestSchema.parse(request)),
    getClub: (clubId: string) => call('GET', API_PATHS.club, club(clubId), ClubSchema),
    listMembers: (clubId: string) =>
      call('GET', API_PATHS.members, club(clubId), z.array(MemberSchema)),
    createInvite: async (clubId: string, request: InviteCreate) =>
      call(
        'POST',
        API_PATHS.invites,
        club(clubId),
        InviteSchema,
        InviteCreateSchema.parse(request),
      ),
    listStands: (clubId: string) =>
      call('GET', API_PATHS.stands, club(clubId), z.array(StandSchema)),
    listAreas: (clubId: string) => call('GET', API_PATHS.areas, club(clubId), z.array(AreaSchema)),
    /** The club's harvests the caller may see (their own, plus everyone's shared ones). */
    listHarvests: (clubId: string) =>
      call('GET', API_PATHS.harvests, club(clubId), z.array(HarvestSchema)),
    getEntitlement: (clubId: string) =>
      call('GET', API_PATHS.entitlement, club(clubId), EntitlementSchema),
    getSubscription: (clubId: string) =>
      call('GET', API_PATHS.subscription, club(clubId), SubscriptionSchema),
    /** Stripe Checkout for the club's subscription; redirect the browser to `url`. */
    startCheckout: async (clubId: string, request: CheckoutRequest) =>
      call(
        'POST',
        API_PATHS.checkout,
        club(clubId),
        CheckoutResponseSchema,
        CheckoutRequestSchema.parse(request),
      ),
    getClubSecret: (clubId: string) =>
      call('GET', API_PATHS.secret, club(clubId), ClubSecretResponseSchema),
    listMapPacks: (clubId: string) =>
      call('GET', API_PATHS.mapPacks, club(clubId), z.array(MapPackSchema)),
    /** Admin: starts building the club's pack for one basemap; it is listed once built. */
    requestMapPack: async (clubId: string, request: MapPackRequest) =>
      call(
        'POST',
        API_PATHS.mapPacks,
        club(clubId),
        MapPackRequestResponseSchema,
        MapPackRequestSchema.parse(request),
      ),
    redeemInvite: async (request: RedeemInviteRequest) =>
      call(
        'POST',
        API_PATHS.redeemInvite,
        {},
        MemberSchema,
        RedeemInviteRequestSchema.parse(request),
      ),
  };
}

export type ClubApiClient = ReturnType<typeof createClubApiClient>;
