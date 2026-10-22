import { describe, expect, it } from "vite-plus/test";
import { RandomLedger } from "@bluewave/random";
import { projectBattle } from "../../src/battleResolution/project.js";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { getFireRiskBp } from "../../src/damage/immediateFireFlooding.js";
import { makeAutoInput, makeNations } from "./fixtures.js";

const FIRE_BASELINE_INPUT = makeAutoInput({
  nations: makeNations({ attackerGuns: [4, 4], defenderGuns: [4, 4] }),
});

const FIRE_BASELINE_RESULT_HASH =
  "18af1816d5976290233afeaeaf2d726088e9f1ef43c649653bc9027ed808f362";
const FIRE_BASELINE_MINUTE_HASHES = [
  "704d9118704bb7ff99215a06c9eabcbda043c21f897e87accd311494f0c8f218",
  "2e2de88b6ed11699c2fdd380ff71340886c2f3fd2d3dd78bb1f2cd6d7665a275",
  "a48b85fb060d64ed510650c47bc881f06d62e7f5320d0c8549eb5193640e1a81",
  "b0cac36501a2325e60ef7aa45c39aa2d4ed4291e09d814617f5806c76678366e",
  "7cd8b37d435faa3bad44b486f03b4fea66b44a51e0d18ee3edf73b8af920024b",
  "a2f8ee93388fb7b8ad343855831e370972f42677bab41825114314109967f57a",
  "0ee687d2335db266eef5a21e35593513cdb4a9ad4a82acbbb9c5f59d5b4a9568",
  "345bdd7b474ef7a948993b261573a7b033c191596ebd231b9f6e1303768a998a",
  "413d02f3762360531dcd6db4041c4ba8543075bb359bbf7563d739ebadab5c60",
  "d8cec7a70d722f4a5b5c1abe666ba0227b57bab3a9ac9777b64e17d1e5bc9862",
  "a656c978577e6e7a434edcac55d8a32a84f40b99d2999337098d2687eb8e6889",
  "3528fbfe60e3176222ffd699d6e88b83bc329f83ea20d1124503499109281c5e",
  "b4b9c7ec542ade6ca0ed0d0305fa2a2d3263ed35703bf8dc13d1a17b384d1d87",
  "1b0ef4baabf51ba73f4f24aef71dc1966ab6140af4d6dd31a26828d96ad3b238",
  "b65ae4e169d8834b25f3d291ad073802567001b917d3f20523a4e22df8251d6a",
  "99ba8cd2f997e7d093e7e0a15d5c443dd1c4fda7fba83e2d0939edc9ad589573",
  "476d8f3e06430c5ba838c55e19eef197eb6298caf74a2ea601804c1405e3fdb6",
  "d14995a9e5d22374293ec03eeb6e87c275f05bb0cbbbafaf2ed873f5e7f0f037",
  "e60af1db1199a493532795d5f837f35c29b69457815bf5224a1f07d659f86759",
  "622b405ec04664a1f355afda0f5eb961dfde3be9d3b4212531249d3d8d768121",
  "8e90a75a58f962ed450c01806a2e88ea4c5e660ae0ec7a6982bb0e2176a89f52",
  "596262e99a7fc74a1d085711f399f07e140fc377aff63ab4b722758446e6e433",
  "81da4723eb2ce43a928f6e2fe5452a8b9a01188db1cdb63cf3a7390fb0b92c12",
  "fd3d4dabc279d756452ce96d3621da547e04b302553aa1f768bae217833d19a3",
  "3ed660cf83a61ba7ae7cf2f045ffccdc196231dfc0cf1cfc682de8f6b176e8e1",
  "36be952fe3cc23a5d603efab5a6429920519c6586942f550e5f4ee0fbb4d373b",
  "9f0271a2618a58f99b533d354302fae908558c972b86315a8b1e40c40450a60a",
  "f2c62ff8bd82d689345c5223c87496d9f16b7747cd194392f48ad391b3ad2499",
  "7d21476d2fb9b10816c24062bd117e695945e710f133bd8c537fcf22238cf372",
  "48b3a4bc9e67cdec49b55e500b9737476efcc2c7f9a6485ace577ef987157fce",
  "8bcbef5ab5bc7fc93848d2fbaa549378b64bdc712a5d05ebfda3a3894a56302e",
  "f6b2168b6b7df1678830175698ffbf2045e48fd5a5b7e59faf7a8189b1dfb45c",
  "d019ec2d11fa4fccefa811aed03a6e69549b86882518de5941299f813af09000",
  "99b9ebdd996b272601363a889a467abca1084846dc78ece010e1b07721763684",
  "562fa08ac41bc6505f9442062904db71cad99c5f2bbc1f663e7f19b5356b50ac",
  "c93be3f182e7022286e3d1777d266ccfd62b2273e298955b7208800c860ae1dc",
  "3cc851cde7fd1a990405c97bf94d716c9a7c937da33c36c676bf34026aa40511",
  "1f52395034226a5a06226a72834d8e956ab393137a48d925c7364d53eaea5dce",
  "1a4188b9068695cb746f7490ddff77d6318c007fd0a1336ced9140bfdaebd940",
  "6fdc3ced8208fa9394efbb25c488be15ab4bd9a7c58a0460f3c498fb7c0d11ce",
  "c2d7b47b4d6a6da268c97c9a83386ef3003478d13ef0939df929e69a7ef3b9b6",
  "4ca238ae35cd9a0200d03885af229acb258e7cd7335db8db6da7034f701e18b6",
  "3e514b766465832afa7be37046127683c203c85a54c1cd3a82bf7d44b5505308",
  "1c5f293f012163ddc2ddd50247aa9cd592966165bb1f4c490e79e60476a5fd13",
  "fc014d4f53d2b314eda8b1425d0a7d571c39ea10bdc5f32f61964d1fff219ed9",
  "f305ecdc909dafe928039f42541d948a3909f58f742959e586da7b86308e140d",
  "535446e2ec4dcc91410fe8596a149552eaa882f54ef93f4ce43747b7a73e329c",
  "2e7f57493807be69403f9e655931f8ed8ae74bc9d306b933a7a755816b3ce018",
  "82ae9cffd16af2928be204a889e3ac4b57127b072f3db586a103d60e30bffb41",
  "4b64ab9049102e16b9f1d6cc1196fa9fd90f1e330435beffeef0be7878b29e7f",
  "88f676e60bd64f46dac34b6ef1765c08447fafbf38e28cc09b2b9ee5ace31d6c",
  "773fc4f38a355640f3af0fac5b6ea9136aaf0ec30c9dbfd1c63caaee966f1569",
  "07125f41567a92f86bea48916a58605824313ae61f1d1262a8a0789f64683af4",
  "cdc92f7dfb91608ea5d9f6330bd95061996806cc3aa86779d59aaba8b203e311",
  "8f41d3fe975db5d910b3a734f61fa8cf23767cb3fdc5699ec036e2ddac2f39b0",
  "e19f4e40dbdead49d9f01be67b2893875cb636ca1172f27fb4d8f4588e92e386",
  "220e086fabb20cab8ce1c91ac3471bc7294e4ccfdbc59d313a6ccdc80fdc7a93",
  "6462281cacb485ff3a1fbc8d11fd3a290c84dabc51570f51afdc2d9cca29a3d4",
  "c73567394a213c6cac3b1e63ff3a42c530fd8962035b9e8bf9acb1991987fc59",
  "f5a77a2252108d41bc38e724a61564a74e812c35fb23024808008dd4fcb0ffa3",
  "c43a46b791d99d8c78134f4d6cc7ee46b543c1d8882e517b254857330eeb7733",
  "346fbd08310f4043d30b6dc2a9d338aab87e5c28dc134b971a7bfcef18932a6f",
  "cb731ab533ed716cc62b689f3d5b71f45dadfc0290960c585c0637bc9eeb330b",
  "f74999f570faad690918ae4de87bee7a515755cd4f2326a28100ec3dd1e09a8f",
  "46d0b918fb623a00f3c24693a5d7b7a147d2cc357b6ba65eb0175fd00a4dea4a",
] as const;

