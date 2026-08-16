/**
 * ShipStation integration module — ALL ShipStation API access lives here.
 *
 * Uses the Replit-managed ShipStation connection (connector "shipstation-v2",
 * ShipStation API v2). Credentials are injected by the connector proxy; this
 * module never sees or stores keys. Nothing in this module ever purchases a
 * label or incurs carrier charges — we push shipments and read back
 * labels/tracking that the owner creates in the ShipStation dashboard.
 *
 * External-service failures must never corrupt local orders: every function
 * throws typed errors that callers (the fulfillment service) convert into
 * retry state on the shipment record.
 */
import { ReplitConnectors } from "@replit/connectors-sdk";

const CONNECTOR = "shipstation-v2";
const API_PREFIX = process.env.SHIPSTATION_API_PREFIX ?? "/v2";
const REQUEST_TIMEOUT_MS = 15_000;

/** Test mode is ON unless explicitly disabled. Surfaced in the admin UI. */
export function isTestMode(): boolean {
  return (process.env.SHIPSTATION_TEST_MODE ?? "true").toLowerCase() !== "false";
}

export class ShipStationNotConnectedError extends Error {
  constructor(message = "ShipStation is not connected") {
    super(message);
    this.name = "ShipStationNotConnectedError";
  }
}

export class ShipStationApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`ShipStation API error ${status}: ${body.slice(0, 300)}`);
    this.name = "ShipStationApiError";
    this.status = status;
    this.body = body;
  }
}

function classifyError(err: unknown): Error {
  if (err instanceof ShipStationNotConnectedError || err instanceof ShipStationApiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/not.?connected|no.+connection|connection.+not.+found|missing.+connection|unauthorized|credential/i.test(msg)) {
    return new ShipStationNotConnectedError(msg);
  }
  return err instanceof Error ? err : new Error(msg);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`ShipStation request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ssFetch(path: string, init?: { method?: string; body?: unknown }): Promise<any> {
  const connectors = new ReplitConnectors();
  let response: Response;
  try {
    response = (await withTimeout(
      Promise.resolve(
        connectors.proxy(CONNECTOR, `${API_PREFIX}${path}`, {
          method: init?.method ?? "GET",
          headers: { "Content-Type": "application/json" },
          ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
        }),
      ),
      REQUEST_TIMEOUT_MS,
    )) as unknown as Response;
  } catch (err) {
    throw classifyError(err);
  }
  if (response.status === 401 || response.status === 403) {
    const text = await response.text().catch(() => "");
    throw new ShipStationNotConnectedError(`Authentication failed (${response.status}): ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // The connectors proxy reports a missing/unbound connection as a 404 with
    // a "No <connector> connection found" body. That is "not connected" — not
    // a ShipStation API error. Real ShipStation 404s (e.g. unknown tracking
    // number) don't match this body shape.
    if (response.status === 404 && /no .*connection (?:found|for)/i.test(text)) {
      throw new ShipStationNotConnectedError(`ShipStation is not connected: ${text.slice(0, 200)}`);
    }
    throw new ShipStationApiError(response.status, text);
  }
  if (response.status === 204) return null;
  return response.json();
}

// ── Cached reference data ──────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await load();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export interface SsCarrier {
  carrierId: string;
  carrierCode: string;
  friendlyName: string;
}

export async function listCarriers(): Promise<SsCarrier[]> {
  return cached("carriers", 10 * 60_000, async () => {
    const data = await ssFetch("/carriers");
    const carriers = Array.isArray(data?.carriers) ? data.carriers : [];
    return carriers.map((c: any) => ({
      carrierId: String(c.carrier_id ?? ""),
      carrierCode: String(c.carrier_code ?? ""),
      friendlyName: String(c.friendly_name ?? c.carrier_code ?? ""),
    }));
  });
}

export interface SsWarehouse {
  warehouseId: string;
  name: string;
  originCountryCode: string;
}

export async function getDefaultWarehouse(): Promise<SsWarehouse | null> {
  return cached("warehouse", 10 * 60_000, async () => {
    const data = await ssFetch("/warehouses");
    const warehouses = Array.isArray(data?.warehouses) ? data.warehouses : [];
    if (!warehouses.length) return null;
    const preferred = warehouses.find((w: any) => w.is_default) ?? warehouses[0];
    return {
      warehouseId: String(preferred.warehouse_id ?? ""),
      name: String(preferred.name ?? ""),
      originCountryCode: String(preferred.origin_address?.country_code ?? "US"),
    };
  });
}

