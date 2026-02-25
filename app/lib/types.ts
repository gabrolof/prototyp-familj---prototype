export type TierId = "15_GB" | "UNLIMITED" | "UNLIMITED_MAX";

export type LineRole = "MAIN" | "SUB";

export type OfferType = "NEW_CUSTOMER" | "RENEWAL" | "NONE";

export type CustomerType = "NEW" | "EXISTING";

export type BindingMonths = 0 | 24;

export interface OwnedPhoneNumber {
  msisdn: string;
  inBinding: boolean;
  bindingCompatibleWithRenewalOffer: boolean;
}

export interface MockCustomer {
  ssn: string;
  hasFamily: boolean;
  familyTier: TierId | null;
  ownedPhoneNumbers: OwnedPhoneNumber[];
  existingFamilyLines: string[];
}

export interface TierDefinition {
  id: TierId;
  label: string;
  description: string;
  prices: {
    main: number;
    sub: number;
  };
}

export interface DeviceDefinition {
  id: string;
  name: string;
  priceType: "monthly" | "oneTime";
  price: number;
  shortDescription: string;
}

export type DeviceMemoryOption = "128GB" | "256GB";
export type DevicePaymentPeriod = "DIRECT" | "24_MONTH" | "36_MONTH";

export interface DeviceSelection {
  color: string;
  memory: DeviceMemoryOption;
  paymentPeriod: DevicePaymentPeriod;
}

export interface CustomerContext {
  ssn: string;
  type: CustomerType;
  hasFamily: boolean;
  familyTier: TierId | null;
  ownedNumbers: OwnedPhoneNumber[];
  existingFamilyLines: string[];
}

export interface OfferResult {
  offerType: OfferType;
  discountSek: number;
  bindingMonths: BindingMonths;
  reasonText: string;
}

export interface LinePriceResult {
  base: number;
  discount: number;
  final: number;
}

export interface CartLineDraft {
  id: string;
  role: LineRole;
  msisdn: string;
  deviceId: string | null;
  deviceSelection: DeviceSelection | null;
  existingFamilyLine: boolean;
}

export interface PricedCartLine {
  id: string;
  role: LineRole;
  msisdn: string;
  deviceId: string | null;
  deviceSelection: DeviceSelection | null;
  existingFamilyLine: boolean;
  offer: OfferResult;
  price: LinePriceResult;
  deviceMonthly: number;
  deviceOneTime: number;
}

export interface CartTotals {
  monthlyTotal: number;
  oneTimeTotal: number;
  bindingMonthsMax: BindingMonths;
}
