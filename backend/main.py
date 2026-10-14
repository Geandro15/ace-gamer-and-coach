"""
ACE GAMER AND COACH - backend (API do COACH-A1)

Uma rota só: POST /api/coach
  - recebe o prompt montado pelo jogo (frontend)
  - confere a chave enviada no header X-API-Key
  - repassa o prompt ao modelo local (Ollama + Llama 3.2 3B)
  - devolve o texto gerado em JSON

Assim o navegador nunca fala direto com o Ollama: quem conversa com o modelo é a API.
"""
import os
import time

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()  # lê o arquivo .env da pasta backend, se existir

# Configuração (vem do .env; os valores abaixo são o padrão para rodar localmente)
API_KEY = os.getenv("COACH_API_KEY", "ace-coach-local")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
TIMEOUT_S = float(os.getenv("OLLAMA_TIMEOUT", "30"))

app = FastAPI(
    title="ACE GAMER AND COACH - API do Coach",
    description="Rota única que recebe o prompt do jogo e devolve a resposta do Llama 3.2 3B (Ollama).",
    version="1.0.0",
)

# O jogo pode ser aberto com duplo clique (origem file://) ou por um servidor local,
# então a API aceita chamadas de qualquer origem. A proteção é a chave no header.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["Content-Type", "X-API-Key"],
)


class PedidoCoach(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=4000, description="Texto montado pelo jogo")
    max_tokens: int = Field(120, ge=1, le=400, description="Tamanho máximo da resposta")
    temperatura: float = Field(0.8, ge=0, le=2)
    modelo: str | None = Field(None, description="Opcional. Se vazio, usa OLLAMA_MODEL do .env")


class RespostaCoach(BaseModel):
    resposta: str
    modelo: str
    segundos: float


async def gerar_no_ollama(prompt: str, modelo: str, max_tokens: int, temperatura: float) -> str:
    """Chama o Ollama e devolve só o texto gerado."""
    corpo = {
        "model": modelo,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "30m",
        "options": {"num_predict": max_tokens, "temperature": temperatura},
    }
    async with httpx.AsyncClient(timeout=TIMEOUT_S) as cliente:
        r = await cliente.post(OLLAMA_URL, json=corpo)
    if r.status_code != 200:
        detalhe = r.text[:200]
        raise HTTPException(502, f"O Ollama respondeu com erro {r.status_code}: {detalhe}")
    return (r.json().get("response") or "").strip()


@app.post("/api/coach", response_model=RespostaCoach)
async def coach(pedido: PedidoCoach, x_api_key: str | None = Header(default=None)):
    # 1) autenticação simples por header
    if x_api_key != API_KEY:
        raise HTTPException(401, "Chave inválida ou ausente. Envie o header X-API-Key.")

    # 2) chamada ao modelo
    modelo = (pedido.modelo or "").strip() or OLLAMA_MODEL
    t0 = time.perf_counter()
    try:
        texto = (await gerar_no_ollama(pedido.prompt, modelo, pedido.max_tokens, pedido.temperatura)).strip()
    except httpx.TimeoutException:
        raise HTTPException(504, f"O modelo passou de {TIMEOUT_S:.0f} s sem responder.")
    except httpx.HTTPError:
        raise HTTPException(502, "Não consegui falar com o Ollama. Ele está rodando? (ollama serve)")

    if not texto:
        raise HTTPException(502, "O modelo não devolveu texto. Confira o nome do modelo.")

    # 3) resposta para o jogo
    return RespostaCoach(resposta=texto, modelo=modelo, segundos=round(time.perf_counter() - t0, 2))
