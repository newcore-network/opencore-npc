import { FiveMNpcTransportServer } from '../fivem/fivem-npc-transport.server'

/**
 * RedM transport adapter.
 *
 * For MVP this reuses the FiveM transport contract because native task APIs are equivalent
 * for the covered skill set. Keep this class as a dedicated adapter seam for RedM-specific
 * behavior in future iterations.
 */
export class RedMNpcTransportServer extends FiveMNpcTransportServer {}
