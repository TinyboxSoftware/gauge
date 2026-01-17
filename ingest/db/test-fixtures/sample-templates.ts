/**
 * Sample template data for testing
 */

import type { Template } from '../../railway/types';

/**
 * Template with high retention (80%)
 */
export const highRetentionTemplate: Template = {
  id: 'template-high-retention',
  code: 'high-retention',
  createdAt: '2024-01-01T00:00:00Z',
  name: 'High Retention Template',
  description: 'A template with excellent retention metrics',
  image: 'https://example.com/image1.png',
  category: 'databases',
  tags: ['postgres', 'database'],
  languages: ['sql', 'javascript'],
  status: 'PUBLISHED',
  isApproved: true,
  isVerified: true,
  health: '95',
  projects: 100,
  activeProjects: 80, // 80% retention
  recentProjects: 20,
  totalPayout: 500000, // $5,000.00
};

/**
 * Template with low retention (30%)
 */
export const lowRetentionTemplate: Template = {
  id: 'template-low-retention',
  code: 'low-retention',
  createdAt: '2024-01-01T00:00:00Z',
  name: 'Low Retention Template',
  description: 'A template with poor retention metrics',
  image: 'https://example.com/image2.png',
  category: 'starter',
  tags: ['starter', 'basic'],
  languages: ['python'],
  status: 'PUBLISHED',
  isApproved: true,
  isVerified: false,
  health: '45',
  projects: 200,
  activeProjects: 60, // 30% retention
  recentProjects: 5,
  totalPayout: 150000, // $1,500.00
};

/**
 * Template with zero active projects (edge case for division by zero)
 */
export const zeroActiveTemplate: Template = {
  id: 'template-zero-active',
  code: 'zero-active',
  createdAt: '2024-01-01T00:00:00Z',
  name: 'Zero Active Template',
  description: 'A template with no active projects',
  image: 'https://example.com/image3.png',
  category: 'deprecated',
  tags: ['deprecated'],
  languages: [],
  status: 'ARCHIVED',
  isApproved: false,
  isVerified: false,
  health: '0',
  projects: 50,
  activeProjects: 0, // Test division by zero
  recentProjects: 0,
  totalPayout: 10000, // $100.00
};

/**
 * Template with zero total projects (edge case)
 */
export const zeroProjectsTemplate: Template = {
  id: 'template-zero-projects',
  code: 'zero-projects',
  createdAt: '2024-01-01T00:00:00Z',
  name: 'Zero Projects Template',
  description: 'A brand new template with no projects yet',
  image: 'https://example.com/image4.png',
  category: 'new',
  tags: ['new'],
  languages: ['typescript'],
  status: 'DRAFT',
  isApproved: false,
  isVerified: false,
  health: '100',
  projects: 0, // Test division by zero
  activeProjects: 0,
  recentProjects: 0,
  totalPayout: 0,
};

/**
 * Template with perfect metrics
 */
export const perfectTemplate: Template = {
  id: 'template-perfect',
  code: 'perfect',
  createdAt: '2024-01-01T00:00:00Z',
  name: 'Perfect Template',
  description: 'A template with ideal metrics',
  image: 'https://example.com/image5.png',
  category: 'featured',
  tags: ['featured', 'popular', 'recommended'],
  languages: ['typescript', 'react', 'tailwind'],
  status: 'PUBLISHED',
  isApproved: true,
  isVerified: true,
  health: '100',
  projects: 1000,
  activeProjects: 950, // 95% retention
  recentProjects: 100,
  totalPayout: 10000000, // $100,000.00
};

/**
 * Array of all sample templates
 */
export const sampleTemplates: Template[] = [
  highRetentionTemplate,
  lowRetentionTemplate,
  zeroActiveTemplate,
  zeroProjectsTemplate,
  perfectTemplate,
];

/**
 * Array with minimal templates for basic testing
 */
export const minimalTemplates: Template[] = [
  highRetentionTemplate,
  lowRetentionTemplate,
];
