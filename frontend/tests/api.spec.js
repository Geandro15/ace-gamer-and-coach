// FRONT-END: o jogo conversando com a nossa API FastAPI (pasta backend/).
// Sobe o backend de verdade (uvicorn) apontando para um Ollama falso, então roda sem o modelo.
// Se o Python/backend não estiver instalado, estes testes são pulados.
const { test, expect } = require('@playwright/test');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const net = require('net');
const { abrirJogo, iniciarPartida, servidorFalsoOllama, configurarModelo } = require('./helpers');

const BACKEND = path.join(__dirname, '..', '..', 'backend');
const CHAVE = 'chave-de-teste';
const PY = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const temBackend = spawnSync(PY, ['-c', 'import fastapi, uvicorn, httpx'], { cwd: BACKEND }).status === 0;

function portaLivre(){
  return new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
}

let api, ollama, URL_API, recebidos = [];

test.describe('Jogo + API FastAPI', () => {
  test.skip(!temBackend, 'backend não instalado (pip install -r backend/requirements.txt)');

  test.beforeAll(async () => {
    ollama = await servidorFalsoOllama(p =>
      p.includes('FUNCIONANDO') ? 'FUNCIONANDO'
      : p.includes('PERGUNTA DO ATLETA') ? 'Mire no quadrado aceso e alterne as bolas.'
      : 'Ele quase não pisa ali, então a bola chega antes dele.');
    ollama.srv.on('request', req => recebidos.push(req.url));
    const porta = await portaLivre();
    URL_API = `http://127.0.0.1:${porta}/api/coach`;
    api = spawn(PY, ['-m', 'uvicorn', 'main:app', '--port', String(porta)], {
      cwd: BACKEND,
      env: { ...process.env, COACH_API_KEY: CHAVE, OLLAMA_URL: ollama.url },
      stdio: 'ignore'
    });
    for(let i = 0; i < 60; i++){                    // espera a API subir (até 15 s)
      try{ await fetch(URL_API, { method: 'OPTIONS' }); return; }catch(e){ await new Promise(r => setTimeout(r, 250)); }
    }
    throw new Error('a API não subiu');
  });

  test.afterAll(() => { if(api) api.kill(); if(ollama) ollama.srv.close(); });

  test('Teste de conexão, dica do ponto e chat passam pela API', async ({ page }) => {
    const erros = await abrirJogo(page);
    await configurarModelo(page, URL_API);
    await page.evaluate(() => document.getElementById('bCoachIA').click());
    await page.fill('#epKey', CHAVE);
    await page.click('#bTestarIA');
    await expect(page.locator('#testeIAmsg')).toContainText('FUNCIONANDO');
    await page.click('[data-fecha="ovCoachIA"]');

    await iniciarPartida(page);
    await page.waitForFunction(() => window.__ACE.S.phase === 'pronto', null, { timeout: 10000 });
    await page.evaluate(() => window.__ACE.trySwing('slow', false));
    await expect(page.locator('#ordSrc')).toContainText('GERADO PELO MODELO AO VIVO');
    await expect(page.locator('#ordWhy')).toContainText('quase não pisa ali');

    await page.fill('#chatIn', 'onde eu miro?');
    await page.click('#bChatAsk');
    await expect(page.locator('#chatLog')).toContainText('COACH-A1 · MODELO');
    expect(recebidos.length).toBeGreaterThan(0);    // quem falou com o "Ollama" foi a API
    expect(erros).toEqual([]);
  });

  test('Chave errada: a API recusa (401), o teste explica e o jogo usa o gerador local', async ({ page }) => {
    await abrirJogo(page);
    await configurarModelo(page, URL_API);
    await page.evaluate(() => document.getElementById('bCoachIA').click());
    await page.fill('#epKey', 'chave-errada');
    await page.click('#bTestarIA');
    await expect(page.locator('#testeIAmsg')).toContainText('401');
    await page.click('[data-fecha="ovCoachIA"]');
    await iniciarPartida(page);
    await page.fill('#chatIn', 'qual raquete eu uso?');
    await page.click('#bChatAsk');
    await expect(page.locator('#chatLog')).toContainText('GERADOR LOCAL');
  });
});
