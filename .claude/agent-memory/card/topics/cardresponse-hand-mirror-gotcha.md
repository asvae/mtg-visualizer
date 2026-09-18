# `app/lib/cardResponse.ts` is a hand-mirrored copy, not an import

`app/lib/cardResponse.ts`'s `CardResponse` type (and its nested
`FunctionalModelData`) is a **separate, hand-kept duplicate** of the real
server-side type in `server/api/card/[set]/[number].ts` — it does NOT
import it. This has caused real, silent gaps more than once: fields added
to the server route's `FunctionalModelData` (`reviewCaveat`, `cardStatus`,
FDN's `oracleText`/`sinkAttachment`/`sinkAttachmentStatus`, etc.) have been
forgotten on this client-side mirror, and `npm run typecheck` does **not**
reliably catch the omission on its own (a `.vue` file reading an
undeclared-but-actually-present field from a loosely-typed fetch result
doesn't always surface as an error).

**Whenever a task adds/changes a field on the server route's
`FunctionalModelData`, update `app/lib/cardResponse.ts`'s mirror in the
same change** — don't rely on typecheck to catch a missed one; grep/read
both files side by side instead.
