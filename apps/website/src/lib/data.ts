/**
 * Static data loading utilities for build-time consumption.
 *
 * At build time, Next.js server components and generateStaticParams read
 * JSON files from public/data/ using Node.js fs.
 *
 * The JSON files in public/data/ are placeholders (empty arrays) that get
 * replaced when `npm run data:build` is run from the project root.
 */
import fs from "fs";
import path from "path";

import { Letter, LetterSummary, Place, LetterImageEntry, LetterImage, ImageRegistryEntry, PersonPage, PlacePage } from "@/types/letters";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function readJsonFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`Could not read ${filename}, using fallback`);
    return fallback;
  }
}

/** Get all letters with full text content */
export function getLetters(): Letter[] {
  return readJsonFile<Letter[]>("letters.json", []);
}

/** Get letter summaries (id, date, sender, recipient, place -- no text) */
export function getLetterSummaries(): LetterSummary[] {
  const summaries = readJsonFile<LetterSummary[]>("letter-summaries.json", []);
  if (summaries.length > 0) {
    return summaries;
  }
  // Fallback: derive summaries from letters.json (strips text field)
  const letters = getLetters();
  return letters.map(({ id, date, sender, recipient, place }) => ({
    id,
    date,
    sender,
    recipient,
    place,
  }));
}

/** Get a single letter by numeric id */
export function getLetter(id: number): Letter | undefined {
  const letters = getLetters();
  return letters.find((l) => l.id === id);
}

/** Get all unique places */
export function getPlaces(): Place[] {
  return readJsonFile<Place[]>("places.json", []);
}

/** Get all letter IDs for generateStaticParams */
export function getAllLetterIds(): number[] {
  const summaries = getLetterSummaries();
  if (summaries.length > 0) {
    return summaries.map((s) => s.id);
  }
  // Fallback: try to read from letters.json
  const letters = getLetters();
  return letters.map((l) => l.id);
}

/** Get the total number of letters */
export function getLetterCount(): number {
  const summaries = getLetterSummaries();
  if (summaries.length > 0) return summaries.length;
  return getLetters().length;
}

/** Get all letter-to-image mappings */
export async function getLetterImages(): Promise<LetterImageEntry[]> {
  return readJsonFile<LetterImageEntry[]>('letter-images.json', []);
}

/** Get images associated with a specific letter */
export async function getLetterImagesForLetter(letterId: number): Promise<LetterImage[]> {
  const allImages = await getLetterImages();
  const entry = allImages.find(e => e.letter_id === letterId);
  return entry?.images ?? [];
}

/** Get the complete image registry */
export async function getImageRegistry(): Promise<ImageRegistryEntry[]> {
  return readJsonFile<ImageRegistryEntry[]>('image-registry.json', []);
}

/** Get all person pages */
export async function getPersonPages(): Promise<PersonPage[]> {
  return readJsonFile<PersonPage[]>('person-pages.json', []);
}

/** Get a single person page by id */
export async function getPersonPage(id: string): Promise<PersonPage | undefined> {
  const pages = await getPersonPages();
  return pages.find(p => p.id === id);
}

/** Get all person IDs for generateStaticParams */
export function getAllPersonIds(): string[] {
  return readJsonFile<PersonPage[]>('person-pages.json', []).map(p => p.id);
}

/** Get all place pages */
export async function getPlacePages(): Promise<PlacePage[]> {
  return readJsonFile<PlacePage[]>('place-pages.json', []);
}

/** Get a single place page by id */
export async function getPlacePage(id: string): Promise<PlacePage | undefined> {
  const pages = await getPlacePages();
  return pages.find(p => p.id === id);
}

/** Get all place IDs for generateStaticParams */
export function getAllPlaceIds(): string[] {
  return readJsonFile<PlacePage[]>('place-pages.json', []).map(p => p.id);
}