// ── Connection health ──────────────────────────────────────────────────────────

export interface ConnectionHealth {
  connected: boolean;
  healthy: boolean;
  message: string | null;
  carrierCount: number | null;
}

export async function checkConnection(): Promise<ConnectionHealth> {
  return cached("health", 60_000, async () => {
    try {
      const carriers = await listCarriers();
      return { connected: true, healthy: true, message: null, carrierCount: carriers.length };
    } catch (err) {
      if (err instanceof ShipStationNotConnectedError) {
        return { connected: false, healthy: false, message: err.message, carrierCount: null };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { connected: true, healthy: false, message: msg, carrierCount: null };
    }
  });
}

/** Drop cached health so the next check hits the API (used after connect/webhook). */
export function invalidateHealthCache(): void {
  cache.delete("health");
}

// ── Shipments (order push) ─────────────────────────────────────────────────────

export interface ShipToAddress {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  countryCode: string;
  phone?: string | null;
}

export interface PushItem {
  name: string;
  sku: string;
  quantity: number;
  unitPriceCents: number;
  weightGrams: number | null;
  hsCode: string | null;
  countryOfOrigin: string | null;
  customsDescription: string | null;
  customsValueCents: number | null;
}

export interface PushOrderInput {
  orderNumber: string;
  customerEmail: string | null;
  shipTo: ShipToAddress;
  items: PushItem[];
  currency: string;
  serviceCode?: string | null;
}

export interface PushedShipment {
  shipmentId: string;
  status: string | null;
}

const DEFAULT_ITEM_WEIGHT_GRAMS = 250; // sensible default for a lifting strap

function parseDimensionsCm(dims: string | null | undefined): { length: number; width: number; height: number } | null {
  if (!dims) return null;
  const parts = dims.split(/[x×,]/i).map((p) => parseFloat(p.trim())).filter((n) => !Number.isNaN(n) && n > 0);
  if (parts.length !== 3) return null;
  return { length: parts[0]!, width: parts[1]!, height: parts[2]! };
}

function buildShipmentPayload(input: PushOrderInput, warehouseId: string, originCountry: string): Record<string, unknown> {
  const totalWeightGrams = input.items.reduce(
    (sum, item) => sum + (item.weightGrams ?? DEFAULT_ITEM_WEIGHT_GRAMS) * item.quantity,
    0,
  );

  const isInternational = input.shipTo.countryCode.toUpperCase() !== originCountry.toUpperCase();
  const currency = (input.currency || "usd").toLowerCase();

  const payload: Record<string, unknown> = {
    external_shipment_id: input.orderNumber,
    warehouse_id: warehouseId,
    confirmation: "none",
    ship_to: {
      name: input.shipTo.name || "Customer",
      address_line1: input.shipTo.line1,
      ...(input.shipTo.line2 ? { address_line2: input.shipTo.line2 } : {}),
      city_locality: input.shipTo.city,
      state_province: input.shipTo.state ?? "",
      postal_code: input.shipTo.postalCode ?? "",
      country_code: input.shipTo.countryCode.toUpperCase(),
      ...(input.shipTo.phone ? { phone: input.shipTo.phone } : {}),
      address_residential_indicator: "yes",
    },
    packages: [
      {
        weight: { value: Math.max(totalWeightGrams, 1), unit: "gram" },
      },
    ],
    items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
    })),
  };

  if (input.serviceCode) payload.service_code = input.serviceCode;

  if (isInternational) {
    payload.customs = {
      contents: "merchandise",
      non_delivery: "return_to_sender",
      customs_items: input.items.map((item) => ({
        description: item.customsDescription ?? item.name,
        quantity: item.quantity,
        value: {
          currency,
          amount: ((item.customsValueCents ?? item.unitPriceCents) / 100),
        },
        ...(item.hsCode ? { harmonized_tariff_code: item.hsCode } : {}),
        country_of_origin: (item.countryOfOrigin ?? originCountry).toUpperCase(),
        sku: item.sku,
      })),
    };
  }

  return payload;
}

