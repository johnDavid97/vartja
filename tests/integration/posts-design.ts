// Browser regression for the posts redesign. Fixtures exist only in the disposable DB.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, type Browser, type Locator, type Page } from "@playwright/test";
import { getPayload } from "payload";
import sharp from "sharp";
import config from "../../payload.config";
import type { Post } from "../../payload-types";
import { createAuthenticatedGuest } from "./authenticated-guest";
import { weddingPath } from "../../features/wedding-site/paths";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
assert(["localhost", "127.0.0.1"].includes(databaseUrl.hostname), "Local databases only");
assert(
  /^\/sammen_posts_design_test_\d+_[a-f0-9]+$/.test(databaseUrl.pathname),
  "Disposable posts-design database only",
);
const baseURL = process.env.TEST_BASE_URL || "http://localhost:3111";
assert(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Local test server only");

const payload = await getPayload({ config });
const createdPostIds: number[] = [];
let mediaId: number | undefined;
let userId: number | undefined;
let guestCleanup: (() => Promise<void>) | undefined;
let browser: Browser | undefined;
let exitCode = 0;

type ListedPost = { id: number; title: string; publishedAt: string };

const textNode = (text: string) => ({
  type: "text" as const,
  version: 1,
  text,
  format: 0,
  detail: 0,
  mode: "normal" as const,
  style: "",
});

function authoredBody(image: number): NonNullable<Post["body"]> {
  const paragraph = (text: string) => ({
    type: "paragraph" as const,
    version: 1,
    direction: null,
    format: "" as const,
    indent: 0,
    textFormat: 0,
    textStyle: "",
    children: [textNode(text)],
  });
  const upload = (id: string) => ({
    type: "upload" as const,
    version: 3,
    format: "" as const,
    id,
    relationTo: "media" as const,
    value: image,
    fields: { caption: "Et bevisst gjentatt bilde" },
  });
  return {
    root: {
      type: "root",
      version: 1,
      direction: null,
      format: "",
      indent: 0,
      children: [
        paragraph("<script>posts-design-owned = true</script> & dette er bare tekst"),
        paragraph("Dette avsnittet skal med to ganger."),
        paragraph("Dette avsnittet skal med to ganger."),
        {
          type: "list", version: 1, listType: "bullet", tag: "ul", start: 1,
          format: "", direction: null, indent: 0,
          children: [{
            type: "listitem", version: 1, value: 1, format: "", direction: null, indent: 0,
            children: [textNode("Ytre listepunkt"), {
              type: "list", version: 1, listType: "bullet", tag: "ul", start: 1,
              format: "", direction: null, indent: 1,
              children: [{ type: "listitem", version: 1, value: 1, format: "", direction: null, indent: 1, children: [textNode("Indre listepunkt")] }],
            }],
          }],
        },
        upload(randomUUID()),
        upload(randomUUID()),
        {
          type: "block",
          version: 2,
          format: "",
          fields: {
            id: "reiseavstemning",
            question: "Tar du bussen til festen?",
            open: true,
            options: [
              { id: "yes", label: "Ja" },
              { id: "no", label: "Nei" },
            ],
            blockType: "poll",
          },
        },
      ],
    },
  } as NonNullable<Post["body"]>;
}

async function contentFingerprint(): Promise<string> {
  const [posts, versions] = await Promise.all([
    payload.find({
      collection: "posts",
      overrideAccess: true,
      draft: true,
      pagination: false,
      depth: 0,
      sort: "id",
      context: { skipLegacyBodyConversion: true },
    }),
    payload.findVersions({
      collection: "posts",
      overrideAccess: true,
      pagination: false,
      depth: 0,
      sort: "id",
      context: { skipLegacyBodyConversion: true },
    }),
  ]);
  return createHash("sha256")
    .update(JSON.stringify({ posts: posts.docs, versions: versions.docs }))
    .digest("hex");
}

async function cardHrefs(cards: Locator): Promise<string[]> {
  const linkSelector = `a[href^="${weddingPath("/news/")}"]`;
  return cards.evaluateAll((articles, selector) => articles.map((article) => {
    const link = article.querySelector<HTMLAnchorElement>(selector);
    if (!link) throw new Error("Every post card must link to its article");
    return new URL(link.href).pathname;
  }), linkSelector);
}

async function assertNoHorizontalOverflow(page: Page, width: number): Promise<void> {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const main = await page.getByRole("main").boundingBox();
  assert(main && main.x >= -1 && main.x + main.width <= width + 1, `Main content must fit at ${width}px`);
}

async function assertOverviewColumns(cards: Locator, width: number): Promise<void> {
  const boxes = await Promise.all([0, 1, 2, 3].map((index) => cards.nth(index).boundingBox()));
  assert(boxes.every(Boolean), `Overview cards must be measurable at ${width}px`);
  const [first, second, third, fourth] = boxes as NonNullable<(typeof boxes)[number]>[];
  if (width === 1440) {
    assert(Math.abs(first.y - second.y) < 3 && Math.abs(second.y - third.y) < 3, "Desktop overview must have three cards per row");
    assert(new Set([Math.round(first.x), Math.round(second.x), Math.round(third.x)]).size === 3, "Desktop columns must be distinct");
    assert(fourth.y > first.y + first.height / 2, "The fourth desktop card must start a new row");
  }
  if (width <= 390) {
    assert(Math.abs(first.x - second.x) < 3, "Mobile overview cards must use one column");
    assert(second.y > first.y + first.height / 2 && third.y > second.y + second.height / 2, "Mobile cards must stack vertically");
  }
}

try {
  await payload.updateGlobal({
    slug: "wedding",
    data: {
      coupleNames: "Testparet & Venner",
      weddingDate: "2028-08-02T12:00:00Z",
      venue: "Teststed",
      welcomeMessage: "",
      heroEyebrow: "Vi gifter oss",
      heroTitleSuffix: "sitt bryllup",
      heroBackgroundMode: "color",
      heroBackgroundColor: "#3c4641",
    },
  });

  const email = `posts-design-${randomBytes(8).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("hex");
  const administrator = await payload.create({
    collection: "users",
    data: { name: "Innleggsredaktør", email, password },
  });
  userId = administrator.id;

  browser = await chromium.launch();
  const guestContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    reducedMotion: "reduce",
  });
  const adminContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, locale: "nb-NO" });
  const anonymousContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, locale: "nb-NO" });
  assert((await adminContext.request.post("/api/users/login", { data: { email, password } })).ok(), "Native admin login failed");
  guestCleanup = (await createAuthenticatedGuest({ payload, context: guestContext, administratorId: administrator.id, baseURL })).cleanup;

  const guestPage = await guestContext.newPage();
  const adminPage = await adminContext.newPage();
  const anonymousPage = await anonymousContext.newPage();
  const pageErrors: string[] = [];
  for (const page of [guestPage, adminPage, anonymousPage]) {
    page.on("pageerror", (error) => pageErrors.push(error.message));
  }

  // Empty overview and anonymous redirect are checked before any post fixture exists.
  await guestPage.goto(weddingPath("/news"));
  await expect(guestPage.getByRole("heading", { level: 1, name: "Innlegg", exact: true })).toBeVisible();
  await expect(guestPage.getByRole("heading", { name: "Snart kommer det nytt fra oss", exact: true })).toBeVisible();
  await expect(guestPage.getByRole("main").locator("article")).toHaveCount(0);
  await anonymousPage.goto(weddingPath("/news"));
  await expect(anonymousPage).toHaveURL(/\/andrea-og-martin\/login(?:\?|$)/);

  const errorsBeforeInvalidArticles = pageErrors.length;
  for (const invalidId of ["0", "2147483648", "9007199254740992", "non-numeric"]) {
    await guestPage.goto(weddingPath(`/news/${invalidId}`));
    await expect(guestPage.getByRole("heading", { level: 1, name: "Fant ikke innlegget", exact: true })).toBeVisible();
  }
  assert.deepEqual(pageErrors.slice(errorsBeforeInvalidArticles), [], "Invalid article IDs must not cause browser errors");

  const imageBuffer = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#71897d" },
  }).png().toBuffer();
  const media = await payload.create({
    collection: "media",
    data: { alt: "Grønt testbilde fra bryllupshelgen", focalX: 17, focalY: 73 },
    file: {
      data: imageBuffer,
      name: `posts-design-${Date.now()}-${randomBytes(3).toString("hex")}.png`,
      mimetype: "image/png",
      size: imageBuffer.length,
    },
  });
  mediaId = media.id;

  const authoredTitle = "Reiseplan <og> en svært lang overskrift som fortsatt skal brytes trygt på små skjermer";
  const authoredDescription = "Dette er den ekte ingressen & ikke en ekstra kopi av brødteksten.";
  const authored = await payload.create({
    collection: "posts",
    data: {
      title: authoredTitle,
      description: authoredDescription,
      theme: "Reise & transport",
      photo: media.id,
      body: authoredBody(media.id),
      publishedAt: "2028-01-12T12:00:00.000Z",
      visibility: "public",
      _status: "published",
    },
  });
  createdPostIds.push(authored.id);

  // A lone article has no fabricated related content, while shared poll/comments still mount.
  await guestPage.goto(weddingPath(`/news/${authored.id}`));
  await expect(guestPage.getByRole("heading", { level: 1, name: authoredTitle, exact: true })).toBeVisible();
  await expect(guestPage.getByRole("heading", { name: "Flere innlegg", exact: true })).toHaveCount(0);
  await expect(guestPage.getByRole("region", { name: "Tar du bussen til festen?", exact: true })).toBeVisible();
  await expect(guestPage.getByRole("region", { name: "Kommentarer", exact: true })).toBeVisible();
  await anonymousPage.goto(weddingPath(`/news/${authored.id}`));
  await expect(anonymousPage).toHaveURL(/\/andrea-og-martin\/login(?:\?|$)/);

  const listed: ListedPost[] = [{ id: authored.id, title: authored.title, publishedAt: authored.publishedAt! }];
  const publicFixtures = [
    ["Praktisk fire", "2028-01-04T12:00:00.000Z"],
    ["Lik dato – opprettet først", "2028-01-11T12:00:00.000Z"],
    ["Tidlig informasjon", "2028-01-02T12:00:00.000Z"],
    ["Meny og allergier", "2028-01-10T12:00:00.000Z"],
    ["Overnatting", "2028-01-06T12:00:00.000Z"],
    ["Lik dato – høyere id", "2028-01-11T12:00:00.000Z"],
    ["Dette er et ekstraordinært langt kort uten forsidebilde som må brytes uten å gjøre rutenettet bredere enn skjermen", "2028-01-09T12:00:00.000Z"],
    ["Antrekk", "2028-01-03T12:00:00.000Z"],
    ["Ønskeliste", "2028-01-08T12:00:00.000Z"],
    ["Dagen derpå", "2028-01-07T12:00:00.000Z"],
  ] as const;
  for (const [title, publishedAt] of publicFixtures) {
    const post = await payload.create({
      collection: "posts",
      data: { title, description: `Kort beskrivelse for ${title}.`, publishedAt, visibility: "public", _status: "published" },
    });
    createdPostIds.push(post.id);
    listed.push({ id: post.id, title: post.title, publishedAt: post.publishedAt! });
  }

  const legacyDescription = "Legacy-ingressen skal vises nøyaktig én gang.";
  const legacy = await payload.create({
    collection: "posts",
    data: {
      title: "Eldre innlegg uten brødtekst",
      description: legacyDescription,
      theme: "Historikk",
      photo: media.id,
      body: null,
      publishedAt: "2028-01-05T12:00:00.000Z",
      visibility: "public",
      _status: "published",
    },
  });
  createdPostIds.push(legacy.id);
  listed.push({ id: legacy.id, title: legacy.title, publishedAt: legacy.publishedAt! });

  const privatePost = await payload.create({
    collection: "posts",
    data: {
      title: "Nyeste private plan",
      description: "Må aldri vises for gjester eller i artikkelvisningen.",
      publishedAt: "2028-01-15T12:00:00.000Z",
      visibility: "private",
      _status: "published",
    },
  });
  createdPostIds.push(privatePost.id);
  const draftPost = await payload.create({
    collection: "posts",
    draft: true,
    data: {
      title: "Nyeste upubliserte utkast",
      description: "Må aldri vises for gjester eller i artikkelvisningen.",
      publishedAt: "2028-01-16T12:00:00.000Z",
      visibility: "public",
      _status: "draft",
    },
  });
  createdPostIds.push(draftPost.id);

  const unpublishedRevisionTitle = "Upublisert endring av reiseplanen";
  const unpublishedRevisionDescription = "Denne ingressen finnes bare i det nyere utkastet.";
  const unpublishedRevisionDate = "2030-12-24T12:00:00.000Z";
  await payload.update({
    collection: "posts",
    id: authored.id,
    draft: true,
    data: {
      title: unpublishedRevisionTitle,
      description: unpublishedRevisionDescription,
      photo: null,
      publishedAt: unpublishedRevisionDate,
      _status: "draft",
    },
  });

  const expected = [...listed].sort((left, right) => {
    const dateDifference = Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
    return dateDifference || right.id - left.id;
  });
  assert.equal(expected.length, 12);
  assert.equal(expected[1].title, "Lik dato – høyere id", "Tie fixture must exercise descending id");
  assert.equal(expected[2].title, "Lik dato – opprettet først", "Tie fixture must exercise descending id");

  // Ordinary API reads retain the legacy editor adapter; the article query alone requests raw null body.
  for (const context of [guestContext, adminContext]) {
    const response = await context.request.get(`/api/posts/${legacy.id}`);
    assert(response.ok(), `Legacy API read failed with ${response.status()}`);
    const document = await response.json();
    assert(document.body?.root?.children?.length > 0, "Ordinary API legacy conversion must remain enabled");
    assert(JSON.stringify(document.body).includes(legacyDescription), "Synthesized API body must contain the legacy description");
  }

  const repeatedCoverPost = listed.find((post) => post.title === "Overnatting")!;
  const repeatedCoverBody = authoredBody(media.id);
  repeatedCoverBody.root.children.unshift({
    type: "upload", version: 3, format: "", id: randomUUID(),
    relationTo: "media", value: media.id, fields: { caption: "" },
  });
  await payload.update({ collection: "posts", id: repeatedCoverPost.id, data: {
    photo: media.id, body: repeatedCoverBody, _status: "published",
  } });

  const fingerprintBeforeReads = await contentFingerprint();

  await guestPage.goto(weddingPath("/news"));
  const overviewCards = guestPage.getByRole("main").locator("article");
  await expect(overviewCards).toHaveCount(9);
  assert.deepEqual(await cardHrefs(overviewCards), expected.slice(0, 9).map(({ id }) => weddingPath(`/news/${id}`)));
  await expect(guestPage.getByText(privatePost.title, { exact: true })).toHaveCount(0);
  await expect(guestPage.getByText(draftPost.title, { exact: true })).toHaveCount(0);
  await expect(guestPage.getByText(unpublishedRevisionTitle, { exact: true })).toHaveCount(0);
  await expect(guestPage.getByText(unpublishedRevisionDescription, { exact: true })).toHaveCount(0);
  const authoredOverviewCard = overviewCards.filter({ has: guestPage.locator(`a[href="${weddingPath(`/news/${authored.id}`)}"]`) });
  await expect(authoredOverviewCard).toHaveCount(1);
  await expect(authoredOverviewCard.getByRole("heading", { name: authoredTitle, exact: true })).toBeVisible();
  await expect(authoredOverviewCard.getByText(authoredDescription, { exact: true })).toBeVisible();
  await expect(authoredOverviewCard.getByRole("img", { name: media.alt, exact: true })).toHaveCount(1);
  await expect(guestPage.getByRole("navigation", { name: "Innleggssider", exact: true })).toContainText("Side 1 av 2");
  await expect(guestPage.getByRole("link", { name: "Neste", exact: true })).toHaveAttribute("href", `${weddingPath("/news")}?page=2`);

  const noCoverCard = overviewCards.filter({ hasText: publicFixtures[6][0] });
  await expect(noCoverCard).toHaveCount(1);
  await expect(noCoverCard.getByRole("img")).toHaveCount(0);

  await guestPage.getByRole("link", { name: "Neste", exact: true }).click();
  await expect(guestPage).toHaveURL(/\/andrea-og-martin\/news\?page=2$/);
  const pageTwoCards = guestPage.getByRole("main").locator("article");
  await expect(pageTwoCards).toHaveCount(3);
  assert.deepEqual(await cardHrefs(pageTwoCards), expected.slice(9).map(({ id }) => weddingPath(`/news/${id}`)));
  await expect(guestPage.getByRole("link", { name: "Forrige", exact: true })).toHaveAttribute("href", `${weddingPath("/news")}?page=1`);

  // Native administrators see the same guest-visible overview and cannot bypass article boundaries.
  await adminPage.goto(weddingPath("/news"));
  const adminCards = adminPage.getByRole("main").locator("article");
  await expect(adminCards).toHaveCount(9);
  assert.deepEqual(await cardHrefs(adminCards), expected.slice(0, 9).map(({ id }) => weddingPath(`/news/${id}`)));
  await adminPage.goto(weddingPath(`/news/${authored.id}`));
  const administratorArticle = adminPage.getByRole("article", { name: authoredTitle, exact: true });
  await expect(administratorArticle.getByText(authoredDescription, { exact: true })).toHaveCount(1);
  await expect(administratorArticle.getByRole("img", { name: media.alt, exact: true })).toHaveCount(3);
  await expect(adminPage.getByText(unpublishedRevisionTitle, { exact: true })).toHaveCount(0);
  await expect(adminPage.getByText(unpublishedRevisionDescription, { exact: true })).toHaveCount(0);
  for (const hidden of [privatePost, draftPost]) {
    for (const page of [guestPage, adminPage]) {
      await page.goto(weddingPath(`/news/${hidden.id}`));
      await expect(page.getByRole("heading", { level: 1, name: "Fant ikke innlegget", exact: true })).toBeVisible();
      await expect(page.getByText(hidden.title, { exact: true })).toHaveCount(0);
    }
  }

  await guestPage.goto(weddingPath(`/news/${authored.id}`));
  const authoredArticle = guestPage.getByRole("article", { name: authoredTitle });
  await expect(authoredArticle).toBeVisible();
  await expect(authoredArticle.getByText(authoredDescription, { exact: true })).toHaveCount(1);
  await expect(authoredArticle.getByText(unpublishedRevisionTitle, { exact: true })).toHaveCount(0);
  await expect(authoredArticle.getByText(unpublishedRevisionDescription, { exact: true })).toHaveCount(0);
  await expect(authoredArticle.locator("time")).toHaveAttribute("datetime", authored.publishedAt!);
  await expect(authoredArticle.locator(`time[datetime="${unpublishedRevisionDate}"]`)).toHaveCount(0);
  await expect(authoredArticle.getByText("Dette avsnittet skal med to ganger.", { exact: true })).toHaveCount(2);
  await expect(authoredArticle.getByText("<script>posts-design-owned = true</script> & dette er bare tekst", { exact: true })).toHaveCount(1);
  await expect(authoredArticle.locator("script")).toHaveCount(0);
  await expect(authoredArticle.getByRole("img", { name: media.alt, exact: true })).toHaveCount(3);
  await expect(authoredArticle.getByText("Et bevisst gjentatt bilde", { exact: true })).toHaveCount(2);
  await expect(authoredArticle.getByRole("region", { name: "Tar du bussen til festen?", exact: true })).toBeVisible();
  await expect(authoredArticle.getByRole("region", { name: "Artikkelinnhold", exact: true }).locator("ul ul")).toHaveCSS("list-style-type", "disc");
  await expect(authoredArticle.getByRole("region", { name: "Kommentarer", exact: true })).toBeVisible();

  const related = guestPage.getByRole("region", { name: "Flere innlegg", exact: true });
  await expect(related).toBeVisible();
  const relatedCards = related.locator("article");
  await expect(relatedCards).toHaveCount(3);
  const expectedRelated = expected.filter(({ id }) => id !== authored.id).slice(0, 3);
  assert.deepEqual(await cardHrefs(relatedCards), expectedRelated.map(({ id }) => weddingPath(`/news/${id}`)));
  assert(!expectedRelated.some(({ id }) => id === privatePost.id || id === draftPost.id));
  await expect(related.getByText(authoredTitle, { exact: true })).toHaveCount(0);
  await expect(related.getByText(unpublishedRevisionTitle, { exact: true })).toHaveCount(0);
  await expect(related.getByText(unpublishedRevisionDescription, { exact: true })).toHaveCount(0);

  const footer = guestPage.getByRole("contentinfo");
  await expect(footer).toContainText("Testparet & Venner");
  await expect(footer).toContainText("2. august 2028");

  await guestPage.goto(weddingPath(`/news/${expected[1].id}`));
  const authoredRelatedCard = guestPage
    .getByRole("region", { name: "Flere innlegg", exact: true })
    .locator("article")
    .filter({ has: guestPage.locator(`a[href="${weddingPath(`/news/${authored.id}`)}"]`) });
  await expect(authoredRelatedCard).toHaveCount(1);
  await expect(authoredRelatedCard.getByRole("heading", { name: authoredTitle, exact: true })).toBeVisible();
  await expect(authoredRelatedCard.getByText(authoredDescription, { exact: true })).toBeVisible();
  await expect(authoredRelatedCard.getByRole("img", { name: media.alt, exact: true })).toHaveCount(1);
  await expect(guestPage.getByText(unpublishedRevisionTitle, { exact: true })).toHaveCount(0);
  await expect(guestPage.getByText(unpublishedRevisionDescription, { exact: true })).toHaveCount(0);

  await guestPage.goto(weddingPath(`/news/${legacy.id}`));
  const legacyArticle = guestPage.getByRole("article", { name: legacy.title });
  await expect(legacyArticle.getByText(legacyDescription, { exact: true })).toHaveCount(1);
  await expect(legacyArticle.getByRole("img", { name: media.alt, exact: true })).toHaveCount(1);
  await expect(legacyArticle.getByRole("img", { name: media.alt, exact: true })).toHaveCSS("object-position", "17% 73%");
  await expect(legacyArticle.getByRole("region", { name: "Artikkelinnhold", exact: true })).toHaveCount(0);

  await guestPage.goto(weddingPath(`/news/${repeatedCoverPost.id}`));
  const repeatedCoverArticle = guestPage.getByRole("article", { name: repeatedCoverPost.title, exact: true });
  // One header cover + two intentionally captioned body images; no extra leading duplicate.
  await expect(repeatedCoverArticle.getByRole("img", { name: media.alt, exact: true })).toHaveCount(3);
  await expect(repeatedCoverArticle.getByText("Et bevisst gjentatt bilde", { exact: true })).toHaveCount(2);
  const unchangedBody = await payload.findByID({ collection: "posts", id: repeatedCoverPost.id, depth: 0, context: { skipLegacyBodyConversion: true } });
  assert.equal(unchangedBody.body?.root.children[0].type, "upload", "Display suppression must not delete the saved leading image");

  // Capture both redesigned surfaces at the agreed breakpoints without asserting generated classes.
  for (const width of [320, 390, 768, 1440]) {
    const height = width <= 390 ? 844 : 1000;
    await guestPage.setViewportSize({ width, height });
    await guestPage.goto(weddingPath("/news"));
    const cards = guestPage.getByRole("main").locator("article");
    await expect(cards).toHaveCount(9);
    await assertNoHorizontalOverflow(guestPage, width);
    await assertOverviewColumns(cards, width);
    await guestPage.screenshot({ path: `/tmp/sammen-posts-design-overview-${width}.png`, fullPage: true });

    await guestPage.goto(weddingPath(`/news/${authored.id}`));
    await expect(guestPage.getByRole("region", { name: "Flere innlegg", exact: true }).locator("article")).toHaveCount(3);
    await assertNoHorizontalOverflow(guestPage, width);
    await guestPage.screenshot({ path: `/tmp/sammen-posts-design-article-${width}.png`, fullPage: true });
  }

  assert.equal(await contentFingerprint(), fingerprintBeforeReads, "Rendering posts must not rewrite content or versions");
  assert.deepEqual(pageErrors, []);
  console.log("PASS: posts overview/article redesign, empty and related states, publication ordering/ties, published-vs-draft revisions, invalid IDs, nine-item pagination, guest/admin privacy, raw legacy rendering, authored repetition, poll/comments mounting, configured footer and responsive 320–1440 layouts.");
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  await browser?.close();
  for (const id of createdPostIds.reverse()) {
    await payload.delete({ collection: "posts", id, overrideAccess: true }).catch(() => undefined);
  }
  await guestCleanup?.().catch(() => undefined);
  if (userId) await payload.delete({ collection: "users", id: userId, overrideAccess: true }).catch(() => undefined);
  if (mediaId) await payload.delete({ collection: "media", id: mediaId, overrideAccess: true }).catch(() => undefined);
  await payload.destroy();
}
process.exit(exitCode);
