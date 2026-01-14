/**
 * GraphQL query for fetching earnings data
 */

export const EARNINGS_QUERY = `
  query withdrawalData($customerId: String!) {
    earningDetails(customerId: $customerId) {
      lifetimeEarnings
      referralEarningsLifetime
      referralEarnings30d
      templateEarningsLifetime
      templateEarnings30d
      bountyEarningsLifetime
      bountyEarnings30d
      threadEarningsLifetime
      threadEarnings30d
      availableBalance
      lifetimeCashWithdrawals
      lifetimeCreditWithdrawals
    }
  }
`;

export const EARNINGS_OPERATION = 'withdrawalData';