export async function findShipmentByExternalId(orderNumber: string): Promise<PushedShipment | null> {
  const data = await ssFetch(`/shipments?external_shipment_id=${encodeURIComponent(orderNumber)}`);
  const shipments = Array.isArray(data?.shipments) ? data.shipments : [];
  const match = shipments.find((s: any) => s.shipment_status !== "cancelled") ?? shipments[0];
  if (!match) return null;
  return { shipmentId: String(match.shipment_id), status: match.shipment_status ?? null };
}

/**
 * Push an order to ShipStation as a shipment. Idempotent: if a shipment with
 * this order number already exists (from a prior partial failure), it is reused.
 */
export async function pushOrder(input: PushOrderInput): Promise<PushedShipment> {
  const existing = await findShipmentByExternalId(input.orderNumber);
  if (existing) return existing;

  const warehouse = await getDefaultWarehouse();
  if (!warehouse) {
    throw new ShipStationApiError(422, "No Ship From location configured in ShipStation. Add a warehouse in ShipStation settings.");
  }

  const payload = buildShipmentPayload(input, warehouse.warehouseId, warehouse.originCountryCode);
  const data = await ssFetch("/shipments", { method: "POST", body: { shipments: [payload] } });
  const created = Array.isArray(data?.shipments) ? data.shipments[0] : null;
  const errors = created?.errors ?? (data?.has_errors ? data?.errors : null);
  if (!created?.shipment_id) {
    const detail = errors ? JSON.stringify(errors).slice(0, 300) : "no shipment id returned";
    throw new ShipStationApiError(422, `Shipment creation rejected: ${detail}`);
  }
  return { shipmentId: String(created.shipment_id), status: created.shipment_status ?? null };
}

export interface SsShipmentSnapshot {
  shipmentId: string;
  status: string | null;
  serviceCode: string | null;
  carrierId: string | null;
}

export async function getShipment(shipmentId: string): Promise<SsShipmentSnapshot | null> {
  const s = await ssFetch(`/shipments/${encodeURIComponent(shipmentId)}`);
  if (!s?.shipment_id) return null;
  return {
    shipmentId: String(s.shipment_id),
    status: s.shipment_status ?? null,
    serviceCode: s.service_code ?? null,
    carrierId: s.carrier_id ? String(s.carrier_id) : null,
  };
}

// ── Labels ─────────────────────────────────────────────────────────────────────

export interface SsLabel {
  labelId: string;
  status: string | null;
  trackingNumber: string | null;
  carrierCode: string | null;
  serviceCode: string | null;
  labelUrl: string | null;
  createdAt: string | null;
}

/** Labels the owner purchased in ShipStation for a shipment we pushed. Read-only. */
export async function getLabelsForShipment(shipmentId: string): Promise<SsLabel[]> {
  const data = await ssFetch(`/labels?shipment_id=${encodeURIComponent(shipmentId)}`);
  const labels = Array.isArray(data?.labels) ? data.labels : [];
  return labels
    .filter((l: any) => l.status !== "voided")
    .map((l: any) => ({
      labelId: String(l.label_id ?? ""),
      status: l.status ?? null,
      trackingNumber: l.tracking_number ?? null,
      carrierCode: l.carrier_code ?? null,
      serviceCode: l.service_code ?? null,
      labelUrl: l.label_download?.pdf ?? l.label_download?.href ?? null,
      createdAt: l.created_at ?? null,
    }));
}

// ── Tracking ───────────────────────────────────────────────────────────────────

export type Milestone =
  | "label_created"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface SsTrackingEvent {
  occurredAt: string;
  description: string;
  cityLocality: string | null;
  stateProvince: string | null;
  countryCode: string | null;
}

export interface SsTrackingInfo {
  statusCode: string | null;
  statusDescription: string | null;
  estimatedDeliveryDate: string | null;
  actualDeliveryDate: string | null;
  events: SsTrackingEvent[];
}

