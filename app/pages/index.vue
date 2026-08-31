<script setup lang="ts">
useHead({ title: 'FINAL FANTASY Draft Archetypes' });

const config = useRuntimeConfig();
const appVersion = config.public.appVersion;
const buildCommit = config.public.buildCommit;

interface Archetype {
  colors: string[];
  themes: string;
  art: string;
  name: string;
  blurb: string;
}

const ARCHETYPES: Archetype[] = [
  {
    colors: ['W', 'U'],
    themes: 'artifacts,equipment,treasure',
    art: 'https://cards.scryfall.io/art_crop/front/a/a/aa851d68-a7a4-48c0-9cd7-d3d2e079f3a1.jpg?1783906562',
    name: 'White–Blue Artifacts',
    blurb: 'Assemble a massive board of artifacts — artifact creatures, Equipment, Treasures, and more.',
  },
  {
    colors: ['U', 'B'],
    themes: 'graveyard,extra-turns,draw,discard',
    art: 'https://cards.scryfall.io/art_crop/front/5/7/572feb8c-6976-40a8-8a34-b4db836cca56.jpg?1783906565',
    name: 'Blue–Black Control',
    blurb: 'Grind out value from the graveyard, draw while discarding the spares, then close it out with extra turns.',
  },
  {
    colors: ['B', 'R'],
    themes: 'instant,sorcery,face-damage,wizard',
    art: 'https://cards.scryfall.io/art_crop/front/f/e/fe86e41b-b0f6-4aa1-8827-c095c721f304.jpg?1783906575',
    name: 'Black–Red Black Mage Aggro',
    blurb: "Cast noncreature spells straight at your opponent's face — Wizard tokens turn every spell into damage.",
  },
  {
    colors: ['R', 'G'],
    themes: 'landfall,land,saga',
    art: 'https://cards.scryfall.io/art_crop/front/9/9/99450143-6ab5-463d-9e04-e8e6703a8b92.jpg?1783906564',
    name: 'Red–Green Landfall Aggro',
    blurb: 'Turn every land drop into tide-turning territory with aggressive landfall triggers and Saga creatures.',
  },
  {
    colors: ['G', 'W'],
    themes: 'token,counters,creature',
    art: 'https://cards.scryfall.io/art_crop/front/b/8/b883df14-8d7b-4f6a-9a6a-2f71f5b6ddda.jpg?1783906571',
    name: 'Green–White Go Wide',
    blurb: 'Flood the board with creature tokens, then swing with all of them at once.',
  },
  {
    colors: ['W', 'B'],
    themes: 'sacrifice,token,lifegain',
    art: 'https://cards.scryfall.io/art_crop/front/f/5/f5fff00b-c9a0-4e90-abc0-349f8716c885.jpg?1783906564',
    name: 'White–Black Sacrifice',
    blurb: 'Convert your own permanents into a resource, then cash in the payoffs.',
  },
  {
    colors: ['U', 'R'],
    themes: 'instant,sorcery,tiered,flashback',
    art: 'https://cards.scryfall.io/art_crop/front/e/f/eff984b2-6ea9-4471-91c5-99c47f87f10b.jpg?1783906563',
    name: 'Blue–Red Big Noncreatures',
    blurb: 'Cast expensive, high-impact spells for maximum value, tiered magic and flashback included.',
  },
  {
    colors: ['B', 'G'],
    themes: 'graveyard,cast-from-graveyard,mill',
    art: 'https://cards.scryfall.io/art_crop/front/1/b/1b4bab87-4000-461d-8b58-d34928fee305.jpg?1783906576',
    name: 'Black–Green Graveyard Value',
    blurb: 'Stock the graveyard with permanents, then get more out of them dead than alive.',
  },
  {
    colors: ['R', 'W'],
    themes: 'equipment,job-select,hero',
    art: 'https://cards.scryfall.io/art_crop/front/e/4/e42c7d9d-8685-415b-8c5d-6ab2165863b9.jpg?1783906559',
    name: 'Red–White Equipment Aggro',
    blurb: 'Deck out your creatures with gear and lean on Job Select tokens for a steady stream of bodies to equip.',
  },
  {
    colors: ['G', 'U'],
    themes: 'towns,land,mana',
    art: 'https://cards.scryfall.io/art_crop/front/a/b/ab4f9721-5b2c-4371-98a5-3f6714265e57.jpg?1783906569',
    name: 'Green–Blue Town Ramp',
    blurb: 'Use Towns to squeeze extra value out of your lands while ramping into a powerful late game.',
  },
];

const PIP_COLOR: Record<string, string> = {
  W: '#f4eddc',
  U: '#0e68ab',
  B: '#4b4a4d',
  R: '#d3202a',
  G: '#00733e',
};
</script>

<template>
  <div class="min-h-full">
    <header class="mx-auto max-w-3xl px-6 pt-14 pb-6 text-center">
      <h1 class="text-3xl font-bold sm:text-4xl">FINAL FANTASY Draft Archetypes</h1>
      <p class="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
        Ten two-color strategies, straight from the
        <a
          class="text-text underline decoration-border hover:decoration-text"
          href="https://magic.wizards.com/en/news/feature/final-fantasy-prerelease-guide"
          target="_blank"
          rel="noopener"
          >official prerelease guide</a
        >. Pick the one that looks fun — it opens the card/theme graph pre-filtered to it.
      </p>
      <UButton to="/app" variant="link" color="neutral" trailing-icon="i-lucide-arrow-right" class="mt-5">
        Or explore the full graph
      </UButton>
    </header>

    <main class="mx-auto grid max-w-6xl gap-5 px-6 pb-10" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
      <NuxtLink
        v-for="a in ARCHETYPES"
        :key="a.name"
        :to="`/app?colors=${a.colors.join(',')}&themes=${a.themes}`"
        class="group relative block aspect-[5/4] overflow-hidden rounded-xl border border-border transition-[transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-focus"
      >
        <img :src="a.art" alt="" loading="lazy" class="absolute inset-0 size-full object-cover" />
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 via-45% to-black/5 to-75%"
        ></div>
        <div class="absolute inset-0 z-10 flex flex-col justify-end p-4">
          <div class="mb-2 flex gap-1.5">
            <span
              v-for="c in a.colors"
              :key="c"
              class="size-4 rounded-full border border-white/40"
              :style="{ background: PIP_COLOR[c] }"
            ></span>
          </div>
          <h2 class="mb-1.5 text-lg font-semibold text-white">{{ a.name }}</h2>
          <p class="text-[13px] leading-snug text-neutral-300">{{ a.blurb }}</p>
          <span class="mt-2.5 text-xs font-semibold text-white/85 group-hover:text-white">Explore &rarr;</span>
        </div>
      </NuxtLink>
    </main>

    <footer class="px-6 py-6 text-center text-[11px] text-muted">
      <div>Card art &copy; Wizards of the Coast / Square Enix, via Scryfall. Fan-made tool, not affiliated with either.</div>
      <div class="mt-1 text-[10px] opacity-70">v{{ appVersion }} · {{ buildCommit }}</div>
    </footer>
  </div>
</template>
