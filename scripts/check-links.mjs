import { promises as fs } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const pagesRoot = path.join(projectRoot, "src", "pages");
const contentPagesRoot = path.join(projectRoot, "src", "content", "pages");
const menuPath = path.join(projectRoot, "src", "config", "menu.json");

const assetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".pdf",
  ".zip",
  ".mp4",
  ".mp3",
  ".wav",
]);

const publicRoot = path.join(projectRoot, "public");

const normalizePath = (value) => {
  if (!value) return null;
  const [pathOnly] = value.split(/[?#]/);
  if (!pathOnly) return null;
  if (pathOnly === "/") return "/";
  const trimmed = pathOnly.replace(/\/+$/, "");
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const isInternalLink = (value) => {
  if (!value) return false;
  if (value.startsWith("mailto:") || value.startsWith("tel:")) return false;
  if (value.startsWith("#")) return false;
  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);
    if (["opennorthwest.org", "www.opennorthwest.org"].includes(url.hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
};

const extractInternalPath = (value) => {
  if (value.startsWith("/")) {
    return normalizePath(value);
  }

  try {
    const url = new URL(value);
    if (["opennorthwest.org", "www.opennorthwest.org"].includes(url.hostname)) {
      return normalizePath(url.pathname);
    }
  } catch {
    return null;
  }

  return null;
};

const isAssetLink = (value) => {
  const normalized = extractInternalPath(value);
  if (!normalized) return false;
  if (normalized.startsWith("/images/")) return true;
  const ext = path.extname(normalized).toLowerCase();
  return assetExtensions.has(ext);
};

const resolveAssetPath = (link, sourceFile) => {
  if (!link) return null;
  if (link.startsWith("/")) {
    const normalized = normalizePath(link);
    if (!normalized) return null;
    return path.join(publicRoot, normalized);
  }

  try {
    const url = new URL(link);
    if (["opennorthwest.org", "www.opennorthwest.org"].includes(url.hostname)) {
      return path.join(publicRoot, normalizePath(url.pathname));
    }
  } catch {
    if (sourceFile) {
      return path.resolve(path.dirname(sourceFile), link.split(/[?#]/)[0]);
    }
  }

  return null;
};

const listFiles = async (dir, extensions) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, extensions)));
    } else if (extensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
};

const getValidRoutes = async () => {
  const routes = new Set(["/"]);

  const pageFiles = await listFiles(pagesRoot, [".astro"]);
  for (const file of pageFiles) {
    const rel = path.relative(pagesRoot, file);
    const parts = rel.split(path.sep);
    const hasDynamic = parts.some((part) => part.includes("["));
    if (hasDynamic) continue;

    const parsed = path.parse(rel);
    if (parsed.name === "index") {
      const dir = parsed.dir ? `/${parsed.dir}` : "/";
      routes.add(normalizePath(dir));
    } else {
      routes.add(normalizePath(`/${parsed.dir ? `${parsed.dir}/` : ""}${parsed.name}`));
    }
  }

  const contentFiles = await listFiles(contentPagesRoot, [".md", ".mdx"]);
  for (const file of contentFiles) {
    const rel = path.relative(contentPagesRoot, file);
    const parsed = path.parse(rel);
    const slug = parsed.name === "index" && parsed.dir ? parsed.dir : parsed.name === "index" ? "" : path.join(parsed.dir, parsed.name);
    routes.add(normalizePath(`/${slug}`));
  }

  return routes;
};

const extractLinksFromText = (text) => {
  const links = [];
  const markdownLinkRegex = /\[[^\]]*\]\(([^)]+)\)/g;
  const htmlHrefRegex = /href\s*=\s*["']([^"']+)["']/g;

  let match;
  while ((match = markdownLinkRegex.exec(text))) {
    const raw = match[1].trim();
    const url = raw.split(/\s+/)[0];
    links.push(url);
  }

  while ((match = htmlHrefRegex.exec(text))) {
    links.push(match[1].trim());
  }

  return links;
};

const extractLinksFromMenu = async () => {
  const raw = await fs.readFile(menuPath, "utf-8");
  const data = JSON.parse(raw);
  const links = [];

  const collect = (items) => {
    for (const item of items || []) {
      if (item.url) links.push(item.url);
      if (item.menu) collect(item.menu);
      if (item.children) collect(item.children);
    }
  };

  collect(data.main);
  collect(data.footer);
  return links;
};

const main = async () => {
  const validRoutes = await getValidRoutes();
  const sources = [];

  const markdownFiles = await listFiles(contentPagesRoot, [".md", ".mdx"]);
  for (const file of markdownFiles) {
    const text = await fs.readFile(file, "utf-8");
    sources.push({ file, links: extractLinksFromText(text) });
  }

  const astroFiles = await listFiles(path.join(projectRoot, "src", "pages"), [".astro"]);
  for (const file of astroFiles) {
    const text = await fs.readFile(file, "utf-8");
    sources.push({ file, links: extractLinksFromText(text) });
  }

  sources.push({ file: menuPath, links: await extractLinksFromMenu() });

  const failures = [];
  const assetFailures = [];

  for (const source of sources) {
    for (const link of source.links) {
      if (!isInternalLink(link)) continue;
      if (isAssetLink(link)) {
        const assetPath = resolveAssetPath(link, source.file);
        if (!assetPath) continue;
        try {
          await fs.access(assetPath);
        } catch {
          assetFailures.push({ link, file: source.file });
        }
        continue;
      }

      const normalized = extractInternalPath(link);
      if (!normalized) continue;

      if (!validRoutes.has(normalized)) {
        failures.push({ link, file: source.file });
      }
    }
  }

  if (failures.length || assetFailures.length) {
    if (failures.length) {
      console.error("Broken internal links detected:\n");
      for (const failure of failures) {
        const rel = path.relative(projectRoot, failure.file);
        console.error(`- ${failure.link} (from ${rel})`);
      }
      console.error("");
    }

    if (assetFailures.length) {
      console.error("Missing internal asset files detected:\n");
      for (const failure of assetFailures) {
        const rel = path.relative(projectRoot, failure.file);
        console.error(`- ${failure.link} (from ${rel})`);
      }
      console.error("");
    }

    process.exit(1);
  }

  console.log("All internal links resolve to existing routes and assets.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