describe("unarmed damage control (P-1 ticket 09)", () => {
  it("unarmed baseline #2: damage control wired in an unarmed battle with persisted shell-started fires (ticket 10)", () => {
    const unarmedProjection = projectBattle({
      ...FIRE_BASELINE_INPUT,
      rulesetVersion: FIRE_BASELINE_INPUT.rulesetVersion,
    });
    expect(unarmedProjection.torpedoes).toBeUndefined();

    const ledger = new RandomLedger();
    const result = resolveBattleAuto({ ...FIRE_BASELINE_INPUT, randomLedger: ledger });
    expect(result.torpedoSummary).toBeUndefined();

    const fireCreationDraws = ledger.all.filter((d) =>
      d.streamId.startsWith("battle/ship/damage/fire_creation:"),
    );
    expect(fireCreationDraws.length).toBeGreaterThan(0);
    expect(getFireRiskBp("BB")).toBe(10_000);
    expect(new Set(fireCreationDraws.map((d) => d.entityKey))).toEqual(
      new Set(["a1", "a2", "d1", "d2"]),
    );
    const fireSourcesCreated = fireCreationDraws.filter(
      (d) => Math.floor(d.draw * 10_000) < getFireRiskBp("BB"),
    );
    expect(fireSourcesCreated.length).toBe(fireCreationDraws.length);

    const withoutLedger = resolveBattleAuto(FIRE_BASELINE_INPUT);
    expect(withoutLedger.resultHash).toBe(result.resultHash);
    expect(withoutLedger.minuteHashes).toEqual(result.minuteHashes);

    expect(result.battleEndReason).toBe("withdrawal_complete");
    expect(result.elapsedMinutes).toBe(65);
    expect(result.resultHash).toBe(FIRE_BASELINE_RESULT_HASH);
    expect(result.minuteHashes).toEqual([...FIRE_BASELINE_MINUTE_HASHES]);
    expect(result.minuteHashes).toHaveLength(FIRE_BASELINE_MINUTE_HASHES.length);
  });
});
