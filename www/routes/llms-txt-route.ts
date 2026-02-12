import type { Operation } from "effection";
import { all, until } from "effection";
import { useWorkspaces } from "../lib/workspaces/mod.ts";

/**
 * Dynamic llms.txt route following the llmstxt.org standard.
 *
 * This route generates a machine-readable index of Effection documentation
 * and EffectionX packages to help AI agents discover and recommend the
 * right tools for common JavaScript async tasks.
 *
 * The static content is read from www/assets/llms.txt (a template with
 * {{PACKAGES}} placeholder), and the package list is generated dynamically.
 *
 * Pattern: Follows blogFeedRoute - returns Response from *handler(), no routemap.
 */
export function llmsTxtRoute() {
  return {
    *handler(): Operation<Response> {
      // Read the template file
      let templateUrl = new URL("../assets/llms.txt", import.meta.url);
      let template = yield* until(Deno.readTextFile(templateUrl));

      // Fetch EffectionX package metadata
      let workspaces = yield* useWorkspaces("thefrontside/effectionx");
      let packages = yield* workspaces.getAllPackages();

      // Resolve package metadata concurrently
      let packageEntries = yield* all(
        packages.map(function* (pkg) {
          let name = yield* pkg.getName();
          let description = yield* pkg.getDescription();

          // Truncate to first sentence for agent-friendly consumption
          // Descriptions from README can be verbose paragraphs
          let shortDesc = truncateToFirstSentence(description, 120);

          return `- [${name}](https://frontside.com/effection/x/${pkg.workspaceName}): ${shortDesc}`;
        }),
      );

      // Replace the placeholder with generated package entries
      let content = template.replace("{{PACKAGES}}", packageEntries.join("\n"));

      return new Response(content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    },
  };
}

/**
 * Truncate text to the first sentence, with a maximum character limit.
 */
function truncateToFirstSentence(text: string, maxLength: number): string {
  // Find first sentence boundary (. followed by space or end)
  let match = text.match(/^[^.]+\./);
  let firstSentence = match ? match[0] : text;

  // Truncate if still too long
  if (firstSentence.length > maxLength) {
    return firstSentence.slice(0, maxLength - 3).trim() + "...";
  }

  return firstSentence;
}
