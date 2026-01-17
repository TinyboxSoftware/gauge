/**
 * Sample earnings data for testing
 */

import type { EarningDetails } from '../../railway/types';

export const sampleEarnings: EarningDetails = {
  lifetimeEarnings: 1000000, // $10,000.00
  lifetimeCashWithdrawals: 500000, // $5,000.00
  lifetimeCreditWithdrawals: 200000, // $2,000.00
  availableBalance: 300000, // $3,000.00
  templateEarningsLifetime: 800000, // $8,000.00
  templateEarnings30d: 50000, // $500.00
  referralEarningsLifetime: 100000, // $1,000.00
  referralEarnings30d: 10000, // $100.00
  bountyEarningsLifetime: 50000, // $500.00
  bountyEarnings30d: 5000, // $50.00
  threadEarningsLifetime: 50000, // $500.00
  threadEarnings30d: 5000, // $50.00
};

export const sampleEarningsZero: EarningDetails = {
  lifetimeEarnings: 0,
  lifetimeCashWithdrawals: 0,
  lifetimeCreditWithdrawals: 0,
  availableBalance: 0,
  templateEarningsLifetime: 0,
  templateEarnings30d: 0,
  referralEarningsLifetime: 0,
  referralEarnings30d: 0,
  bountyEarningsLifetime: 0,
  bountyEarnings30d: 0,
  threadEarningsLifetime: 0,
  threadEarnings30d: 0,
};

export const sampleEarningsLarge: EarningDetails = {
  lifetimeEarnings: 999999999999, // Very large number
  lifetimeCashWithdrawals: 500000000000,
  lifetimeCreditWithdrawals: 100000000000,
  availableBalance: 399999999999,
  templateEarningsLifetime: 900000000000,
  templateEarnings30d: 50000000000,
  referralEarningsLifetime: 50000000000,
  referralEarnings30d: 5000000000,
  bountyEarningsLifetime: 25000000000,
  bountyEarnings30d: 2500000000,
  threadEarningsLifetime: 25000000000,
  threadEarnings30d: 2500000000,
};
