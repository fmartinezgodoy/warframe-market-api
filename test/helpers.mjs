export const filters = { type: null, rank: null, platform: null, crossplay: null };
export const item = { slug: 'demo_mod', nameEn: 'Demo Mod', nameEs: 'Mod de ejemplo', tags: ['mod'], maxRank: 5 };
export const order = (type='sell', platinum=12, extra={}) => ({ type, platinum, quantity: 1, rank: 5,
  user: { ingameName: 'SyntheticTrader', reputation: 0, platform: 'pc', crossplay: true, status: 'ingame' }, ...extra });
export const ok = (orders=[]) => new Response(JSON.stringify({ data: orders }), { status: 200 });
