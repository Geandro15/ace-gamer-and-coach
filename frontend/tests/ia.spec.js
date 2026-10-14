// Testes da integração com a IA generativa (COACH-A1) e do fallback.
const { test, expect } = require('@playwright/test');
const { abrirJogo, iniciarPartida, servidorFalsoOllama, configurarModelo } = require('./helpers');

test('Validador: aceita texto com números dos dados e reprova número inventado', async ({ page }) => {
  await abrirJogo(page);
  const r = await page.evaluate(() => {
    const v = window.__ACE.validaSaidaIA;
    const prompt = 'Resistência do atleta: 72%. Placar 2 a 1.';
    return {
      ok: v('Você está com 72% de fôlego, segure o rally!', prompt, 240),
      inventado: v('Você fez 17 duplas faltas.', prompt, 240),
      longo: v('a'.repeat(300), prompt, 240),
      vazio: v('', prompt, 240)
    };
  });
  expect(r.ok.ok).toBe(true);
  expect(r.ok.texto).not.toContain('!');           // exclamação vira ponto final
  expect(r.inventado.ok).toBe(false);
  expect(r.longo.ok).toBe(false);
  expect(r.vazio.ok).toBe(false);
});

test('Integração: dica do ponto, chat e teste de conexão vêm do modelo', async ({ page }) => {
  const { srv, url } = await servidorFalsoOllama(p =>
    p.includes('FUNCIONANDO') ? 'FUNCIONANDO'
    : p.includes('PERGUNTA DO ATLETA') ? 'Mire no quadrado aceso e alterne as bolas.'
    : 'Ele quase não pisa ali, então a bola chega antes dele.');
  try{
    const erros = await abrirJogo(page);
    await configurarModelo(page, url);
    await page.evaluate(() => document.getElementById('bCoachIA').click());
    await page.click('#bTestarIA');
    await expect(page.locator('#testeIAmsg')).toContainText('FUNCIONANDO');
    await page.click('[data-fecha="ovCoachIA"]');

    await iniciarPartida(page);
    await page.waitForFunction(() => window.__ACE.S.phase === 'pronto', null, { timeout: 10000 });
    await page.evaluate(() => window.__ACE.trySwing('slow', false));     // saque
    await expect(page.locator('#ordSrc')).toContainText('GERADO PELO MODELO AO VIVO');
    await expect(page.locator('#ordWhy')).toContainText('quase não pisa ali');

    await page.fill('#chatIn', 'onde eu miro?');
    await page.click('#bChatAsk');
    await expect(page.locator('#chatLog')).toContainText('COACH-A1 · MODELO');
    expect(erros).toEqual([]);
  } finally { srv.close(); }
});

test('Integração: resposta com número inventado é descartada e o gerador local assume', async ({ page }) => {
  const { srv, url } = await servidorFalsoOllama(() => 'Você fez 17 duplas faltas hoje.');
  try{
    await abrirJogo(page);
    await configurarModelo(page, url);
    await iniciarPartida(page);
    await page.fill('#chatIn', 'como estou indo?');
    await page.click('#bChatAsk');
    await expect(page.locator('#chatLog')).toContainText('GERADOR LOCAL');
    await expect(page.locator('#chatLog')).not.toContainText('17 duplas');
    const log = await page.evaluate(() => window.__ACE.IA.log.filter(l => l.tipo === 'chat'));
    expect(log[0].motivo).toContain('17');
  } finally { srv.close(); }
});

test('Fallback: com a API fora do ar o jogo continua e o Coach responde pelo gerador local', async ({ page }) => {
  const erros = await abrirJogo(page);
  await configurarModelo(page, 'http://127.0.0.1:9/api/generate');     // porta sem servidor
  await iniciarPartida(page);
  await page.fill('#chatIn', 'qual raquete eu uso?');
  await page.click('#bChatAsk');
  await expect(page.locator('#chatLog')).toContainText('GERADOR LOCAL');
  expect(await page.evaluate(() => window.__ACE.S.running)).toBe(true);
  expect(erros).toEqual([]);
});

test('Configuração do Coach IA fica salva, mas a chave de API não', async ({ page }) => {
  await abrirJogo(page);
  await page.evaluate(() => document.getElementById('bCoachIA').click());
  await page.fill('#epUrl', 'http://localhost:11434/api/generate');
  await page.fill('#epModel', 'llama3.2:3b');
  await page.fill('#epKey', 'chave-secreta');
  await page.locator('#epModel').blur();
  await page.reload();
  expect(await page.inputValue('#epUrl')).toBe('http://localhost:11434/api/generate');
  expect(await page.inputValue('#epModel')).toBe('llama3.2:3b');
  expect(await page.inputValue('#epKey')).toBe('');
  const salvo = await page.evaluate(() => JSON.stringify(localStorage));
  expect(salvo).not.toContain('chave-secreta');
});

test('Configuração: aceita só a porta no endereço e o comando "ollama pull" no modelo', async ({ page }) => {
  await abrirJogo(page);
  await page.evaluate(() => document.getElementById('bCoachIA').click());
  await page.fill('#epUrl', 'http://localhost:11434');
  await page.fill('#epModel', 'ollama pull llama3.2:3b');
  await page.click('[data-fecha="ovCoachIA"]');
  const e = await page.evaluate(() => {
    const u = document.getElementById('epUrl').value, m = document.getElementById('epModel').value;
    return { u, m };
  });
  expect(e.u).toBe('http://localhost:11434');

  // o jogo normaliza na hora de chamar: verifica pelo teste de conexão com servidor falso
  const { srv, url } = await servidorFalsoOllama(() => 'FUNCIONANDO');
  let modeloRecebido = '', rota = '';
  srv.on('request', req => { let b=''; req.on('data', c => b += c); req.on('end', () => { try{ const j = JSON.parse(b); modeloRecebido = j.modelo || j.model; rota = req.url; }catch(_){} }); });
  try{
    await page.evaluate(() => document.getElementById('bCoachIA').click());
    await page.fill('#epUrl', url.replace('/api/generate', ''));
    await page.click('#bTestarIA');
    await expect(page.locator('#testeIAmsg')).toContainText('FUNCIONANDO');
    expect(modeloRecebido).toBe('llama3.2:3b');
    expect(rota).toBe('/api/coach');            // só a porta: completa com a rota da nossa API
  } finally { srv.close(); }
});

test('Modalidade Vídeo: a abertura gerada por IA está embutida, toca e mostra o crédito', async ({ page }) => {
  await page.goto(require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href);
  await expect(page.locator('#introCredito')).toContainText('Google Flow');
  const v = await page.evaluate(async () => {
    const vid = document.getElementById('introVideo');
    for(let i = 0; i < 40 && !(vid.readyState >= 1); i++) await new Promise(r => setTimeout(r, 100));
    return { src: (vid.currentSrc || vid.src || '').slice(0, 11), dur: vid.duration };
  });
  expect(v.src).toBe('data:video/');
  expect(v.dur).toBeGreaterThan(1);
});
