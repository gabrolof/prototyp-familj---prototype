import customersJson from "@/app/data/mockCustomers.json";
import catalogJson from "@/app/data/mockCatalog.json";
import {
  CartTotals,
  CustomerContext,
  LinePriceResult,
  LineRole,
  MockCustomer,
  OfferResult,
  PricedCartLine,
  TierDefinition,
  TierId,
} from "@/app/lib/types";

const NEW_DISCOUNT = {
  MAIN: 100,
  SUB: 50,
} as const;

const RENEWAL_DISCOUNT = {
  MAIN: 80,
  SUB: 40,
} as const;

const tiers = catalogJson.tiers as TierDefinition[];
const customers = customersJson as MockCustomer[];

function findCustomer(ssn: string, db: MockCustomer[] = customers): MockCustomer | undefined {
  return db.find((customer) => customer.ssn === ssn);
}

export function classifyCustomer(ssn: string, db: MockCustomer[] = customers): CustomerContext {
  const customer = findCustomer(ssn, db);

  if (!customer) {
    return {
      ssn,
      type: "NEW",
      hasFamily: false,
      familyTier: null,
      ownedNumbers: [],
      existingFamilyLines: [],
    };
  }

  const isNewByOwnership = customer.ownedPhoneNumbers.length === 0;

  return {
    ssn,
    type: isNewByOwnership ? "NEW" : "EXISTING",
    hasFamily: customer.hasFamily,
    familyTier: customer.familyTier,
    ownedNumbers: customer.ownedPhoneNumbers,
    existingFamilyLines: customer.existingFamilyLines,
  };
}

export function determineLineType(
  ssn: string,
  msisdn: string,
  db: MockCustomer[] = customers,
): "NEW_LINE" | "EXISTING_LINE" {
  const customer = findCustomer(ssn, db);
  if (!customer) {
    return "NEW_LINE";
  }

  const existsForSsn = customer.ownedPhoneNumbers.some((number) => number.msisdn === msisdn);
  return existsForSsn ? "EXISTING_LINE" : "NEW_LINE";
}

export function determineOffer({
  ssn,
  msisdn,
  lineRole,
  customerContext,
  db = customers,
}: {
  ssn: string;
  msisdn: string;
  lineRole: LineRole;
  customerContext: CustomerContext;
  db?: MockCustomer[];
}): OfferResult {
  const normalizedMsisdn = msisdn.trim();
  const digitsOnlyMsisdn = normalizedMsisdn.replace(/\D/g, "");

  if (digitsOnlyMsisdn.length !== 10) {
    return {
      offerType: "NONE",
      discountSek: 0,
      bindingMonths: 0,
      reasonText: "Enter a valid 10-digit phone number to evaluate offer eligibility.",
    };
  }

  const lineType = determineLineType(ssn, digitsOnlyMsisdn, db);

  if (customerContext.type === "NEW") {
    return {
      offerType: "NEW_CUSTOMER",
      discountSek: NEW_DISCOUNT[lineRole],
      bindingMonths: 24,
      reasonText: "Customer has no active ownership history. New customer offer applies.",
    };
  }

  if (lineType === "NEW_LINE") {
    return {
      offerType: "NEW_CUSTOMER",
      discountSek: NEW_DISCOUNT[lineRole],
      bindingMonths: 24,
      reasonText:
        "Phone number is new for this SSN, treated as a new-line acquisition offer.",
    };
  }

  const ownedLine = customerContext.ownedNumbers.find(
    (number) => number.msisdn === digitsOnlyMsisdn,
  );

  if (!ownedLine) {
    return {
      offerType: "NONE",
      discountSek: 0,
      bindingMonths: 0,
      reasonText: "Line ownership data missing; fallback to list price.",
    };
  }

  if (ownedLine.inBinding && !ownedLine.bindingCompatibleWithRenewalOffer) {
    return {
      offerType: "NONE",
      discountSek: 0,
      bindingMonths: 0,
      reasonText:
        "Renewal blocked: line is in binding and marked incompatible for renewal offer.",
    };
  }

  return {
    offerType: "RENEWAL",
    discountSek: RENEWAL_DISCOUNT[lineRole],
    bindingMonths: 24,
    reasonText: ownedLine.inBinding
      ? "Renewal offer applies and is compatible with current binding status."
      : "Renewal offer applies on existing line ownership.",
  };
}

export function computeLinePrice({
  tier,
  lineRole,
  offer,
}: {
  tier: TierId;
  lineRole: LineRole;
  offer: OfferResult;
}): LinePriceResult {
  const tierDef = tiers.find((candidate) => candidate.id === tier);

  if (!tierDef) {
    return { base: 0, discount: 0, final: 0 };
  }

  const base = lineRole === "MAIN" ? tierDef.prices.main : tierDef.prices.sub;
  const discount = offer.discountSek;
  const final = Math.max(0, base - discount);

  return { base, discount, final };
}

export function getNewCustomerDiscount(lineRole: LineRole): number {
  return NEW_DISCOUNT[lineRole];
}

export function getRenewalDiscount(lineRole: LineRole): number {
  return RENEWAL_DISCOUNT[lineRole];
}

export function computeCartTotals(lines: PricedCartLine[]): CartTotals {
  const monthlyTotal = lines.reduce(
    (sum, line) => sum + line.price.final + line.deviceMonthly,
    0,
  );

  const oneTimeTotal = lines.reduce((sum, line) => sum + line.deviceOneTime, 0);

  const bindingMonthsMax = Math.min(
    24,
    lines.reduce((max, line) => Math.max(max, line.offer.bindingMonths), 0),
  ) as 0 | 24;

  return {
    monthlyTotal,
    oneTimeTotal,
    bindingMonthsMax,
  };
}

export function getTierDefinitions(): TierDefinition[] {
  return tiers;
}

export function getCustomerDb(): MockCustomer[] {
  return customers;
}

export function getCatalogDevices() {
  return catalogJson.devices;
}

export function getCaseClassification(context: CustomerContext | null): string {
  if (!context) {
    return "No SSN selected";
  }

  if (context.type === "NEW") {
    return "C1 - Completely new customer behavior";
  }

  if (context.hasFamily) {
    return "C2/A5 - Existing customer with active family";
  }

  return "C2 - Existing customer without family";
}