export async function getTracking(carrierCode: string, trackingNumber: string): Promise<SsTrackingInfo> {
  const data = await ssFetch(
    `/tracking?carrier_code=${encodeURIComponent(carrierCode)}&tracking_number=${encodeURIComponent(trackingNumber)}`,
  );
  const events = Array.isArray(data?.events) ? data.events : [];
  return {
    statusCode: data?.status_code ?? null,
    statusDescription: data?.status_description ?? null,
    estimatedDeliveryDate: data?.estimated_delivery_date ?? null,
    actualDeliveryDate: data?.actual_delivery_date ?? null,
    events: events.map((e: any) => ({
      occurredAt: e.occurred_at ?? e.carrier_occurred_at ?? new Date().toISOString(),
      description: String(e.description ?? e.carrier_detail_code ?? "Carrier scan"),
      cityLocality: e.city_locality ?? null,
      stateProvince: e.state_province ?? null,
      countryCode: e.country_code ?? null,
    })),
  };
}

/** Map a ShipStation v2 top-level tracking status code to our internal milestone. */
export function normalizeTrackingStatus(statusCode: string | null | undefined): Milestone | null {
  switch ((statusCode ?? "").toUpperCase()) {
    case "AC": // accepted by carrier
      return "shipped";
    case "IT": // in transit
      return "in_transit";
    case "AT": // delivery attempt
      return "out_for_delivery";
    case "DE": // delivered
    case "SP": // delivered to service point
      return "delivered";
    case "EX": // exception
      return "exception";
    default:
      return null;
  }
}

/** Classify a single carrier scan description into a milestone (for the event log). */
export function normalizeEventDescription(description: string): Milestone {
  const d = description.toLowerCase();
  if (/out for delivery/.test(d)) return "out_for_delivery";
  if (/delivered/.test(d)) return "delivered";
  if (/exception|return to sender|undeliverable|failed|held|refused|damage/.test(d)) return "exception";
  if (/picked up|accept|origin scan|shipment received|possession/.test(d)) return "shipped";
  return "in_transit";
}

// ── Rates ──────────────────────────────────────────────────────────────────────

export interface CarrierRateQuote {
  serviceCode: string;
  serviceName: string | null;
  amountCents: number;
  deliveryDays: number | null;
}

export async function getCarrierRates(input: {
  carrierCode: string;
  shipTo: ShipToAddress;
  weightGrams: number;
  dimensionsCm?: string | null;
}): Promise<CarrierRateQuote[]> {
  const [carriers, warehouse] = await Promise.all([listCarriers(), getDefaultWarehouse()]);
  const carrier = carriers.find((c) => c.carrierCode === input.carrierCode);
  if (!carrier) throw new ShipStationApiError(422, `Carrier "${input.carrierCode}" is not available on this ShipStation account`);
  if (!warehouse) throw new ShipStationApiError(422, "No Ship From location configured in ShipStation");

  const dims = parseDimensionsCm(input.dimensionsCm);
  const body = {
    shipment: {
      warehouse_id: warehouse.warehouseId,
      ship_to: {
        name: input.shipTo.name || "Customer",
        address_line1: input.shipTo.line1 || "Address",
        city_locality: input.shipTo.city || "",
        state_province: input.shipTo.state ?? "",
        postal_code: input.shipTo.postalCode ?? "",
        country_code: input.shipTo.countryCode.toUpperCase(),
        address_residential_indicator: "yes",
      },
      packages: [
        {
          weight: { value: Math.max(input.weightGrams, 1), unit: "gram" },
          ...(dims ? { dimensions: { ...dims, unit: "centimeter" } } : {}),
        },
      ],
    },
    rate_options: { carrier_ids: [carrier.carrierId] },
  };

  const data = await ssFetch("/rates", { method: "POST", body });
  const rates = Array.isArray(data?.rate_response?.rates) ? data.rate_response.rates : [];
  return rates.map((r: any) => {
    const amount =
      (r.shipping_amount?.amount ?? 0) +
      (r.other_amount?.amount ?? 0) +
      (r.confirmation_amount?.amount ?? 0) +
      (r.insurance_amount?.amount ?? 0);
    return {
      serviceCode: String(r.service_code ?? ""),
      serviceName: r.service_type ?? null,
      amountCents: Math.round(amount * 100),
      deliveryDays: typeof r.delivery_days === "number" ? r.delivery_days : null,
    };
  });
}
