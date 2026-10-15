/**
 * The nation-record id (e.g. `uk`) ↔ presentation country-id (e.g. `gb`)
 * bridge. The mapping is authored with the presentation corpus and served over
 * the content IPC (CAH-PRES-3), so it travels with the nation's presentation
 * record rather than living in a second renderer table. This module keeps the
 * existing new-game/diplomacy import path working.
 */
export { countryIdToNationId, nationIdToCountryId } from "./presentationContent.js";
