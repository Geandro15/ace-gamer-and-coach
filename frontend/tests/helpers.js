// Funções de apoio: abrir o jogo, fazer login e iniciar a partida.
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');

const URL_JOGO = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;

async function abrirJogo(page){
  const erros = [];
  page.on('pageerror', e => erros.push(String(e)));
  await page.goto(URL_JOGO);
  await page.click('#introPular');
  await page.fill('#loginUser', 'teste');
  await page.fill('#loginPass', '1234');
  await page.click('#btnLogin');
  await page.waitForFunction(() => document.getElementById('loginTela').hidden);
  return erros;
}

async function iniciarPartida(page, nome = 'TESTE'){
  await page.fill('#nome', nome);
  await page.click('#bStart');
  await page.waitForFunction(() => window.__ACE.S.running === true);
}

// Coloca a bola chegando no jogador a uma distância d do centro do alvo e rebate.
async function rebaterComDistancia(page, d, tipo = 'slow'){
  return page.evaluate(([d, tipo]) => {
    const A = window.__ACE, S = A.S;
    S.phase = 'rally'; S.swingT = 0;
    A.ball.live = true; A.ball.side = 'p';
    A.ball.x = A.player.x + d; A.ball.y = A.alvoCentroY();
    const antes = { p2:S.p2, nets:S.nets, fast:S.fast, slow:S.slow, sta:S.sta };
    A.trySwing(tipo, false);
    return { antes, depois:{ p2:S.p2, nets:S.nets, fast:S.fast, slow:S.slow, sta:S.sta },
             lado: A.ball.side, raios: A.alvoRaios() };
  }, [d, tipo]);
}

// Servidor falso no formato do Ollama (/api/generate), só para os testes.
function servidorFalsoOllama(responder){
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      if(req.method === 'OPTIONS'){ res.writeHead(204); return res.end(); }
      let corpo = '';
      req.on('data', c => corpo += c);
      req.on('end', () => {
        const prompt = JSON.parse(corpo).prompt || '';
        res.writeHead(200, { 'Content-Type':'application/json' });
        res.end(JSON.stringify({ response: responder(prompt), done: true }));
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({
      srv, url: `http://127.0.0.1:${srv.address().port}/api/generate`
    }));
  });
}

async function configurarModelo(page, url){
  await page.evaluate(() => document.getElementById('bCoachIA').click());
  await page.fill('#epUrl', url);
  await page.fill('#epModel', 'llama3.2:3b');
  await page.click('[data-fecha="ovCoachIA"]');
}

module.exports = { abrirJogo, iniciarPartida, rebaterComDistancia, servidorFalsoOllama, configurarModelo };
