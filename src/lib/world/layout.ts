import type { ShelfLocation, SectionId } from "../types";

/**
 * World layout (metres). Shared by the server (book placement) and the client
 * (rendering + navigation) so a book's address always maps to the same spot.
 *
 *   gate (z=+2) ─ foyer/rotunda (z 0…-16) ─ main aisle (x=0) running to -∞
 *   Sections alternate left (odd) / right (even) of the main aisle.
 *   Each section: a cross-aisle along x with two facing shelf rows.
 */
export const LAYOUT = {
  MAIN_HALF: 2.6, // half-width of the main aisle
  FOYER_END_Z: -16, // first section starts after this
  SECTION_DEPTH: 5.2, // z extent of one section block
  ROW_OFFSET: 1.25, // distance from cross-aisle center to shelf front
  SHELF_DEPTH: 0.36,
  BAYS: 4,
  BAY_WIDTH: 2.4,
  BAY_MARGIN: 0.9, // gap between main aisle edge and first bay
  SHELVES: 5,
  SHELF_Y0: 0.14,
  SHELF_SPACING: 0.4,
  SLOTS: 40,
  SLOT_PITCH: 0.056,
  SHELF_HEIGHT: 2.25,
} as const;

export const SLOTS_PER_SECTION = 2 * LAYOUT.BAYS * LAYOUT.SHELVES * LAYOUT.SLOTS;

export function sectionSide(id: SectionId): -1 | 1 {
  return id % 2 === 1 ? -1 : 1;
}

/** z of the cross-aisle centre of a section. */
export function sectionZ(id: SectionId): number {
  const k = Math.floor((id - 1) / 2);
  return LAYOUT.FOYER_END_Z - LAYOUT.SECTION_DEPTH / 2 - k * LAYOUT.SECTION_DEPTH;
}

/** Inverse: which section pair index is at world z (for streaming). */
export function sectionPairAt(z: number): number {
  return Math.floor((LAYOUT.FOYER_END_Z - z) / LAYOUT.SECTION_DEPTH);
}

/** Distance along the cross-aisle from the main aisle edge to a slot centre. */
export function slotU(bay: number, slot: number): number {
  const L = LAYOUT;
  const inner = (L.BAY_WIDTH - L.SLOTS * L.SLOT_PITCH) / 2;
  return L.BAY_MARGIN + bay * L.BAY_WIDTH + inner + (slot + 0.5) * L.SLOT_PITCH;
}

/** x for a "u" distance in a section. */
export function uToX(section: SectionId, u: number): number {
  return sectionSide(section) * (LAYOUT.MAIN_HALF + u);
}

/** z of a row's shelf centre and the direction the books face (+1 / -1 in z). */
export function rowGeometry(section: SectionId, row: 0 | 1) {
  const zc = sectionZ(section);
  const facing = row === 0 ? 1 : -1; // row 0 behind aisle (−z side) faces +z
  const front = zc - facing * LAYOUT.ROW_OFFSET;
  const centerZ = front - facing * (LAYOUT.SHELF_DEPTH / 2);
  return { zc, facing, front, centerZ };
}

export function shelfY(shelf: number): number {
  return LAYOUT.SHELF_Y0 + shelf * LAYOUT.SHELF_SPACING;
}

/** World position of the base-centre of the book at a location. */
export function slotWorld(loc: ShelfLocation) {
  const { centerZ, facing, zc } = rowGeometry(loc.section, loc.row);
  const x = uToX(loc.section, slotU(loc.bay, loc.slot));
  return {
    x,
    y: shelfY(loc.shelf), // top of the shelf board
    z: centerZ, // shelf centre line (books sit front-aligned from here)
    facing,
    /** Where the librarian stands to pick this book. */
    standZ: zc - facing * 0.55,
  };
}

export function slotIndex(loc: ShelfLocation): number {
  const L = LAYOUT;
  return ((loc.row * L.BAYS + loc.bay) * L.SHELVES + loc.shelf) * L.SLOTS + loc.slot;
}

export function slotFromIndex(section: SectionId, idx: number): ShelfLocation {
  const L = LAYOUT;
  const slot = idx % L.SLOTS;
  const shelf = Math.floor(idx / L.SLOTS) % L.SHELVES;
  const bay = Math.floor(idx / (L.SLOTS * L.SHELVES)) % L.BAYS;
  const row = (Math.floor(idx / (L.SLOTS * L.SHELVES * L.BAYS)) % 2) as 0 | 1;
  return { section, row, bay, shelf, slot };
}

/** Prefer eye/hand height shelves for real catalogue books (nicer animation). */
export const PREFERRED_SHELVES = [2, 1, 3, 0, 4];
