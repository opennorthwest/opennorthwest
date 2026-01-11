import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const homepageFields = {
  hero: z
    .object({
      title: z.string(),
      subtitle: z.string().optional(),
      image: z.string().optional(),
      ctas: z
        .array(
          z.object({
            label: z.string(),
            link: z.string(),
            target: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  who_we_are: z
    .object({
      title: z.string(),
      content: z.array(z.string()),
      ctas: z
        .array(
          z.object({
            label: z.string(),
            link: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  badge: z
    .object({
      link: z.string(),
      image: z.string(),
      alt: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional(),
};


// Pages collection schema
const pagesCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
    ...homepageFields,
  }),
});

// Export collections
export const collections = {
  pages: pagesCollection,
};
