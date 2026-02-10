/**
 * GraphQL query for fetching workspace data (including customer ID)
 */

export const WORKSPACE_QUERY = `
  query workspace($workspaceId: String!) {
    workspace(workspaceId: $workspaceId) {
      customer {
        id
      }
    }
  }
`;

export const WORKSPACE_OPERATION = 'workspace';
