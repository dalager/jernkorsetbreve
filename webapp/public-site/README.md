This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Static Site Generation

This site is configured to use [Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/building-your-application/rendering/incremental-static-regeneration) for the letter pages (`/letters/[id]`).

### Key Static Generation Features

- **Dynamic Routes**: The `/letters/[id]` route is statically generated at build time
- **Data Fetching**: Attempts to fetch from the API with a fallback to mock data
- **ISR Configuration**: Pages are set to revalidate every hour (3600 seconds)
- **Static Paths**: All letter IDs are pre-rendered at build time via `generateStaticParams()`

### Resolving Build Errors

If you encounter the error:

```
Route /letters/[id] with `dynamic = "error"` couldn't be rendered statically because it used `revalidate: 0 fetch http://localhost:8000/letters/557 /letters/[id]
```

This occurs due to conflicting caching strategies. Here are two ways to fix it:

#### Option 1: Fully Dynamic Page (no static generation)

```typescript
// Add this export at the top of your /letters/[id]/page.tsx file:
export const dynamic = "force-dynamic";

// Remove or comment out:
// export const revalidate = 3600;
```

#### Option 2: Consistent Revalidation (recommended)

```typescript
// In /letters/[id]/page.tsx, ensure these match:
export const revalidate = 3600; // Top-level revalidation setting

// And in your fetch calls:
const res = await fetch(`http://localhost:8000/letters/${id}`, {
  next: { revalidate: 3600 }, // Same revalidation period
  // Remove any cache: "no-store" settings
});
```

The second option is recommended for better performance as it allows pages to be cached and served from the edge.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
