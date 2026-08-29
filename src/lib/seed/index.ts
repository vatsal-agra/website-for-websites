import { SEED_SITES_A } from './sites-a'
import { SEED_SITES_B } from './sites-b'
import { SEED_SITES_C } from './sites-c'
import { SEED_SITES_D } from './sites-d'
import { SEED_SITES_E } from './sites-e'
import type { SeedSite } from './types'

export { SEED_COLLECTIONS } from './collections'
export type { SeedSite, SeedCollection } from './types'

export const SEED_SITES: SeedSite[] = [
  ...SEED_SITES_A,
  ...SEED_SITES_B,
  ...SEED_SITES_C,
  ...SEED_SITES_D,
  ...SEED_SITES_E,
]
