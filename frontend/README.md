# Frontend: o jogo

O jogo inteiro fica em um único arquivo, `index.html` (HTML, CSS e JavaScript puro, com a imagem e o vídeo de abertura embutidos). Para jogar, basta abrir esse arquivo com duplo clique.

## Conexão com a API

O jogo chama a API do backend em `http://localhost:8000/api/coach` (é o endereço que já vem preenchido no botão **Coach IA**) e envia a chave no header `X-API-Key`. O código fica na seção **8. MODELO** do `index.html`:

| Função | O que faz |
|---|---|
| `endpoint()` | Lê o endereço, o modelo e a chave do painel Coach IA |
| `montaChamada()` | Monta os headers e o corpo da requisição (`X-API-Key` + `{prompt, max_tokens}`) |
| `callModel()` | Faz o `fetch` com tempo limite; se der erro, devolve `null` e o gerador local assume |
| `textoDaResposta()` | Lê o campo `resposta` do JSON da API |
| `validaSaidaIA()` | Descarta resposta vazia, longa demais ou com números que não estavam nos dados |
| `testarCoachIA()` | Botão TESTAR CONEXÃO: explica em português o erro 401, o 502 ou a API fora do ar |

O jogo também continua aceitando o Ollama direto (`http://localhost:11434/api/generate`) ou uma API no formato OpenAI.

## Testes

```bat
npm install
npx playwright install chromium
npm test
```

São 21 testes. Os testes de `tests/api.spec.js` sobem o backend de verdade com `uvicorn` e por isso precisam das dependências do backend instaladas; sem elas, esses dois testes são pulados. Se o Python estiver num ambiente virtual, ative o ambiente antes ou informe o caminho em `PYTHON`, por exemplo `set PYTHON=..\backend\.venv\Scripts\python.exe`.
