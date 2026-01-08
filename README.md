# railway-template-metrics

system that collects and stores railway template metrics on a schedule for review

## Metrics to collect

### Overall earnings metrics 

This can be done using the GraphQL API with the following query: 

```graphql
query withdrawalData($customerId: String!) {
  earningDetails(customerId: $customerId) {
    ...EarningDetails
  }
  withdrawalAccountsV2(customerId: $customerId) {
    ...WithdrawalAccountInfo
  }
  hasRecentWithdrawal(customerId: $customerId)
}

fragment EarningDetails on EarningDetails {
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

fragment WithdrawalAccountInfo on WithdrawalAccount {
  id
  platform
  platformDetails
  customerId
  stripeConnectInfo {
    hasOnboarded
    needsAttention
    bankLast4
    cardLast4
  }
}
```

where customer ID is my customer ID. 

Here's an example query body: 

`POST https://backboard.railway.com/graphql/internal` 

```json 
{
    "query": {}, // ...query above, 
    "variables": {
        "customerId" "my-uuid"
    },
    "operationName": "withdrawlData"
}
```

Form this, I can get a lot of earning information that would be useful to track over time. All cash values are stored as integers where the last to places replresent the decimal. For example the number `1408500` represents $14,085.00`

### Individual Template Metrics

These metrics will be useful for tracking the performance of each of my templates individually, and making sure that I can make data driven decisions on what works / doesn't work for template categories. What's growing, what isn't growing over time, etc.

You can fetch this with another GraphQL Query: 

```graphql
query workspaceTemplates($workspaceId: String!) {
  workspaceTemplates(workspaceId: $workspaceId) {
    edges {
      node {
        ...UserTemplateFields
      }
    }
  }
}

fragment UserTemplateFields on Template {
  ...TemplateFields
  activeProjects
  totalPayout
}

fragment TemplateFields on Template {
  ...TemplateMetadataFields
  id
  code
  createdAt
  demoProjectId
  workspaceId
  serializedConfig
  canvasConfig
  status
  isApproved
  isVerified
  communityThreadSlug
  isV2Template
  health
  projects
  recentProjects
}

fragment TemplateMetadataFields on Template {
  name
  description
  image
  category
  readme
  tags
  languages
  guides {
    post
    video
  }
}
```

where workspaceId is my workspace ID 

Here's an example query body: 

`POST https://backboard.railway.com/graphql/internal` 

```json 
{
    "query": {}, // ...query above, 
    "variables": {
        "workspaceId" "my-workspace-uuid"
    },
    "operationName": "workspaceTemplates"
}
```

This returns some info I don't care about but lots I do. Namely: 

- health: this reports on the health of the project. A low health means reduced payout % from 25% to 15%
- projects: total number of projects created from this template since it's release 
- activeProjects: current number of projects using the services deployed by this template
- recentProjects: number of projects recently created with this template (good sign of template health / growth curve) 
- totalPayout: the current total commision made from this template via template kickbacks

You can get some great metrics with this data: 

- activeProjects / projects: gives you a total percentage of retention 
- recentProjects / activeProjects: gives you a good relative growth curve; could also compare recentprojects to a previously collected recent projects maybe? 
- totalPayout over time lets me track how much my templates are paying out / at what rate they're growing. Measuring this over time will be huge in showing momentum.

