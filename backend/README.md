# Backend: API do COACH-A1 (FastAPI)

Uma rota só, `POST /api/coach`, protegida por uma chave no header `X-API-Key`. A rota recebe o prompt montado pelo jogo, repassa ao Ollama (Llama 3.2 3B) e devolve o texto gerado.

## Rodar

```bat
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

- API: http://localhost:8000/api/coach
- Documentação interativa (Swagger): http://localhost:8000/docs. Para usar, clique em `POST /api/coach`, depois em **Try it out**, preencha `x-api-key` e clique em **Execute**.

## Configuração (`.env`)

| Variável | Padrão | Para que serve |
|---|---|---|
| `COACH_API_KEY` | `ace-coach-local` | Chave que o jogo precisa enviar no header `X-API-Key` |
| `OLLAMA_URL` | `http://localhost:11434/api/generate` | Endereço do Ollama |
| `OLLAMA_MODEL` | `llama3.2:3b` | Modelo usado quando o pedido não informa um |
| `OLLAMA_TIMEOUT` | `30` | Segundos de espera pelo modelo |

O arquivo `.env` não vai para o GitHub (está no `.gitignore`), então nenhuma chave real fica no repositório.

## Testes

```bat
pytest
```

São 7 testes, e o Ollama é simulado, então rodam sem o modelo instalado.
