/**
 * GraphQL query for fetching workspace templates
 */

export const TEMPLATES_QUERY = `
  query workspaceTemplates($workspaceId: String!) {
    workspaceTemplates(workspaceId: $workspaceId) {
      edges {
        node {
          id
          code
          createdAt
          name
          description
          image
          category
          tags
          languages
          status
          isApproved
          isVerified
          health
          projects
          activeProjects
          recentProjects
          totalPayout
        }
      }
    }
  }
`;

export const TEMPLATES_OPERATION = 'workspaceTemplates';
