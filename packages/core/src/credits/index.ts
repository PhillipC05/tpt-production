import type {
  CreditAccount,
  CreditTransaction,
  CreditTransactionType,
} from "@tpt/types";
import {
  CreditTransactionType as CreditTransactionTypeValues,
} from "@tpt/types";
import type { FeatureFlags } from "../flags";
import { featureFlags as defaultFeatureFlags } from "../flags";

export interface CreditOperationInput {
  accountId: string;
  userId: string;
  amount: number;
  note?: string;
}

export interface CreditOperationResult {
  enabled: boolean;
  applied: boolean;
  account: CreditAccount;
  transaction?: CreditTransaction;
  reason?: string;
}

function createTransactionId(): string {
  return `credit_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function createCreditTransaction(
  account: CreditAccount,
  amount: number,
  type: CreditTransactionType,
  note: string | undefined,
): CreditTransaction {
  const transaction: CreditTransaction = {
    id: createTransactionId(),
    accountId: account.id,
    amount,
    type,
    createdAt: new Date().toISOString(),
  };

  if (note !== undefined) {
    transaction.note = note;
  }

  return transaction;
}

function withBalance(
  account: CreditAccount,
  balance: number,
  updatedAt: Date | string,
): CreditAccount {
  const updatedAccount: CreditAccount = {
    ...account,
    balance,
  };
  updatedAccount.updatedAt = updatedAt;

  return updatedAccount;
}

function disabledResult(account: CreditAccount): CreditOperationResult {
  return {
    enabled: false,
    applied: false,
    account,
    reason: "ENABLE_CREDITS is disabled",
  };
}

export function EarnCredits(
  account: CreditAccount,
  amount: number,
  note?: string,
  flags: FeatureFlags = defaultFeatureFlags,
): CreditOperationResult {
  if (!flags.ENABLE_CREDITS) {
    return disabledResult(account);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      enabled: true,
      applied: false,
      account,
      reason: "amount must be a positive number",
    };
  }

  const transaction = createCreditTransaction(
    account,
    amount,
    CreditTransactionTypeValues.EARNED,
    note,
  );

  return {
    enabled: true,
    applied: true,
    account: withBalance(
      account,
      account.balance + amount,
      transaction.createdAt ?? new Date().toISOString(),
    ),
    transaction,
  };
}

export function SpendCredits(
  account: CreditAccount,
  amount: number,
  note?: string,
  flags: FeatureFlags = defaultFeatureFlags,
): CreditOperationResult {
  if (!flags.ENABLE_CREDITS) {
    return disabledResult(account);
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      enabled: true,
      applied: false,
      account,
      reason: "amount must be a positive number",
    };
  }

  if (amount > account.balance) {
    return {
      enabled: true,
      applied: false,
      account,
      reason: "insufficient credit balance",
    };
  }

  const transaction = createCreditTransaction(
    account,
    -amount,
    CreditTransactionTypeValues.SPENT,
    note,
  );

  return {
    enabled: true,
    applied: true,
    account: withBalance(
      account,
      account.balance - amount,
      transaction.createdAt ?? new Date().toISOString(),
    ),
    transaction,
  };
}

export const earnCredits = EarnCredits;
export const spendCredits = SpendCredits;