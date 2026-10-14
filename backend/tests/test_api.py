"""Testes da API do Coach. O Ollama é simulado, então rodam sem o modelo instalado."""
import httpx
import pytest
from fastapi.testclient import TestClient

import main

cliente = TestClient(main.app)
CHAVE = {"X-API-Key": main.API_KEY}


@pytest.fixture
def ollama_falso(monkeypatch):
    chamadas = []

    async def falso(prompt, modelo, max_tokens, temperatura):
        chamadas.append({"prompt": prompt, "modelo": modelo, "max_tokens": max_tokens})
        return "  Mire no quadrado aceso.  "

    monkeypatch.setattr(main, "gerar_no_ollama", falso)
    return chamadas


def test_sem_chave_retorna_401(ollama_falso):
    r = cliente.post("/api/coach", json={"prompt": "oi"})
    assert r.status_code == 401
    assert ollama_falso == []          # o modelo nem é chamado


def test_chave_errada_retorna_401(ollama_falso):
    r = cliente.post("/api/coach", json={"prompt": "oi"}, headers={"X-API-Key": "errada"})
    assert r.status_code == 401


def test_chave_certa_devolve_resposta_do_modelo(ollama_falso):
    r = cliente.post("/api/coach", json={"prompt": "Onde eu miro?", "max_tokens": 70}, headers=CHAVE)
    assert r.status_code == 200
    j = r.json()
    assert j["resposta"] == "Mire no quadrado aceso."
    assert j["modelo"] == main.OLLAMA_MODEL
    assert j["segundos"] >= 0
    assert ollama_falso[0] == {"prompt": "Onde eu miro?", "modelo": main.OLLAMA_MODEL, "max_tokens": 70}


def test_modelo_pode_ser_escolhido_no_pedido(ollama_falso):
    r = cliente.post("/api/coach", json={"prompt": "oi", "modelo": "llama3.2:1b"}, headers=CHAVE)
    assert r.json()["modelo"] == "llama3.2:1b"


def test_prompt_vazio_retorna_422(ollama_falso):
    r = cliente.post("/api/coach", json={"prompt": ""}, headers=CHAVE)
    assert r.status_code == 422


def test_ollama_fora_do_ar_retorna_502(monkeypatch):
    async def fora(*a):
        raise httpx.ConnectError("recusado")
    monkeypatch.setattr(main, "gerar_no_ollama", fora)
    r = cliente.post("/api/coach", json={"prompt": "oi"}, headers=CHAVE)
    assert r.status_code == 502
    assert "Ollama" in r.json()["detail"]


def test_cors_libera_o_header_da_chave():
    r = cliente.options("/api/coach", headers={
        "Origin": "null",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-api-key",
    })
    assert r.status_code == 200
    assert "x-api-key" in r.headers["access-control-allow-headers"].lower()
