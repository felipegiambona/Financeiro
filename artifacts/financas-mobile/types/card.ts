import type {
  Card as ApiCard,
  CardInput as ApiCardInput,
  CardUpdate as ApiCardUpdate,
  InvoiceStatus as ApiInvoiceStatus,
  CardHistoryItem as ApiCardHistoryItem,
} from '@workspace/api-client-react';

export type Card = ApiCard;
export type NewCardInput = ApiCardInput;
export type CardUpdate = ApiCardUpdate;
export type InvoiceStatus = ApiInvoiceStatus;
export type CardHistoryItem = ApiCardHistoryItem;