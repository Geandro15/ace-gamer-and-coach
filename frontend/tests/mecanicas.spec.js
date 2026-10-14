// Testes das mecânicas centrais (M1 a M7) do ACE GAMER AND COACH.
const { test, expect } = require('@playwright/test');
const { abrirJogo, iniciarPartida, rebaterComDistancia } = require('./helpers');

test('Menu: a partida não começa sem o nome do tenista e começa com ele', async ({ page }) => {
  await abrirJogo(page);
  await page.fill('#nome', '');
  await page.click('#bStart');
  expect(await page.evaluate(() => window.__ACE.S.running)).toBe(false);
  await iniciarPartida(page, 'ACE');
  expect(await page.evaluate(() => window.__ACE.S.nome)).toBe('ACE');
});

test.describe('Mecânicas em partida', () => {
test.beforeEach(async ({ page }) => {
  const erros = await abrirJogo(page);
  await iniciarPartida(page);
  test.info().erros = erros;
});

test.afterEach(async () => {
  expect(test.info().erros, 'nenhum erro de JavaScript').toEqual([]);
});

test('M1 alvo: bola no centro sai sem perder ponto', async ({ page }) => {
  const r = await rebaterComDistancia(page, 0, 'slow');
  expect(r.depois.slow).toBe(r.antes.slow + 1);
  expect(r.depois.p2).toBe(r.antes.p2);
  expect(r.lado).toBe('o');               // a bola foi para o lado do adversário
});

test('M1 alvo: bola no anel externo também é devolvida', async ({ page }) => {
  const raios = await page.evaluate(() => window.__ACE.alvoRaios());
  const d = (raios.rIn + raios.rOut) / 2;
  const r = await rebaterComDistancia(page, d, 'fast');
  expect(r.depois.fast).toBe(r.antes.fast + 1);
  expect(r.depois.p2).toBe(r.antes.p2);
});

test('M1 alvo: bola fora do alvo morre na rede e dá ponto ao adversário', async ({ page }) => {
  const raios = await page.evaluate(() => window.__ACE.alvoRaios());
  const r = await rebaterComDistancia(page, raios.rOut * 1.3, 'slow');
  expect(r.depois.nets).toBe(r.antes.nets + 1);
  expect(r.depois.p2).toBe(r.antes.p2 + 1);
});

test('M2 estilos: TÉCNICO tem alvo maior e gasta menos por passo que AGRESSIVO', async ({ page }) => {
  const R = await page.evaluate(() => window.__ACE.RACKETS);
  expect(R['TÉCNICO'].rIn).toBeGreaterThan(R['AGRESSIVO'].rIn);
  expect(R['TÉCNICO'].custoPasso).toBeLessThan(R['AGRESSIVO'].custoPasso);
  expect(R['AGRESSIVO'].vFast).toBeGreaterThan(R['TÉCNICO'].vFast);
});

test('M2/M5 AGRESSIVO vale por um ponto: fôlego cai para 50% e depois 10%', async ({ page }) => {
  const sta = await page.evaluate(() => {
    const A = window.__ACE, S = A.S;
    S.racket = 'AGRESSIVO'; S.pontosAgr = 0; S.sta = 100;
    A.point('p'); const um = S.sta;
    A.point('p'); const dois = S.sta;
    return [um, dois];
  });
  expect(sta[0]).toBeLessThanOrEqual(50);
  expect(sta[1]).toBeLessThanOrEqual(10);
});

test('M5 resistência: no TÉCNICO, acertar o centro devolve fôlego', async ({ page }) => {
  await page.evaluate(() => { const S = window.__ACE.S; S.racket = 'TÉCNICO'; S.sta = 50; S.zone = null; });
  const r = await rebaterComDistancia(page, 0, 'slow');
  expect(r.depois.sta).toBeGreaterThan(r.antes.sta);
});

test('M3 adversário: troca de estilo tende a contrariar o jogador', async ({ page }) => {
  const contrarios = await page.evaluate(() => {
    const A = window.__ACE, S = A.S; let n = 0;
    S.racket = 'AGRESSIVO';
    for(let i = 0; i < 1000; i++){ A.pickOpp(); if(S.opp === 'TÉCNICO') n++; }
    return n;
  });
  expect(contrarios).toBeGreaterThan(540);   // esperado ~620 de 1000
  expect(contrarios).toBeLessThan(700);
});

test('M4 Coach: o quadrado indicado nunca é o mais visitado pelo adversário', async ({ page }) => {
  const resultado = await page.evaluate(() => {
    const A = window.__ACE, S = A.S;
    S.heatO = new Array(24).fill(1);
    S.heatO[1 * 4 + 1] = 90;                // adversário fica quase sempre no MEIO MEIO-ESQ
    let caiuNoQuente = 0;
    for(let i = 0; i < 400; i++){ const z = A.pickZone(); if(z.row === 1 && z.col === 1) caiuNoQuente++;
      if(z.row > 2) return 'fora do lado do adversário'; }
    return caiuNoQuente;
  });
  expect(resultado).toBe(0);
});

test('M4 Coach: recomendação nunca é AGRESSIVO com fôlego abaixo de 30%', async ({ page }) => {
  const rec = await page.evaluate(() => {
    const A = window.__ACE, S = A.S; S.sta = 20; S.opp = 'TÉCNICO'; return A.recommend();
  });
  expect(rec).toBe('TÉCNICO');
});

test('Fim de partida: vitória com 3 games encerra o jogo e entra no ranking com 100 pontos', async ({ page }) => {
  await page.evaluate(() => {
    const A = window.__ACE, S = A.S;
    Object.assign(S, { phase:'rally', g1:2, g2:0, p1:3, p2:0, orders:5, ordersDone:5 });
    A.ball.live = true; A.ball.side = 'o';
    A.ball.x = A.CT.L + 20; A.opp.x = A.CT.R - 20;   // bola longe do adversário: ele não alcança
    A.oppReturn();
  });
  await page.waitForFunction(() => window.__ACE.S.phase === 'over', null, { timeout: 5000 });
  const top = await page.evaluate(() => window.__ACE.rank()[0]);
  expect(top.win).toBe(true);
  expect(top.pts).toBe(100);
});

test('Fim de partida: derrota com 3 games do adversário', async ({ page }) => {
  await page.evaluate(() => {
    const A = window.__ACE, S = A.S;
    Object.assign(S, { phase:'rally', g1:0, g2:2, p1:0, p2:3, orders:4, ordersDone:2 });
    A.point('o');
  });
  await page.waitForFunction(() => window.__ACE.S.phase === 'over', null, { timeout: 5000 });
  const top = await page.evaluate(() => window.__ACE.rank()[0]);
  expect(top.win).toBe(false);
  expect(top.pts).toBe(25);                  // 0 da derrota + 50% de 50 pela obediência
});
});
