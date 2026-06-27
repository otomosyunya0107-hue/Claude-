/**
 * Template aggregation. Builds the ordered list of (relativePath -> content)
 * entries that make up a vault, applying placeholder substitution and honoring
 * the --no-claude-md / --no-setup-guide toggles.
 */
import type { TemplateEntry } from '../types.js';
import { actionsTemplate } from './actions.js';
import { claudeMdTemplate } from './claude-md.js';
import { clientTemplate } from './client.js';
import {
  libraryFaqTemplate,
  libraryFrameworksTemplate,
  libraryIndexTemplate,
  libraryPricingTemplate,
} from './library.js';
import {
  followupEmailTemplate,
  meetingMinutesTemplate,
  proposalTemplate,
} from './meeting-template.js';
import { memoryTemplate } from './memory.js';
import { setupMcpTemplate } from './setup-mcp.js';
import { transcriptTemplate } from './transcript.js';

export interface BuildTemplatesOptions {
  vaultName: string;
  claudeMd: boolean;
  setupGuide: boolean;
}

/** Replace `{{key}}` placeholders with the supplied values. */
function render(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key in vars ? vars[key] : match,
  );
}

/**
 * Produce the full ordered set of files for a vault. Order matches the
 * directory listing in the spec so log output reads top-to-bottom.
 */
export function buildTemplates(options: BuildTemplatesOptions): TemplateEntry[] {
  const { vaultName, claudeMd, setupGuide } = options;
  const vars = { vaultName };

  const entries: TemplateEntry[] = [
    { relativePath: '00_Memory.md', content: memoryTemplate },
    { relativePath: '10_Clients/_template.md', content: clientTemplate },
    { relativePath: '20_Actions.md', content: actionsTemplate },
    { relativePath: '30_Library/_index.md', content: libraryIndexTemplate },
    { relativePath: '30_Library/frameworks.md', content: libraryFrameworksTemplate },
    { relativePath: '30_Library/pricing.md', content: libraryPricingTemplate },
    { relativePath: '30_Library/faq.md', content: libraryFaqTemplate },
    { relativePath: '40_Templates/meeting-minutes.md', content: meetingMinutesTemplate },
    { relativePath: '40_Templates/proposal.md', content: proposalTemplate },
    { relativePath: '40_Templates/followup-email.md', content: followupEmailTemplate },
    { relativePath: '50_Transcripts/_template.md', content: transcriptTemplate },
  ];

  if (claudeMd) {
    entries.push({ relativePath: 'CLAUDE.md', content: claudeMdTemplate });
  }
  if (setupGuide) {
    entries.push({ relativePath: 'SETUP_MCP.md', content: setupMcpTemplate });
  }

  return entries.map((entry) => ({
    relativePath: entry.relativePath,
    content: render(entry.content, vars),
  }));
}
